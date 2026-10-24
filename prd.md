# Product Requirements Document (PRD)

# Jellyfin Client — persönlicher Streaming-Client

**Status:** Draft v1.1  
**Datum:** 24.10.2026  
**Zielplattform:** Browser / installierbare PWA, Desktop und Tablet  
**Zielgruppe:** zunächst ein privater Nutzer bzw. ein kleiner Haushalt  
**Verbindlicher Stack:** Vite+, Svelte 5, TypeScript, reines CSS, Bun, Docker  
**Priorität:** Ein unkomplizierter Streaming-Client mit einer wirklich brauchbaren „ALS NÄCHSTES“-Ansicht.

## 1. Produktvision

Ein schneller, übersichtlicher, angenehm bedienbarer Jellyfin-Client, der auf die alltägliche Nutzung zum Ansehen von Filmen und Serien fokussiert ist. Die App verwendet einen bestehenden Jellyfin-Server als Quelle für Medien, Benutzer, Metadaten, Wiedergabestatus und Streams. Sie ersetzt weder den Jellyfin-Server noch dessen Administrationsfunktionen.

Das wichtigste Unterscheidungsmerkmal ist **„ALS NÄCHSTES“**: Für bereits begonnene Serien wird die nächste relevante Folge angezeigt. Serien, die der Benutzer nicht weiterverfolgen will, lassen sich gezielt aus dieser Ansicht entfernen, ohne den Wiedergabestatus oder die Bibliothek auf dem Jellyfin-Server zu verändern.

## 2. Ziele und Nicht-Ziele

### Ziele

1. Filme und Serien unkompliziert finden und ansehen.
2. Bereits angefangene Filme und Episoden an der gespeicherten Position fortsetzen.
3. Für begonnene Serien automatisch die nächste Episode anbieten.
4. Unerwünschte Serien dauerhaft aus „ALS NÄCHSTES“ ausblenden und später wieder einblenden können.
5. Wiedergabestatus und Fortschritt mit Jellyfin synchronisieren, damit andere Clients korrekt anschließen können.
6. Eine ruhige, schnelle und für ein großes Tablet aus kurzer Distanz gut nutzbare Oberfläche bieten.
7. So wenig eigene Infrastruktur und Wartungsaufwand wie möglich erzeugen.

### Nicht-Ziele (MVP)

- Ersatz der Jellyfin-Serveradministration, Bibliotheksscans oder Medienverwaltung.
- Eigene Metadatenanbieter oder eigene Benutzerverwaltung.
- Downloads/Offline-Wiedergabe.
- Live-TV, DVR, Musik, Hörbücher oder Fotos.
- Chromecast/AirPlay, Fernbedienungsprotokolle oder Smart-TV-Apps.
- Ein eigener Codec- oder Transcoding-Stack.
- Vollständige Funktionsparität mit allen offiziellen Jellyfin-Clients.

## 3. Nutzer und Plattform

- Primär: Nutzung auf einem großen Tablet (ca. 13 Zoll) zum Film- und Serienschauen, auch mit Bluetooth-Kopfhörern.
- Sekundär: Nutzung im Desktop-Browser unter Linux oder macOS.
- Bedienung: primär Touch, zusätzlich Maus und Tastatur.
- Layout: responsive; Landscape auf Tablets besonders sorgfältig gestalten, Portrait ebenfalls nutzbar.
- Ein Benutzer meldet sich bei seinem eigenen Jellyfin-Server an. Multi-Account-Unterstützung darf vorbereitet sein, ist aber kein zentraler MVP-Use-Case.

## 4. Kernkonzept: „ALS NÄCHSTES“

### 4.1 Bedeutung

Die Ansicht „ALS NÄCHSTES“ zeigt pro relevanter Serie **maximal eine Episode**: die Episode, die der angemeldete Benutzer als Nächstes ansehen sollte. Als Ausgangsbasis wird die Next-Up-Berechnung des Jellyfin-Servers genutzt, nicht eine selbst erfundene Episoden-Reihenfolge.

