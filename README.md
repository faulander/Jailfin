# Jailfin

Persönlicher Jellyfin-Client für Browser und PWA, optimiert für Tablets im Querformat. Schwerpunkt: eine brauchbare **„Als nächstes“**-Ansicht, in der sich Serien dauerhaft ausblenden lassen, ohne Daten auf dem Jellyfin-Server zu verändern.

Stack: Svelte 5 (Runes) · TypeScript · reines CSS · Vite+ (`vp`) · Bun · Docker/nginx. Kein eigenes Backend.

## Funktionen

- Anmeldung an einem eigenen Jellyfin-Server (HTTP/HTTPS, Adresse auch ohne Schema), Sitzung bleibt bis zum Abmelden erhalten.
- Startseite: **Als nächstes**, **Weiterschauen**, **Merkliste**, **Zuletzt hinzugefügt**. Eine angefangene Folge erscheint in den ersten beiden Reihen, jeweils mit Fortschrittsbalken. Die Reihen lassen sich wischen, mit großen Pfeil-Buttons blättern oder über eine breite Scrollleiste ziehen.
- **Merkliste:** Filme und Serien über den Merken-Button oben links auf jedem Poster (Übersichten, Suche, Startseite) oder auf der Detailseite vormerken, auch bereits begonnene Serien. Wird nach dem Vormerken weitergeschaut (Folge gesehen bzw. angefangen, Film gestartet, auch in anderen Clients), verlässt der Titel die Merkliste automatisch und steht unter „Als nächstes“ bzw. „Weiterschauen“. Gespeichert wird in den Jellyfin-Anzeigeeinstellungen des Benutzers (DisplayPreferences, Client `jailfin`), also auf allen Geräten gleich und ohne eigenes Backend.
- **Favoriten:** Herz-Button auf jedem Poster oder „Favorit“ auf der Detailseite (Jellyfin-Favoriten, in allen Clients sichtbar); eigener Navigationspunkt „Favoriten“ mit Umschalter Serien/Filme und Filter „Nur Favoriten“ in Filme/Serien.
- **Bewertungen auf Postern:** IMDb/Community (★) unten rechts, Rotten Tomatoes (RT %) unten links, sofern Jellyfin einen Wert hat.
- **Staffel-Vollständigkeit auf der Merkliste:** „S2 7/10“ bzw. „S2 ✓“ unten links auf vorgemerkten Serien, Finale-Datum unter dem Titel; unvollständige Staffeln stehen hinten. Geplante Folgen liefert TVmaze (`api.tvmaze.com`, ohne Schlüssel), vorhandene Jellyfin. Die TVmaze-ID kommt aus den Jellyfin-Provider-IDs, ersatzweise über IMDb- bzw. TheTVDB-ID.
- **Gesehen markieren:** ganze Serie, gewählte Staffel oder einzelne Folge auf der Serienseite. Markierungen in Jailfin nehmen Serien nicht von der Merkliste.
- **Statistik:** Wiedergabezeit, meistgesehene Serien und Filme, Verlauf; für Administratoren mit dem Plugin „Playback Reporting“ zusätzlich alle Benutzer, Uhrzeiten, Apps, Geräte, Transkodierung und laufende Wiedergaben (siehe unten).
- Serien aus „Als nächstes“ ausblenden: über das ⋮-Menü bzw. per Long-Press auf der Karte oder auf der Serienseite. Danach kann die Aktion rückgängig gemacht werden. Verwalten lassen sich die Ausblendungen unter _Einstellungen → Ausgeblendete Serien_.
- Titel aus „Weiterschauen“ ausblenden (⋮-Menü bzw. Long-Press). Sie kommen zurück, sobald du sie erneut ansiehst; verwalten unter _Einstellungen → Aus „Weiterschauen“ ausgeblendet_.
- Filme und Serien als Raster mit inkrementellem Nachladen, Sortierung nach Titel, Jahr, Hinzufügedatum oder Bewertung und den Filtern „Genres“ (mehrere, ODER), „Jahr“ (`<1960`, `>1985`, `=2025`, `<=1999`, `>=2000`, `1980-1989`; Erscheinungs- bzw. Erstausstrahlungsjahr), „Gesehene ausblenden“ (Serien gelten als gesehen, wenn alle Folgen gesehen sind) und „Nur Favoriten“. Die gewählte Ansicht bleibt pro Bibliothek gespeichert. Dazu kommen eine Suche mit Debouncing sowie Detailseiten mit Staffeln, Episoden und Gesehen-Status.
- Player:
  - Wiedergabe: Direct Play, bei Bedarf Transcoding über HLS (iPad nativ, sonst hls.js); Fortsetzen an der gespeicherten Position.
  - Bedienung: Klick/Tipp aufs Bild pausiert bzw. setzt fort, Doppelklick/-tipp schaltet Vollbild um. Dazu Spulen −10/+30 s, Lautstärke, Vollbild-Button, Tastatur (Leertaste/K, ←/→, F, M, G/H für Untertitel-Versatz).
  - Spuren: Wahl von Audiospur und Untertiteln. Alle gängigen Untertitel rendert Jailfin selbst, damit der Server nicht transcodieren muss: SRT & Co. (WebVTT), ASS/SSA (in Text umgewandelt, ohne Positionierung/Effekte) und PGS-Bilduntertitel (libpgs). Für Textuntertitel gibt es Versatz (±0,1/±0,5 s) und einstellbare Darstellung (Größe, Position, Zeilenbreite in % der Bildbreite, Hintergrund, Farbe, Schriftstärke; auch unter _Einstellungen → Untertitel_); PGS hat Versatz, aber keinen eigenen Stil. Darstellung und Versatz (pro Serie bzw. Film) werden gemerkt und in den Jellyfin-Benutzereinstellungen gespeichert – gleich auf allen Geräten und Adressen. Nur seltene Formate (z. B. DVD-Untertitel) brennt der Server ein.
  - Status: meldet Start, Fortschritt und Stopp an Jellyfin.
  - Am Ende einer Folge: „Nächste Folge“ (kein Autoplay).
  - Fehler: Scheitert Direct Play, weicht der Player automatisch auf Transcoding aus.
