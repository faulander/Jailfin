# Jailfin

Persönlicher Jellyfin-Client für Browser und PWA, optimiert für Tablets im Querformat. Schwerpunkt: eine brauchbare **„Als nächstes“**-Ansicht, in der sich Serien dauerhaft ausblenden lassen, ohne Daten auf dem Jellyfin-Server zu verändern.

Stack: Svelte 5 (Runes) · TypeScript · reines CSS · Vite+ (`vp`) · Bun · Docker/nginx. Kein eigenes Backend.

## Funktionen

- Anmeldung an einem eigenen Jellyfin-Server (HTTP/HTTPS, Adresse auch ohne Schema), Sitzung bleibt bis zum Abmelden erhalten.
- Startseite: **Als nächstes**, **Weiterschauen**, **Zuletzt hinzugefügt**. Episoden, die schon unter „Als nächstes“ stehen, erscheinen nicht noch einmal unter „Weiterschauen“.
- Serien aus „Als nächstes“ ausblenden: über das ⋮-Menü bzw. per Long-Press auf der Karte oder auf der Serienseite. Danach kann die Aktion rückgängig gemacht werden. Verwalten lassen sich die Ausblendungen unter _Einstellungen → Ausgeblendete Serien_.
- Filme und Serien als Raster mit inkrementellem Nachladen und Sortierung nach Titel, Jahr oder Hinzufügedatum. Dazu kommen eine Suche mit Debouncing sowie Detailseiten mit Staffeln, Episoden und Gesehen-Status.
- Player:
  - Wiedergabe: Direct Play, bei Bedarf Transcoding über HLS (iPad nativ, sonst hls.js); Fortsetzen an der gespeicherten Position.
  - Bedienung: Spulen −10/+30 s, Lautstärke, Vollbild, Tastatur (Leertaste/K, ←/→, F, M).
  - Spuren: Wahl von Audiospur und Untertiteln. Textuntertitel stellt der Browser als WebVTT dar, Bilduntertitel brennt der Server ein.
  - Status: meldet Start, Fortschritt und Stopp an Jellyfin.
  - Am Ende einer Folge: „Nächste Folge“ (kein Autoplay).
  - Fehler: Scheitert Direct Play, weicht der Player automatisch auf Transcoding aus.
- Installierbar als PWA. Der Service Worker cacht nur die App-Hülle, keine Medien und keine API-Antworten.

## „Als nächstes“: Funktionsweise und Grenzen

- Grundlage ist der Next-Up-Endpunkt von Jellyfin (`/Shows/NextUp`, inklusive angefangener Folgen). Der Client lädt **alle Seiten** und filtert erst danach. Ausblendungen verdrängen deshalb keine späteren Ergebnisse.
- Ausblendungen werden pro **Server-ID + Benutzer-ID + SeriesId** in IndexedDB gespeichert (DB `jailfin`, Store `hiddenSeries`, versioniert über `DB_VERSION`/`migrate` in `src/lib/nextup/hidden-store.ts`). Neue Staffeln oder Server-Updates holen eine ausgeblendete Serie nicht zurück.
- Die Ausblendung ist eine **reine Anzeigepräferenz dieses Browsers bzw. dieser PWA-Installation**. Sie wird nicht zwischen Geräten synchronisiert und beeinflusst andere Jellyfin-Clients nicht. Gesehen-Status, Favoriten und Fortschritte bleiben unverändert.

## Entwicklung

Voraussetzungen: Bun ≥ 1.4 und Node.js ≥ 24. Die Vite+-Werkzeuge laufen unter Node. `vp` ist als Projektabhängigkeit installiert; den globalen `vp` braucht man nicht.

```bash
bun install            # Abhängigkeiten (bun.lock ist maßgeblich)
bun run dev            # vp dev – Dev-Server, auch im LAN erreichbar (Tablet-Test)
bun run check          # vp check (Oxfmt + Oxlint + Typprüfung) und svelte-check
bun run test           # vp test (Vitest)
bun run build          # vp build → dist/
bun run preview        # vp preview – Produktionsbuild lokal ansehen
```

Mit installiertem globalem `vp` funktionieren die Befehle auch direkt (`vp dev`, `vp check`, `vp test`, `vp build`). Formatierungsfehler korrigiert `vp check --fix`.

### Lokaler Test-Server

`scripts/test-server.sh` startet per Podman einen Jellyfin-Server unter `http://127.0.0.1:8096` mit generierten Testmedien. Logins: `admin`/`admin` und `zweit`/`zweit`.

