#!/bin/sh
# Erzeugt /config.json aus Umgebungsvariablen beim Containerstart.
# Nur öffentliche Werte – niemals Tokens oder Passwörter hier hinterlegen.
set -eu

target=/usr/share/nginx/html/config.json
url="${JELLYFIN_URL:-}"
escaped=$(printf '%s' "$url" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')

printf '{\n  "defaultServerUrl": "%s"\n}\n' "$escaped" > "$target"
echo "jailfin: config.json geschrieben (defaultServerUrl=${url:-<leer>})"