- Installierbar als PWA. Der Service Worker cacht nur die App-Hülle, keine Medien und keine API-Antworten.

## „Als nächstes“: Funktionsweise und Grenzen

- Grundlage ist der Next-Up-Endpunkt von Jellyfin (`/Shows/NextUp`, inklusive angefangener Folgen). Der Client lädt **alle Seiten** und filtert erst danach. Ausblendungen verdrängen deshalb keine späteren Ergebnisse.
- Ausblendungen werden pro **Server-ID + Benutzer-ID + Liste + ID** (SeriesId für „Als nächstes“, ItemId für „Weiterschauen“) in IndexedDB gespeichert: DB `jailfin`, Store `hidden`, versioniert über `DB_VERSION`/`migrate` in `src/lib/hidden/store.ts`. Neue Staffeln oder Server-Updates holen eine ausgeblendete Serie nicht zurück.
- Die Ausblendung ist eine **reine Anzeigepräferenz dieses Browsers bzw. dieser PWA-Installation**. Sie wird nicht zwischen Geräten synchronisiert und beeinflusst andere Jellyfin-Clients nicht. Gesehen-Status, Favoriten und Fortschritte bleiben unverändert.

## Statistik und das Plugin „Playback Reporting“

Jailfin hat kein eigenes Backend, zeichnet also selbst nichts auf. Den vollständigen Wiedergabeverlauf liefert das offizielle Jellyfin-Plugin **Playback Reporting** (Dashboard → Plugins → Katalog → „Playback Reporting“ installieren, Jellyfin neu starten). Es protokolliert ab der Installation jede Wiedergabe aller Clients; Jailfin liest diese Daten über die Abfrage-Schnittstelle des Plugins (nur `SELECT`).

- Die Plugin-API ist nur für **Administratoren** freigegeben. Nur sie sehen den Verlauf aller Benutzer, den Benutzerfilter, „Wann geschaut wird“, Apps, Geräte, Wiedergabeart und „Gerade läuft“.
- Andere Benutzer (bzw. alle, solange das Plugin fehlt) sehen ihre eigene Statistik aus den Jellyfin-Benutzerdaten. Dort ist pro Titel nur die letzte Wiedergabe bekannt; die Wiedergabezeit ist Laufzeit × Anzahl der Wiedergaben, und nachträglich als gesehen markierte Titel zählen mit.
- Zeitangaben speichert das Plugin in der lokalen Serverzeit; Jailfin rechnet sie in die Zeitzone des Browsers um.

## Bewertungen (Sortierung und Poster)