**Abgrenzung:** „ALS NÄCHSTES“ für Serien ist nicht identisch mit „WEITERSCHAUEN“ für unterbrochene Filme und Episoden. Beide Bereiche sind auf der Startseite vorhanden und können sich bei einer unterbrochenen Serienfolge überschneiden. Die UI soll dies möglichst vermeiden oder klar kennzeichnen.

### 4.2 Pflichtanforderungen

**NU-01 — Automatische Liste (P0)**  
Beim Öffnen der Startseite werden die nächsten Episoden bereits begonnener Serien anhand der Jellyfin-Daten angezeigt.

**NU-02 — Kartendarstellung (P0)**  
Jede Karte zeigt mindestens Serienname, Episodentitel, Staffel-/Folgenkennung (z. B. S02E04), passendes Bild und einen klaren Play-Button. Optional: Laufzeit, Kurzbeschreibung und Fortschritt.

**NU-03 — Direkt abspielen (P0)**  
Ein Klick auf Play öffnet die Episode direkt im Player. Bei einem vorhandenen Fortschritt wird an der gespeicherten Position fortgesetzt bzw. die Fortsetzung angeboten.

**NU-04 — Serie ausblenden (P0)**  
Über das Kontextmenü einer Karte: **„Nicht mehr unter ‚ALS NÄCHSTES‘ anzeigen“**. Die Serie verschwindet sofort aus der Liste. Das ist **kein** Löschen und **kein** Markieren von Folgen als gesehen. Die Änderung betrifft die gesamte Serie, nicht nur die aktuelle Episode.

**NU-05 — Dauerhaftigkeit (P0)**  
Ausgeblendete Serien bleiben nach Reload, Logout/Login und App-Neustart ausgeblendet. Ein späteres Server-Update oder neuer Episodenzugang darf die ausgeblendete Serie nicht automatisch zurückbringen.

**NU-06 — Ausblendungen verwalten (P0)**  
In den Einstellungen gibt es **„Ausgeblendete Serien“**: Liste mit Serienbild/-name und Aktion **„Wieder unter ‚ALS NÄCHSTES‘ anzeigen“**. Bei Wiedereinblendung entscheidet wieder Jellyfin, ob die Serie aktuell eine Next-Up-Episode hat.

**NU-07 — Eindeutiger Bezug (P0)**  
Ausblendungen werden durch stabile Jellyfin-**SeriesId** gespeichert, nicht anhand von Namen. Die Einstellungen sind einem bestimmten Jellyfin-Server und Benutzer zugeordnet, damit gleichnamige Serien und mehrere Accounts nicht verwechselt werden.

**NU-08 — Synchronisierung (P0)**  
Nach Ende einer Folge und nach Rückkehr zum Startbildschirm wird „ALS NÄCHSTES“ neu geladen. Der Player meldet Start, Fortschritt und Ende ordnungsgemäß an Jellyfin.

**NU-09 — Reihenfolge (P1)**  
Standardmäßig wird die vom Jellyfin-Server gelieferte Reihenfolge verwendet. Weitere Sortierungen sind optional und nur vorzusehen, wenn ein klarer Bedarf entsteht.

**NU-10 — Status und leere Ansicht (P0)**  
Lade-, Offline- und Fehlerzustände sowie „Keine weiteren Folgen vorhanden“ werden verständlich dargestellt.

### 4.3 Ausblenden: Speicherung und Grenzen

Jellyfin stellt einen Next-Up-Endpunkt bereit. Eine universell verfügbare, dauerhafte, serienbezogene „Aus Next Up ausschließen“-Einstellung darf **nicht vorausgesetzt** werden.

**MVP-Entscheidung:** Ausblendungen clientseitig pro Server und User als Menge von SeriesIds speichern und bei jeder Next-Up-Antwort herausfiltern.

- Speicherung: bevorzugt IndexedDB oder eine andere persistente lokale Web-Speicherung.
- Das funktioniert zuverlässig innerhalb derselben Browser-/PWA-Installation, **nicht automatisch auf mehreren Geräten**.
- **Spätere Erweiterung (P1):** Falls Ausblendungen zwischen Tablet, Laptop und weiteren Clients synchronisiert werden sollen, braucht es eine kleine zentrale Ablage oder einen nachweislich geeigneten Jellyfin-seitigen Speichermechanismus. Nicht unbemerkt behaupten, dass die Jellyfin-API diese Einstellung bereits synchronisiert.
- „Serie ausblenden“ bleibt ausschließlich eine Darstellungspräferenz dieses Clients; auf die Next-Up-Listen anderer Jellyfin-Clients hat es keinen Einfluss.

