# Changelog

Alle nennenswerten Änderungen an diesem Projekt. Versionierung nach [Semantic Versioning](https://semver.org/lang/de/), Format angelehnt an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/).

## [0.7.1] – 2026-10-30

### Behoben

- Serienseite: Die Staffel-Auswahl war in großen Fenstern unsichtbar, wenn die Beschreibung kurz ist. Das Hintergrundbild des Kopfbereichs ragte dann über die Tabs und verdeckte sie, sodass nur die vorausgewählte Staffel sichtbar war.

### Geändert

- Staffel-Tabs sind als Schaltflächen erkennbar (umrandet, gewählte farbig), heißen einheitlich „Staffel N“ (statt gemischt „Season 1“/„Staffel 2“ aus den Metadaten) und zeigen die Zahl der vorhandenen Folgen.

## [0.7.0] – 2026-10-30

### Hinzugefügt

- **Gesehen markieren für Staffeln und Folgen:** Auf der Serienseite gibt es jetzt „Staffel als gesehen markieren“ für die gewählte Staffel und an jeder Folge einen Gesehen-Schalter (zusätzlich zum bisherigen Schalter für die ganze Serie). Markierungen in Jailfin nehmen eine Serie nicht von der Merkliste: Ihr Stand wird neu festgehalten, damit man z. B. Staffel 1 nachtragen und auf Staffel 2 warten kann.
- **Staffel-Vollständigkeit auf der Merkliste:** Serien zeigen unten links den Stand der aktuellen Staffel, z. B. „S2 7/10“ (7 von 10 geplanten Folgen auf dem Server, orange) oder „S2 ✓“ (vollständig, grün). Läuft die Staffel noch, steht unter dem Titel das Datum des Finales. Die geplanten Folgen kommen von TVmaze (öffentliche API ohne Schlüssel, 6 Stunden zwischengespeichert), die vorhandenen von Jellyfin.
- Die Merkliste zeigt Fertiges zuerst: Serien mit unvollständiger aktueller Staffel stehen hinten.

## [0.6.2] – 2026-10-30

### Geändert

- **Beide Bewertungen auf Postern, ohne Einstellung:** IMDb/Community (★) unten rechts, Rotten Tomatoes (RT %) unten links, jeweils nur wenn Jellyfin einen Wert hat. Die Auswahl unter _Einstellungen → Anzeige_ entfällt.

## [0.6.1] – 2026-10-30

### Hinzugefügt

- **Hinweis auf neue Versionen:** Eine geöffnete Jailfin-Seite bzw. installierte App erkennt nach einem Deployment, dass eine neue Version bereitliegt, und bietet „Neu laden“ an. Geprüft wird beim Zurückkehren in die App und alle 15 Minuten. Bisher lief eine offene Seite bis zum manuellen Neuladen mit der alten Version weiter.

## [0.6.0] – 2026-10-30

### Hinzugefügt

- **Bewertung auf Postern:** unten rechts auf jedem Film- und Serienposter (Übersichten, Suche, Startseite). Einstellbar unter _Einstellungen → Anzeige_: „IMDb / Community“ (Standard; die Community-Bewertung aus Jellyfin, also IMDb, wenn der OMDb-Anbieter aktiv ist, sonst TMDb), „Kritiker (Rotten Tomatoes)“ oder „Aus“. Gespeichert mit dem Jellyfin-Konto.

### Behoben

- Player: Die Leertaste wird jetzt in der Capture-Phase für keydown, keypress und keyup abgefangen, und ein fokussierter Steuerungs-Button verliert den Fokus. Damit kann sie in keinem Browser mehr einen Button (z. B. Vollbild) auslösen, auch nicht in Firefox.

## [0.5.6] – 2026-10-30

### Geändert

- **Merkliste auch für begonnene Serien und Filme:** Bisher fehlte der Merken-Button bei Titeln, die schon angefangen waren (z. B. Serien unter „Als nächstes“ wie MobLand). Ein auf der Detailseite gemerkter Titel verschwand sofort wieder. Jetzt lässt sich alles vormerken. Ein Titel verlässt die Merkliste erst, wenn **nach dem Vormerken** weitergeschaut wird: eine weitere Folge gesehen oder angefangen bzw. der Film gestartet, auch in anderen Clients. Bestehende Einträge behalten die bisherige Regel.

## [0.5.5] – 2026-10-27

### Behoben

- Player: Die Leertaste schaltete nach einem Klick auf den Vollbild-Button (bzw. einen anderen Button) in manchen Browsern weiter diesen Button um, statt zu pausieren. Buttons behalten nach Maus-/Touch-Klicks keinen Fokus mehr, und die Leertaste wird auch beim Loslassen abgefangen.

## [0.5.4] – 2026-10-27

### Geändert

- **Untertitel-Einstellungen bleiben erhalten:** Die Darstellung (Größe, Position, Zeilenbreite, Hintergrund, Farbe, Schrift) wird zusätzlich in den Jellyfin-Benutzereinstellungen gespeichert. Sie gilt damit auch über verschiedene Adressen (LAN-IP bzw. Domain), Browser, installierte App und Geräte hinweg. Bisher war sie pro Browser/Adresse getrennt.
- **Untertitel-Versatz wird gemerkt:** pro Serie (für alle Folgen) bzw. pro Film, und beim nächsten Abspielen automatisch angewendet. Bisher begann jede Datei bei 0.

## [0.5.3] – 2026-10-27

### Behoben

- Player: Die Leertaste (und K) pausiert bzw. setzt jetzt immer fort. Bisher löste sie nach einem Mausklick auf einen Steuerungs-Button (z. B. „10 s zurück“, „Stumm“) diesen Button erneut aus. Gedrückt gehaltene Taste schaltet nicht mehr mehrfach um.

## [0.5.2] – 2026-10-25

### Hinzugefügt

- **Favorit aus der Übersicht:** Jedes Poster hat unter dem Merken-Button einen Herz-Button, der den Titel als Jellyfin-Favorit markiert bzw. die Markierung entfernt (Folgen-Poster: die Serie). Die Reihe „Favoriten“ auf der Startseite aktualisiert sich sofort.

### Geändert

- Ein Favoriten-Tipp im Filme/Serien-Raster lädt die Liste nicht mehr neu und behält die Scrollposition. Gefilterte Ansichten werden beim nächsten Aufruf frisch geladen.

## [0.5.1] – 2026-10-25

### Hinzugefügt

- **Merken aus der Übersicht:** Jedes Poster (Filme, Serien, Suche, Startseiten-Reihen) hat oben links einen Merken-Button. Ein Tipp setzt den Titel auf die Merkliste oder nimmt ihn wieder herunter, ohne die Detailseite zu öffnen. Eine neu hinzugefügte Folge steht dabei für ihre Serie. Bereits begonnene Titel zeigen den Button nicht, da sie ohnehin unter „Als nächstes“ bzw. „Weiterschauen“ stehen.

## [0.5.0] – 2026-10-25

### Hinzugefügt

- **Merkliste:** Filme und Serien über „Merken“ auf der Detailseite vormerken. Sie erscheinen in einer eigenen Reihe „Merkliste“ auf der Startseite. Sobald eine Folge der Serie gesehen bzw. angefangen oder der Film gestartet ist, verlässt der Titel die Merkliste automatisch, auch wenn auf einem anderen Gerät oder Client geschaut wurde; er steht dann unter „Als nächstes“ bzw. „Weiterschauen“. Gespeichert wird in den Jellyfin-Anzeigeeinstellungen des Benutzers, also auf allen Geräten gleich.
- **Favoriten:** Filme und Serien (auch Folgen) auf der Detailseite als Favorit markieren (Jellyfin-Favoriten). Dazu eine Reihe „Favoriten“ auf der Startseite und der Filter „Nur Favoriten“ in Filme/Serien.

### Behoben

- Nach „Als gesehen markieren“, nach Favoriten-Änderungen oder nach einer Wiedergabe zeigten Filme/Serien mit Filter „Gesehene ausblenden“ veraltete Ergebnisse aus dem Zwischenspeicher. Die Listen werden jetzt neu geladen.

## [0.4.0] – 2026-10-24

Schwerpunkt: weniger Transcoding auf dem Server, damit Streams nicht mehr ruckeln.

### Hinzugefügt

- **Lokale Server-Adresse:** Optional beim Login bzw. unter _Einstellungen → Verbindung_. Jailfin nutzt sie automatisch, wenn sie erreichbar ist und zum selben Jellyfin-Server gehört; sonst die öffentliche Adresse. Neu geprüft wird beim Start, nach Netzwechsel und bei Rückkehr in die App. Vorbelegung per `JELLYFIN_LOCAL_URL`. Eine http-Adresse funktioniert nur, wenn Jailfin selbst per http geöffnet ist.
- **PGS-Untertitel** (Blu-ray-Bilduntertitel) rendert Jailfin selbst (libpgs), statt sie vom Server ins Bild einbrennen zu lassen. Versatz funktioniert auch hier.
- **ASS/SSA-Untertitel** wandelt Jailfin selbst in Text-Untertitel um (Zeiten, Text, kursiv/fett); auch sie werden nicht mehr eingebrannt.

### Geändert

- Bisher erzwang ein eingebrannter Untertitel Video-Transcoding. Jetzt laufen solche Titel meist per Direct Play, sofern Video- und Audioformat zum Gerät passen.
- HEVC mit 10 bit wird nur noch direkt abgespielt, wenn der Browser es dekodieren kann.
- HLS-Wiedergabe mit größerem Vorlauf-Puffer, geduldigeren Timeouts und automatischer Wiederherstellung nach Netz- oder Decoderfehlern.

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

[0.7.1]: https://github.com/faulander/Jailfin/releases/tag/v0.7.1
[0.7.0]: https://github.com/faulander/Jailfin/releases/tag/v0.7.0
[0.6.2]: https://github.com/faulander/Jailfin/releases/tag/v0.6.2
[0.6.1]: https://github.com/faulander/Jailfin/releases/tag/v0.6.1
[0.6.0]: https://github.com/faulander/Jailfin/releases/tag/v0.6.0
[0.5.6]: https://github.com/faulander/Jailfin/releases/tag/v0.5.6
[0.5.5]: https://github.com/faulander/Jailfin/releases/tag/v0.5.5
[0.5.4]: https://github.com/faulander/Jailfin/releases/tag/v0.5.4
[0.5.3]: https://github.com/faulander/Jailfin/releases/tag/v0.5.3
[0.5.2]: https://github.com/faulander/Jailfin/releases/tag/v0.5.2
[0.5.1]: https://github.com/faulander/Jailfin/releases/tag/v0.5.1
[0.5.0]: https://github.com/faulander/Jailfin/releases/tag/v0.5.0
[0.4.0]: https://github.com/faulander/Jailfin/releases/tag/v0.4.0
[0.3.2]: https://github.com/faulander/Jailfin/releases/tag/v0.3.2
[0.3.1]: https://github.com/faulander/Jailfin/releases/tag/v0.3.1
[0.3.0]: https://github.com/faulander/Jailfin/releases/tag/v0.3.0
[0.2.0]: https://github.com/faulander/Jailfin/releases/tag/v0.2.0
[0.1.0]: https://github.com/faulander/Jailfin/releases/tag/v0.1.0
