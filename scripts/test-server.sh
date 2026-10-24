#!/usr/bin/env bash
# Local Jellyfin test server (rootless podman) for smoke-testing Jailfin.
# Usage: test-server.sh [up|down|reset|add-season]
set -euo pipefail

NAME=jailfin-test-jellyfin
IMAGE=docker.io/jellyfin/jellyfin:latest
BASE=/home/hf/.cache/jailfin-test
MEDIA=$BASE/media
STAGING=$BASE/staging
URL=http://127.0.0.1:8096
AUTH_HDR='Authorization: MediaBrowser Client="setup", Device="cli", DeviceId="setup-cli", Version="1.0"'
# The host ffmpeg may lack libx264/libx265; use the one bundled in the Jellyfin image.
FFBIN=/usr/lib/jellyfin-ffmpeg/ffmpeg

log() { echo "[test-server] $*" >&2; }

ff() { # ff <args...> ; paths must be under /data (== $BASE)
  podman run --rm --entrypoint "$FFBIN" -v "$BASE:/data:Z" "$IMAGE" \
    -hide_banner -loglevel error -y "$@"
}

SRC_V=(-f lavfi -i "testsrc2=size=640x360:rate=24:duration=90")
gen_a() { echo "-f lavfi -i sine=frequency=$1:duration=90"; }
V264=(-c:v libx264 -preset veryfast -b:v 150k -maxrate 200k -bufsize 400k -pix_fmt yuv420p)
AAC=(-c:a aac -b:a 48k)

mk_simple() { # mk_simple <relpath under /data/media or staging> <title> <freq> [vcodec args...]
  local out=$1 title=$2 freq=$3
  [ -f "$BASE/$out" ] && return 0
  mkdir -p "$(dirname "$BASE/$out")"
  log "generating $out"
  ff "${SRC_V[@]}" -f lavfi -i "sine=frequency=$freq:duration=90" \
    -map 0:v -map 1:a "${V264[@]}" "${AAC[@]}" -metadata title="$title" \
    -movflags +faststart "/data/$out"
}