### 4.4 Akzeptanzszenarien

1. **Angefangene Serie:** Ich habe S01E01 vollständig gesehen und S01E02 ist verfügbar. Unter „ALS NÄCHSTES“ erscheint S01E02.
2. **Unterbrochene Folge:** Ich habe S01E02 zur Hälfte gesehen. Ich kann sie fortsetzen; sie wird nicht fälschlich durch S01E03 ersetzt. Maßgeblich ist die Next-Up-/Resume-Information von Jellyfin.
3. **Serie abbrechen:** Ich blende eine Serie aus. Sie verschwindet sofort. Nach Neustart bleibt sie ausgeblendet.
4. **Neue Staffel:** Für die ausgeblendete Serie wird eine neue Staffel hinzugefügt. Sie bleibt ausgeblendet.
5. **Rückgängig:** Ich aktiviere die Serie in „Ausgeblendete Serien“ wieder. Falls Jellyfin eine nächste Episode meldet, erscheint sie erneut.
6. **Status unangetastet:** Das Ausblenden verändert weder „gesehen“-Markierungen noch Favoriten, Bibliothekseinträge oder Episodenfortschritte.
7. **Zwei Benutzer:** Ausblendungen von Benutzer A beeinflussen Benutzer B nicht.
8. **Mehr als eine Ergebnisseite:** Auch bei vielen Serien dürfen Ausblendungen nicht dazu führen, dass relevante spätere Ergebnisse wegen eines zu kleinen API-Limits fehlen. Paging vollständig bzw. bedarfsgerecht abarbeiten und danach filtern.

## 5. Standardfunktionen

### 5.1 Verbindung und Anmeldung (P0)

- Jellyfin-Server-URL eingeben (HTTPS unterstützen).
- Mit Jellyfin-Benutzernamen und Passwort authentifizieren.
- Sitzung bei erneutem App-Start wiederverwenden; Abmelden möglich.
- Serververbindung und Authentifizierung mit verständlichen Fehlermeldungen.
- Keine Passwörter dauerhaft speichern; Token möglichst sicher verwalten.

### 5.2 Startseite (P0)

Empfohlene Reihenfolge:

1. **ALS NÄCHSTES** — neue Episode laufender Serien, einschließlich Ausblenden.
2. **WEITERSCHAUEN** — angefangene Filme und Episoden mit Fortschrittsbalken.
3. **ZULETZT HINZUGEFÜGT** — neue Filme und Serien aus den eigenen Bibliotheken.
4. Optional: **FAVORITEN**.

Nicht zu viele konkurrierende Kacheln oder automatisch startende Trailer. Die Startseite soll unmittelbar zum Schauen führen.

### 5.3 Bibliotheken und Navigation (P0)

- Hauptnavigation: **Start**, **Filme**, **Serien**, **Suche**, **Einstellungen**.
- Medienbibliotheken des angemeldeten Jellyfin-Benutzers respektieren.
- Poster-Raster mit gut lesbaren Titeln und sinnvoller Bildauflösung.
- Pagination bzw. inkrementelles Nachladen, ohne alle Medien auf einmal abzurufen.
- Grundlegende Sortierung nach Titel, Erscheinungsjahr, Hinzufügedatum.
- Basisfilter (z. B. Genre, gesehen/ungesehen) als P1.

### 5.4 Suche (P0)

- Globale Suche nach Filmen und Serien.
- Debouncing der Eingabe; Ladezustand und Empty State.
- Ergebnisse nach Medientyp erkennbar, direkter Aufruf der Detailseite.

### 5.5 Detailseiten (P0)

**Film:** Poster/Backdrop, Titel, Erscheinungsjahr, Laufzeit, Beschreibung, Genres soweit vorhanden, „Abspielen/Fortsetzen“, gesehen/ungesehen.