```bash
bash scripts/test-server.sh up          # erzeugen/starten (idempotent)
bash scripts/test-server.sh add-season  # Staffel 2 zu „Testserie“ hinzufügen (Szenario „neue Staffel“)
bash scripts/test-server.sh down        # Container entfernen, Daten behalten
bash scripts/test-server.sh reset       # Container und Daten löschen
```

## Deployment mit Docker

```bash
docker compose up -d --build
```

- **Build-Stage:** `ghcr.io/voidzero-dev/vite-plus`. Läuft `vp install --frozen-lockfile`, dann `vp check`, `svelte-check`, `vp test` und `vp build`.
- **Runtime-Stage:** `nginx-unprivileged` (uid 101, Port 8080, kein Bun/Node). Sie bietet:
  - SPA-Fallback für direkte Aufrufe von Unterseiten;
  - Langzeit-Cache nur für die gehashten Dateien in `/assets/`. `index.html`, `config.json` und `sw.js` werden nicht langfristig gecacht;
  - Healthcheck unter `/healthz`;
  - restriktive CSP und weitere Sicherheits-Header.

Konfiguration über Umgebungsvariablen, z. B. in einer `.env`-Datei neben `compose.yaml`:

| Variable       | Standard | Bedeutung                                                                                      |
| -------------- | -------- | ---------------------------------------------------------------------------------------------- |
| `JAILFIN_PORT` | `8080`   | Host-Port                                                                                      |
| `JELLYFIN_URL` | leer     | Vorbelegung des Server-Felds im Login (wird beim Containerstart in `/config.json` geschrieben) |

`JELLYFIN_URL` ist eine öffentliche Laufzeitkonfiguration. Tokens oder Passwörter gehören **nie** in Build- oder Umgebungsvariablen. Jeder Benutzer meldet sich selbst an.

### Netzwerk, CORS, HTTPS

- Der Browser spricht **direkt** mit Jellyfin. Jellyfin erlaubt CORS standardmäßig (`Access-Control-Allow-Origin: *`); das ist mit Jellyfin 12.3 getestet.
- Wird Jailfin über HTTPS ausgeliefert, muss auch Jellyfin per HTTPS erreichbar sein. Sonst blockiert der Browser die Verbindung (Mixed Content); die App zeigt dafür eine eigene Fehlermeldung.
- Hinter einem vorhandenen Reverse Proxy das Port-Mapping in `compose.yaml` entfernen, das Proxy-Netz einbinden (siehe Kommentar) und auf `jailfin:8080` routen. Läuft Jellyfin unter derselben Domain (z. B. `/jellyfin`), gibt man im Login einfach diese Adresse an.

## Sicherheit

- Das Passwort wird nur für die Anmeldung verwendet und nie gespeichert. Das Jellyfin-Zugriffstoken liegt im `localStorage`, damit die Sitzung wiederaufgenommen werden kann. Das ist ein bewusster Kompromiss: Die CSP lässt Skripte nur von der eigenen Origin zu und begrenzt so das XSS-Risiko.
- Beim Abmelden wird das Token serverseitig widerrufen.
- Medien-Streams enthalten das Token als URL-Parameter (`api_key`), weil `<video>` keine Header senden kann. Das machen die offiziellen Jellyfin-Web-Clients genauso. Bild-URLs enthalten kein Token. Untertitel werden per `fetch` mit Header geladen.

## Projektstruktur

```
src/
  lib/jellyfin/   SDK-Client, Sitzung, Fehlertexte, Abfragen, Bild-URLs
  lib/nextup/     Paging/Filter (nextup.ts), IndexedDB-Store, reaktiver Zustand
  lib/player/     Geräteprofil, PlaybackInfo-Aushandlung, Fortschrittsmeldungen
  lib/            Router, i18n (Deutsch), Formatierung, Toasts
  components/     UI-Bausteine (Karten, Raster, Action-Sheet, …)
  routes/         Seiten (Start, Bibliothek, Suche, Details, Player, Einstellungen)
docker/           nginx-Konfiguration, Laufzeit-Konfigurationsskript
```

## Offene Punkte

- Mit echten Mediendateien auf dem Zieltablet (iPad oder Android) prüfen: Codecs, Untertitel, PWA-Verhalten. Getestet ist bisher nur mit Chromium und synthetischen Testdateien.
- Ausblendungen zwischen Geräten synchronisieren (P1). Dafür ist eine zentrale Ablage nötig, siehe PRD 4.3.