Jellyfin kennt kein eigenes IMDb-Feld. Sortierung und Poster-Badge nutzen die **Community-Bewertung** des Items. Das ist die IMDb-Wertung, wenn auf dem Server der OMDb-Metadatenanbieter aktiv ist (in der Bibliothek vor TMDb priorisieren), sonst die TMDb-Wertung. Die Kritiker-Bewertung (Rotten Tomatoes) liefert ebenfalls nur OMDb.

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

| Variable             | Standard | Bedeutung                                                                                                                               |
| -------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `JAILFIN_PORT`       | `8080`   | Host-Port                                                                                                                               |
| `JELLYFIN_URL`       | leer     | Vorbelegung des Server-Felds im Login (wird beim Containerstart in `/config.json` geschrieben)                                          |
| `JELLYFIN_LOCAL_URL` | leer     | Lokale (LAN-)Adresse, z. B. `http://192.168.1.5:8096`. Wird bevorzugt, wenn erreichbar; bestehende Sitzungen übernehmen sie automatisch |

`JELLYFIN_URL` ist eine öffentliche Laufzeitkonfiguration. Tokens oder Passwörter gehören **nie** in Build- oder Umgebungsvariablen. Jeder Benutzer meldet sich selbst an.

### Netzwerk, CORS, HTTPS

- Der Browser spricht **direkt** mit Jellyfin. Jellyfin erlaubt CORS standardmäßig (`Access-Control-Allow-Origin: *`); das ist mit Jellyfin 12.3 getestet.
- Wird Jailfin über HTTPS ausgeliefert, muss auch Jellyfin per HTTPS erreichbar sein. Sonst blockiert der Browser die Verbindung (Mixed Content); die App zeigt dafür eine eigene Fehlermeldung.
- **Lokale Adresse:** Liegen Jailfin und Jellyfin im selben Netz, lässt sich zusätzlich eine LAN-Adresse hinterlegen (Login oder _Einstellungen → Verbindung_). Jailfin prüft beim Start, nach Netzwechsel und bei Rückkehr in die App, ob sie erreichbar ist und zum selben Server gehört (Server-ID), und nutzt sie dann für API, Bilder und Streams. So läuft der Stream nicht über Tunnel oder Proxy. Eine `http://`-Adresse ist nur nutzbar, wenn Jailfin selbst per `http://` geöffnet wird.
- Hinter einem vorhandenen Reverse Proxy das Port-Mapping in `compose.yaml` entfernen, das Proxy-Netz einbinden (siehe Kommentar) und auf `jailfin:8080` routen. Läuft Jellyfin unter derselben Domain (z. B. `/jellyfin`), gibt man im Login einfach diese Adresse an.

## Sicherheit

- Das Passwort wird nur für die Anmeldung verwendet und nie gespeichert. Das Jellyfin-Zugriffstoken liegt im `localStorage`, damit die Sitzung wiederaufgenommen werden kann. Das ist ein bewusster Kompromiss: Die CSP lässt Skripte nur von der eigenen Origin zu und begrenzt so das XSS-Risiko.
- Beim Abmelden wird das Token serverseitig widerrufen.
- Medien-Streams enthalten das Token als URL-Parameter (`api_key`), weil `<video>` keine Header senden kann. Das machen die offiziellen Jellyfin-Web-Clients genauso. Bild-URLs enthalten kein Token. Untertitel werden per `fetch` mit Header geladen.

## Projektstruktur

```
src/
  lib/jellyfin/   SDK-Client, Sitzung, Fehlertexte, Abfragen, Paging, Bild-URLs
  lib/hidden/     Ausblendungen: IndexedDB-Store (mit Migrationen), Filter, reaktiver Zustand
  lib/player/     Geräteprofil, PlaybackInfo-Aushandlung, Fortschrittsmeldungen, Untertitel-Stil
  lib/            Router, i18n (Deutsch), Formatierung, Toasts
  components/     UI-Bausteine (Karten, Raster, Action-Sheet, …)
  routes/         Seiten (Start, Bibliothek, Suche, Details, Player, Einstellungen)
docker/           nginx-Konfiguration, Laufzeit-Konfigurationsskript
```

## Offene Punkte

- Mit echten Mediendateien auf dem Zieltablet (iPad oder Android) prüfen: Codecs, Untertitel, PWA-Verhalten. Getestet ist bisher nur mit Chromium und synthetischen Testdateien.
- Ausblendungen zwischen Geräten synchronisieren (P1). Dafür ist eine zentrale Ablage nötig, siehe PRD 4.3.