**Serie:** Poster/Backdrop, Beschreibung, Staffelübersicht, Episoden pro Staffel, Kennzeichnung gesehen/ungesehen und Fortschritt, Play-/Fortsetzen-Aktion, optional direkte Aktion „Aus ‚ALS NÄCHSTES‘ ausblenden“.

- Bilder und optionale Metadaten werden defensiv behandelt; fehlende Werte dürfen das Layout nicht zerstören.

### 5.6 Videoplayer (P0)

- Abspielen und Pausieren, Seek, Lautstärke, Vollbild, Vor-/Zurückspringen.
- Wiedergabe an gespeicherter Position fortsetzen.
- Auswahl verfügbarer Audiospuren und Untertitel, soweit das gewählte Playback-Verfahren dies unterstützt.
- Fortschritt und Playback-Start/-Stop an Jellyfin melden.
- Am Ende einer Episode sinnvolle Aktion **„Nächste Folge“**, kein zwingendes Autoplay im MVP.
- Fehlerzustände bei nicht abspielbaren Streams klar anzeigen.
- Direct Play/Direct Stream bevorzugen, soweit Browser und Server dies ermöglichen; serverseitiges Transcoding als Fallback.
- Keine eigene Medien-Decodierung implementieren.

**Wichtige Abnahmebedingung:** Vor Festlegung der Player-Implementierung reale Testdateien auf dem Zieltablet und Desktop prüfen (Container, Video-/Audio-Codecs, externe/eingebettete Untertitel). Browserunterstützung ist nicht identisch mit Unterstützung durch den Jellyfin-Server; insbesondere manche Codec-/Untertitelkombinationen erfordern Transcoding.

### 5.7 Einstellungen (P0/P1)

- Serverinformation, aktiver Benutzer, Abmelden (P0).
- **Ausgeblendete Serien** verwalten (P0).
- Bevorzugte Sprache für Audio/Untertitel, sofern praktikabel (P1).
- Automatischer Start der nächsten Folge als **explizite optionale Einstellung** (P1).
- Anzeigeoptionen (z. B. Postergröße) nur bei tatsächlichem Bedarf (P2).

## 6. UX- und Designanforderungen

- Fokus auf Medien, nicht auf Konfiguration.
- Dark Mode als primäres Design.
- Touch-freundliche Klickflächen, deutlich erkennbare Fokuszustände und ausreichende Kontraste.
- Tablet-Landscape zuerst gestalten, Desktop und Portrait responsiv ableiten.
- Keine Hover-only-Funktionen: Kontextaktionen auch per Touch erreichbar.
- Zurück-Navigation erhält möglichst die vorherige Listenposition.
- Poster-/Backdrop-Bilder lazy laden und passend dimensionieren.
- Keine überladene Startseite, kein unnötiges Autoplay von Vorschauen.
- UI-Texte und Fehlermeldungen zunächst Deutsch; Architektur auf spätere Lokalisierung vorbereiten.

## 7. Technischer Vorschlag

**Verbindlicher Stack (keine alternativen UI-Frameworks):**

- **Svelte 5** mit Runes (`$state`, `$derived`, `$effect`) und **TypeScript**.
- **Vite+** als einheitliche Toolchain (Vite-basierte Entwicklung, Build, Tests, Oxlint und Oxfmt); kein separates, konventionelles Vite-only-Setup.
- **Reines CSS**: CSS-Variablen, moderne Layouts mit Grid/Flexbox, Media Queries, Container Queries wo sinnvoll; **kein Tailwind CSS**, **kein Bootstrap**, **kein DaisyUI**, keine CSS-in-JS-Lösung und keine verpflichtende Komponentenbibliothek.
- **Bun** als festgelegter Package Manager und für Projekt-Skripte bzw. passende serverseitige JavaScript-Ausführung. `bun.lock` versionieren; kein npm-/pnpm-/yarn-Lockfile parallel.
- **Docker** und **Docker Compose** für reproduzierbare Bereitstellung; Multi-Stage-Build mit klarer Trennung von Build- und Laufzeit-Image.
- Bereitstellung: responsive Web-App mit optionaler **PWA**-Installation.
- Jellyfin-Zugriff: offizielles **@jellyfin/sdk** oder ein dünner, sauber gekapselter API-Adapter (nach tatsächlicher Kompatibilität und Wartbarkeit entscheiden).
- Clientseitiger State: Svelte-5-Runes / kleine Svelte-Module ohne unnötiges globales State-Framework.
- Persistenz der ausgeblendeten SeriesIds: IndexedDB (mit Migration-/Versionskonzept) oder begründet einfachere persistente Speicherung.
- **Kein eigenes Backend im MVP**, sofern Jellyfin-CORS, Authentifizierung und Playback aus dem Browser direkt funktionieren. Nicht nur für den Einsatz von Bun einen Backend-Dienst einführen.

