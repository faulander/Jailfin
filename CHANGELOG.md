# Changelog

Alle nennenswerten Änderungen an diesem Projekt. Versionierung nach [Semantic Versioning](https://semver.org/lang/de/), Format angelehnt an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/).

## [0.3.2] – 2026-10-24

### Behoben

- Die App blieb leer, wenn sie per HTTP über eine LAN-Adresse aufgerufen wurde, weil `crypto.randomUUID` dort nicht verfügbar ist. Es gibt jetzt einen Fallback.

## [0.3.1] – 2026-10-24

### Hinzugefügt

- Untertitel: einstellbare Zeilenbreite („Zeilenumbruch ab Breite“, 30–100 % der Bildbreite in 5er-Schritten, Standard 88 %). Längere Zeilen werden innerhalb dieser Breite umbrochen. Einstellbar im Player und unter _Einstellungen → Untertitel_.

## [0.3.0] – 2026-10-24

### Hinzugefügt

- Zwei zusätzliche Untertitelgrößen („Riesig“, „Maximal“). Alle Stufen wachsen auf großen Displays jetzt weiter mit, statt bei einer festen Obergrenze zu enden.
- Player: Doppelklick bzw. Doppeltipp auf das Bild schaltet Vollbild ein und wieder aus.

### Geändert

- Player: Ein Klick bzw. Tipp auf das Bild pausiert bzw. setzt fort und blendet die Steuerung ein.

### Behoben

- Angefangene Folgen fehlten unter „Weiterschauen“, wenn dieselbe Folge auch unter „Als nächstes“ stand. Sie erscheinen jetzt in beiden Reihen.

## [0.2.0] – 2026-10-24

### Hinzugefügt

- **Weiterschauen:** Titel lassen sich über das ⋮-Menü bzw. per Long-Press ausblenden (mit Rückgängig). Sie erscheinen wieder, sobald du den Titel erneut ansiehst. Verwaltung unter _Einstellungen → Aus „Weiterschauen“ ausgeblendet_. Rein lokal, der Fortschritt auf dem Server bleibt erhalten.
- **Filme & Serien:** Filter „Gesehene ausblenden“ und Sortierung nach Bewertung (Community-Bewertung von Jellyfin, ★ auf den Postern). Die gewählte Ansicht bleibt pro Bibliothek gespeichert.
- **Untertitel-Versatz** im Player (±0,1 s / ±0,5 s, Tasten G/H) für Textuntertitel.
- **Untertitel-Darstellung:** Größe, Abstand vom unteren Rand, Hintergrund, Schriftfarbe und -stärke; im Player und unter _Einstellungen → Untertitel_ mit Vorschau, pro Gerät gespeichert.
- Reihen auf der Startseite haben große Blättern-Buttons und eine breite, greifbare Scrollleiste.

### Geändert

- Textuntertitel rendert Jailfin selbst statt des Browsers (`::cue`), damit Versatz und Darstellung überall gleich funktionieren. Bild-Untertitel brennt weiterhin der Server ein.
- Lokale Datenbank auf Version 2: ein gemeinsamer Speicher für alle Ausblendungen. Bestehende ausgeblendete Serien werden automatisch übernommen.

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

[0.3.2]: https://github.com/faulander/Jailfin/releases/tag/v0.3.2
[0.3.1]: https://github.com/faulander/Jailfin/releases/tag/v0.3.1
[0.3.0]: https://github.com/faulander/Jailfin/releases/tag/v0.3.0
[0.2.0]: https://github.com/faulander/Jailfin/releases/tag/v0.2.0
[0.1.0]: https://github.com/faulander/Jailfin/releases/tag/v0.1.0
