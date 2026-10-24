#!/bin/sh
# Erzeugt /config.json aus Umgebungsvariablen beim Containerstart.
# Nur öffentliche Werte – niemals Tokens oder Passwörter hier hinterlegen.
set -eu

target=/usr/share/nginx/html/config.json

json_escape() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

url="${JELLYFIN_URL:-}"
local_url="${JELLYFIN_LOCAL_URL:-}"

printf '{\n  "defaultServerUrl": "%s",\n  "localServerUrl": "%s"\n}\n' \
  "$(json_escape "$url")" "$(json_escape "$local_url")" > "$target"
echo "jailfin: config.json geschrieben (defaultServerUrl=${url:-<leer>}, localServerUrl=${local_url:-<leer>})"