### 7.1 Entwicklungs- und Buildvorgaben

- Projekt mit der aktuellen, kompatiblen **Vite+-Toolchain** initialisieren; Svelte-5-Integration nutzen. Kein SvelteKit erforderlich, solange keine serverseitigen Routen gebraucht werden.
- Bun für Installation und Lockfile verwenden; Vite+-Befehle (`vp dev`, `vp check`, `vp test`, `vp build`) als primären Entwicklungsworkflow dokumentieren. Vite+ darf Bun als Package Manager verwalten; die Toolchain selbst kann weiterhin Node zur Ausführung ihrer Werkzeuge benötigen.
- Codeformatierung und Linting über **Vite+ / Oxfmt / Oxlint** statt Prettier und ESLint einrichten. Svelte-/TypeScript-Prüfung mit einem kompatiblen Svelte-Check ergänzen, falls vom aktuellen `vp check` nicht vollständig abgedeckt.
- Styles in klar gegliederten `.css`-Dateien und/oder Svelte-`<style>`-Blöcken. Ein kleines eigenes Designsystem aus Tokens und wiederverwendbaren Komponenten statt CSS-Framework.
- Keine Abhängigkeit von Framework-spezifischen Backend-Features; Jellyfin-API und Player als eigenständige Services kapseln.

### 7.2 Docker und Deployment

- `Dockerfile` mit **Build-Stage** (Bun-Abhängigkeiten, Vite+-Produktionsbuild) und schlanker **Runtime-Stage** (z. B. Nginx für statische Assets). Bun muss im finalen Container **nicht** laufen, solange die Anwendung rein statisch ist.
- `compose.yaml` mit einem Service für den Client, konfigurierbarem Port und optionaler Integration in einen vorhandenen Reverse Proxy.
- SPA-Fallback für direkte Aufrufe von Unterseiten, Cache-Regeln für gehashte Assets und kein langfristiges Caching der `index.html`.
- Healthcheck, sinnvolle Restart-Policy und keine Root-Rechte für den statischen Webserver, soweit das gewählte Image das unterstützt.
- Konfiguration der Jellyfin-URL zur Laufzeit oder beim Build klar dokumentieren; **keine geheimen Tokens oder Passwörter in öffentliche Build-Variablen** schreiben.
- Direkte Client-zu-Jellyfin-Verbindung als Standard. CORS, HTTPS/Mixed Content und Netzwerkzugriff in der tatsächlichen Docker-/Reverse-Proxy-Umgebung testen. Falls erforderlich, einen Reverse-Proxy-Pfad gezielt vorsehen, aber kein implizites Backend hinzufügen.
- Ein dokumentierter Ablauf für lokalen Start, Prüfungen, Tests, Produktionsbuild sowie `docker compose up -d --build` gehört zum Lieferumfang.

### 7.1 API-Bereiche

Die konkreten Methoden und Request-Parameter vor Implementierung gegen die eingesetzte Jellyfin-Version prüfen.

| Funktion | Jellyfin-API-Bereich |
|---|---|
| Anmeldung | Authentication / Users |
| Bibliotheken | User Views / Items |
| Suche und Details | Items / Search |
| Nächste Serienfolge | Shows / NextUp |
| Fortschritt / Fortsetzen | UserData / Resume-Items |
| Playback-Konfiguration | PlaybackInfo / MediaSources |
| Playback-Meldungen | Sessions / Playing (Start, Progress, Stopped) |
| Bilder | Items / Images |