gen_media() {
  mkdir -p "$MEDIA" "$STAGING"
  local S="media/shows/Testserie/Season 01"
  mk_simple "$S/Testserie S01E01.mkv" "Testserie E01" 440
  mk_simple "$S/Testserie S01E03.mkv" "Testserie E03" 520
  if [ ! -f "$BASE/$S/Testserie S01E02.mkv" ]; then
    log "generating Testserie S01E02 (2 audio, subtitle)"
    cat > "$BASE/tmp-sub.srt" <<'EOF'
1
00:00:01,000 --> 00:00:05,000
Hallo Welt

2
00:00:10,000 --> 00:00:15,000
Zweite Zeile
EOF
    cat > "$BASE/tmp-sub-en.srt" <<'EOF'
1
00:00:01,000 --> 00:00:05,000
Hello world

2
00:00:10,000 --> 00:00:15,000
Second line
EOF
    ff "${SRC_V[@]}" -f lavfi -i "sine=frequency=480:duration=90" \
      -f lavfi -i "sine=frequency=880:duration=90" -i /data/tmp-sub.srt \
      -map 0:v -map 1:a -map 2:a -map 3:s "${V264[@]}" "${AAC[@]}" -c:s srt \
      -metadata:s:a:0 language=deu -metadata:s:a:1 language=eng \
      -metadata:s:s:0 language=ger -metadata title="Testserie E02" \
      "/data/$S/Testserie S01E02.mkv"
    cp "$BASE/tmp-sub-en.srt" "$BASE/$S/Testserie S01E02.en.srt"
    rm -f "$BASE/tmp-sub.srt" "$BASE/tmp-sub-en.srt"
  fi
  local n
  for n in "Zweite Serie:600" "Dritte Serie:700"; do
    local show=${n%%:*} f=${n##*:}
    mk_simple "media/shows/$show/Season 01/$show S01E01.mp4" "$show E01" "$f"
    mk_simple "media/shows/$show/Season 01/$show S01E02.mp4" "$show E02" "$((f+40))"
  done
  mk_simple "media/movies/Testfilm (2020)/Testfilm (2020).mp4" "Testfilm" 300
  if [ ! -f "$BASE/media/movies/HEVC Film (2021)/HEVC Film (2021).mkv" ]; then
    log "generating HEVC Film"
    mkdir -p "$MEDIA/movies/HEVC Film (2021)"
    ff "${SRC_V[@]}" -f lavfi -i "sine=frequency=350:duration=90" -map 0:v -map 1:a \
      -c:v libx265 -preset veryfast -b:v 150k -pix_fmt yuv420p -tag:v hvc1 \
      -c:a ac3 -b:a 96k -metadata title="HEVC Film" \
      "/data/media/movies/HEVC Film (2021)/HEVC Film (2021).mkv"
  fi
  # staging for add-season (only if not already moved into the library)
  if [ ! -f "$STAGING/Testserie S02E01.mkv" ] && [ ! -f "$MEDIA/shows/Testserie/Season 02/Testserie S02E01.mkv" ]; then
    mk_simple "staging/Testserie S02E01.mkv" "Testserie S02E01" 560
  fi
}

start_container() {
  mkdir -p "$BASE/config" "$BASE/cache"
  if podman container exists "$NAME"; then
    if [ "$(podman inspect -f '{{.State.Running}}' "$NAME")" != true ]; then
      log "starting existing container"; podman start "$NAME" >/dev/null
    else
      log "container already running"
    fi
  else
    log "creating container"
    podman run -d --name "$NAME" -p 8096:8096 \
      -v "$BASE/config:/config:Z" -v "$BASE/cache:/cache:Z" \
      -v "$MEDIA:/media:ro,Z" "$IMAGE" >/dev/null
  fi
}

wait_up() {
  log "waiting for server"
  local i
  for i in $(seq 1 120); do
    curl -sf "$URL/System/Info/Public" >/dev/null 2>&1 && return 0
    sleep 2
  done
  log "server did not come up"; exit 1
}

api() { # api METHOD PATH [json-body] ; uses $TOKEN if set
  local m=$1 p=$2 b=${3-}
  local args=(-sS -f -X "$m" "$URL$p" -H "$AUTH_HDR${TOKEN:+, Token=\"$TOKEN\"}")
  [ -n "$b" ] && args+=(-H 'Content-Type: application/json' -d "$b")
  curl "${args[@]}"
}

wizard() {
  local done
  done=$(curl -sf "$URL/System/Info/Public" | jq -r .StartupWizardCompleted)
  [ "$done" = true ] && { log "wizard already completed"; return 0; }
  log "running startup wizard"
  local i
  for i in $(seq 1 60); do api GET /Startup/Configuration >/dev/null 2>&1 && break; sleep 2; done
  api POST /Startup/Configuration '{"UICulture":"de-DE","MetadataCountryCode":"DE","PreferredMetadataLanguage":"de"}' >/dev/null
  api GET /Startup/User >/dev/null   # initialises default user
  api POST /Startup/User '{"Name":"admin","Password":"admin"}' >/dev/null
  api POST /Startup/RemoteAccess '{"EnableRemoteAccess":true,"EnableAutomaticPortMapping":false}' >/dev/null
  api POST /Startup/Complete >/dev/null
}

login() {
  local r
  r=$(TOKEN= api POST /Users/AuthenticateByName '{"Username":"admin","Pw":"admin"}')
  TOKEN=$(jq -r .AccessToken <<<"$r")
  ADMIN_ID=$(jq -r .User.Id <<<"$r")
}

libraries() {
  local have
  have=$(api GET /Library/VirtualFolders | jq -r '.[].Name')
  local opts='{"LibraryOptions":{"EnableInternetProviders":false,"MetadataSavers":[],"TypeOptions":[],"EnableRealtimeMonitor":true}}'
  if ! grep -qx Serien <<<"$have"; then
    log "creating library Serien"
    api POST "/Library/VirtualFolders?name=Serien&collectionType=tvshows&paths=%2Fmedia%2Fshows&refreshLibrary=false" "$opts" >/dev/null
  fi
  if ! grep -qx Filme <<<"$have"; then
    log "creating library Filme"
    api POST "/Library/VirtualFolders?name=Filme&collectionType=movies&paths=%2Fmedia%2Fmovies&refreshLibrary=false" "$opts" >/dev/null
  fi
}

second_user() {
  if api GET /Users | jq -e '.[]|select(.Name=="zweit")' >/dev/null; then
    log "user zweit exists"; return 0
  fi
  log "creating user zweit"
  local id
  id=$(api POST /Users/New '{"Name":"zweit","Password":"zweit"}' | jq -r .Id)
  local pol
  pol=$(api GET "/Users/$id" | jq -c '.Policy | .EnableAllFolders=true | .EnabledFolders=[]')
  api POST "/Users/$id/Policy" "$pol" >/dev/null
}

count_items() {
  api GET "/Items?Recursive=true&IncludeItemTypes=Episode,Movie&userId=$ADMIN_ID&Limit=1" | jq .TotalRecordCount
}

scan_and_wait() { # scan_and_wait <expected>
  local want=$1 n=0 i
  api POST /Library/Refresh >/dev/null
  for i in $(seq 1 90); do
    n=$(count_items)
    [ "$n" -ge "$want" ] && { log "items: $n"; return 0; }
    sleep 2
  done
  log "only $n items found (wanted $want)"; exit 1
}

item_id() { # item_id <series name> <episode index>
  api GET "/Items?Recursive=true&IncludeItemTypes=Episode&userId=$ADMIN_ID&Fields=Path" |
    jq -r --arg s "$1" --argjson e "$2" \
      '.Items[]|select(.SeriesName==$s and .ParentIndexNumber==1 and .IndexNumber==$e)|.Id' | head -1
}

seed_playstate() {
  local s id
  for s in "Testserie" "Zweite Serie" "Dritte Serie"; do
    id=$(item_id "$s" 1)
    [ -n "$id" ] || { log "no S01E01 for $s"; exit 1; }
    api POST "/UserPlayedItems/$id?userId=$ADMIN_ID" >/dev/null
  done
  log "NextUp:"
  api GET "/Shows/NextUp?userId=$ADMIN_ID" | jq -r '.Items[]|"  \(.SeriesName) S\(.ParentIndexNumber)E\(.IndexNumber) \(.Id)"' >&2
}

# Testclips sind nur 90 s lang; Jellyfin speichert Positionen standardmäßig erst ab 300 s Laufzeit.
resume_short_media() {
  local conf
  conf=$(api GET /System/Configuration | jq '.MinResumeDurationSeconds = 0')
  api POST /System/Configuration "$conf" >/dev/null
  log "MinResumeDurationSeconds=0"
}

cmd_up() {
  gen_media
  start_container
  wait_up
  wizard
  login
  libraries
  resume_short_media
  second_user
  scan_and_wait 9
  seed_playstate
  log "Jellyfin $(curl -sf "$URL/System/Info/Public" | jq -r .Version) ready at $URL (admin/admin, zweit/zweit), admin id $ADMIN_ID"
}

cmd_down() { podman rm -f "$NAME" >/dev/null 2>&1 || true; log "container removed, data kept"; }

cmd_reset() {
  cmd_down
  # files are owned by subuids; remove through podman unshare
  podman unshare rm -rf "$BASE" 2>/dev/null || rm -rf "$BASE"
  log "data removed"
}

cmd_add_season() {
  local src="$STAGING/Testserie S02E01.mkv" dst="$MEDIA/shows/Testserie/Season 02"
  if [ -f "$src" ]; then
    mkdir -p "$dst"; mv "$src" "$dst/"
  else
    log "nothing staged"
  fi
  wait_up; login
  api POST /Library/Refresh >/dev/null
  log "library refresh triggered"
}

case "${1:-up}" in
  up) cmd_up ;;
  down) cmd_down ;;
  reset) cmd_reset ;;
  add-season) cmd_add_season ;;
  *) echo "usage: $0 [up|down|reset|add-season]" >&2; exit 2 ;;
esac
