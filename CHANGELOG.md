# Changelog

Alle nennenswerten Änderungen an diesem Projekt. Versionierung nach [Semantic Versioning](https://semver.org/lang/de/), Format angelehnt an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/).

## [0.1.0] – 2026-10-24

Erste nutzbare Version (MVP gemäß PRD).

### Hinzugefügt

- Anmeldung an Jellyfin (HTTP/HTTPS) mit Sitzungswiederaufnahme und Abmelden.
- Startseite mit „Als nächstes“, „Weiterschauen“ und „Zuletzt hinzugefügt“.
- Serien dauerhaft aus „Als nächstes“ ausblenden (lokal pro Server und Benutzer, IndexedDB), mit Rückgängig und Verwaltung in den Einstellungen.
- Film- und Serienbibliotheken mit Sortierung und inkrementellem Nachladen, Suche und Detailseiten mit Staffeln und Folgen.
- Videoplayer mit Direct Play bzw. HLS-Transcoding, Fortsetzen, Audio- und Untertitelwahl, Fortschrittsmeldungen an Jellyfin und „Nächste Folge“.
- Installierbare PWA.
- Docker-Image (nginx, ohne Root-Rechte) und `compose.yaml`.

[0.1.0]: https://github.com/faulander/Jailfin/releases/tag/v0.1.0