**Referenzen:**
- Jellyfin TypeScript SDK: https://typescript-sdk.jellyfin.org/
- Next-Up-Request: https://typescript-sdk.jellyfin.org/interfaces/generated-client.ShowApiGetNextUpRequest.html
- Jellyfin-Dokumentation: https://jellyfin.org/docs/

### 7.3 Datenmodell für Ausblendungen

Konzeptionell:

```ts
type HiddenSeriesPreference = {
  serverId: string; // stabile Server-Identität, nicht allein der Anzeigename
  userId: string;
  seriesId: string;
  hiddenAt: string; // ISO-8601
};
```

**Wichtig:** Bei mehreren Browsern/Geräten existieren im MVP separate lokale Präferenzen. Eine spätere Synchronisierung muss Konflikte und die Wieder-Einblenden-Aktion korrekt behandeln können.

### 7.4 Sicherheit

- HTTPS-Verbindung zum Jellyfin-Server außerhalb eines ausdrücklich vertrauten lokalen Netzes bevorzugen.
- Keine Zugangsdaten in Logs oder URLs.
- Keine administrativen Server-Tokens hardcoden oder ausliefern.
- Token-Persistenz bewusst abwägen; das Risiko von XSS und browserbasiertem Zugriff berücksichtigen.
- Nur Ressourcen anzeigen, für die der authentifizierte Jellyfin-Benutzer berechtigt ist.
- CORS/Reverse-Proxy-Probleme sauber behandeln; ein optionaler Backend-for-Frontend-Proxy ist nur bei echtem Bedarf eine Architekturentscheidung.

## 8. Nichtfunktionale Anforderungen

| Bereich | Anforderung |
|---|---|
| Performance | Navigation und Bildraster sollen auf einem üblichen aktuellen Tablet flüssig sein. |
| Stabilität | Fehlerhafte Metadaten oder einzelne fehlende Bilder dürfen keine ganze Seite blockieren. |
| Zuverlässigkeit | Ausblendungen müssen lokal zuverlässig persistieren und Playback-Fortschritte korrekt an Jellyfin melden. |
| Wartbarkeit | API, Player, UI und lokale Präferenzen sind klar getrennte Module; Svelte 5, reines CSS und Vite+ bleiben verbindlich. |
| Betrieb | Reproduzierbarer Docker-Build, dokumentiertes Compose-Deployment und Healthcheck. |
| Datenschutz | Keine Drittanbieter-Analytics, keine zusätzlichen externen Accounts. |
| Kompatibilität | Unterstützte Jellyfin-Serverversion festlegen und mit realem Server testen. |
| Zugänglichkeit | Tastaturbedienung, sichtbarer Fokus, ausreichende Kontraste, Touch-Ziele. |

## 9. MVP-Umfang und Prioritäten

### P0 — Muss im ersten verwendbaren Release enthalten sein

- Serververbindung, Login/Logout und Session-Wiederaufnahme.
- Startseite mit „ALS NÄCHSTES“, „WEITERSCHAUEN“, „ZULETZT HINZUGEFÜGT“.
- Serien unter „ALS NÄCHSTES“ dauerhaft ausblenden und in Einstellungen wieder einblenden.
- Film- und Serienbibliotheken, Suche und Detailseiten.
- Videoabspielen, Pause, Seek, Vollbild, Fortsetzen, Audio-/Untertitelauswahl im unterstützten Umfang.
- Jellyfin-Playback-Synchronisierung.
- Tablet-taugliches Layout und Fehlerbehandlung.

### P1 — Nach dem MVP

- Synchronisierung ausgeblendeter Serien über mehrere Geräte hinweg.
- Genres und erweiterte Filter.
- Bevorzugte Audio-/Untertitelsprachen.
- Optionales Autoplay der nächsten Folge.
- Tastaturkürzel und zusätzliche Komfortoptionen.

### P2 — Vorerst nicht eingeplant

- Offline-Modus, native TV-Apps, Casting, Live-TV, Musik, zusätzliche Medienverwaltung.

## 10. Umsetzung in Etappen

**Phase 1 — Fundament**  
Svelte-5-/TypeScript-Projekt mit Vite+, Bun-Lockfile, purem CSS, API-Layer, Serververbindung, Login, Navigation und grundlegenden UI-Komponenten. Dockerfile und Compose-Basis früh anlegen.

**Phase 2 — Bibliothek**  
Filme/Serien auflisten, suchen und Detailseiten mit Staffeln/Episoden aufbauen.

**Phase 3 — Alleinstellungsmerkmal**  
„ALS NÄCHSTES“ via Jellyfin, Ausblenden über SeriesId, persistente Speicherung, Verwaltung ausgeblendeter Serien, Edge-Case-Tests.

**Phase 4 — Wiedergabe**  
PlaybackInfo integrieren, Browserplayer mit serverseitigem Transcoding-Fallback, Playback-Events und Fortsetzen/Next Episode.

**Phase 5 — Qualität und Geräte**  
Auf Zieltablet und Desktop testen, Touch-UX, Untertitel-/Audiowege, Fehlerbehandlung, Performance, PWA-Installation, Vite+-Checks, Docker-Produktionsbuild und Compose-Deployment.

## 11. Definition of Done (MVP)

Das MVP gilt als fertig, wenn der Benutzer:

1. den eigenen Jellyfin-Server verbinden und sich anmelden kann;
2. Filme und Serien finden und ohne unnötige Zwischenschritte abspielen kann;
3. angefangene Inhalte mit korrekt synchronisiertem Fortschritt fortsetzt;
4. unter „ALS NÄCHSTES“ die korrekte nächste Folge seiner begonnenen Serien findet;
5. eine nicht mehr gewünschte Serie mit einer Aktion ausblendet;
6. diese Serie auch nach Neustart und nach Hinzufügen weiterer Staffeln **nicht** mehr dort sieht;
7. sie in den Einstellungen wieder einblenden kann;
8. auf dem vorgesehenen Tablet Video, Ton und Untertitel mit repräsentativen Testdateien zuverlässig verwenden kann;
9. den Client reproduzierbar mit Bun/Vite+ bauen und per Docker Compose starten kann;
10. im gesamten Frontend ausschließlich Svelte 5, TypeScript und pures CSS verwendet werden (ohne Tailwind oder andere CSS-Frameworks).

## 12. Offene Produktentscheidungen

Diese Fragen blockieren den Prototyp **nicht**, sollten aber vor dem produktiven Einsatz entschieden werden:

- **Geräte-Synchronisierung:** Reicht das lokale Ausblenden auf einem Tablet oder soll die Einstellung auch auf MacBook und anderen Clients gelten?
- **Zielgerät:** Android-Tablet oder iPad? Das beeinflusst Codec-/Player-Verhalten und PWA-Grenzen.
- **Automatische nächste Folge:** Standardmäßig deaktiviert; später einschaltbar?
- **Serverzugang:** Gleiche Domain / Reverse Proxy / direkte Jellyfin-URL? CORS und Auth-Persistenz praktisch testen.
- **Jellyfin-Version und Testmedien:** Für einen belastbaren Playback-Test erfassen.

## 13. Erfolgskriterien

- „ALS NÄCHSTES“ zeigt pro nicht ausgeblendeter, fortgesetzter Serie höchstens einen passenden Folgeneintrag.
- Jede Ausblendung wird sofort sichtbar und bleibt bei erneutem Laden erhalten.
- Ausblenden verändert keine Jellyfin-Mediendaten.
- Start, Fortschritt und Ende eines Videos werden korrekt an Jellyfin gemeldet.
- Filme/Serien können auf dem gewählten Tablet in den häufig verwendeten Formaten abgespielt werden.
- Für normale Nutzung ist nach dem Login keine administrative Konfiguration erforderlich.
- `vp check`, Tests und Produktionsbuild sind erfolgreich; das Docker-Image ist reproduzierbar und startet über Compose.
- Das Projekt enthält weder Tailwind, Bootstrap noch DaisyUI; Styles sind pures CSS.
