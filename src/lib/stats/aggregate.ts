/**
 * Auswertung des Wiedergabeverlaufs aus dem Jellyfin-Plugin „Playback Reporting“.
 * Reine Funktionen (ohne Netzwerk), damit sie testbar sind.
 */

export type PlayMethod = "direct" | "stream" | "transcode";

export interface PlayRecord {
  /** Beginn der Wiedergabe (Epoch-ms, UTC) */
  at: number;
  userId: string;
  itemId: string;
  type: "Movie" | "Episode" | "Other";
  /** Serie (nur bei Folgen) */
  series?: string;
  /** Anzeigename: Filmtitel bzw. „S01E02 · Titel“ */
  title: string;
  method: PlayMethod;
  /** z. B. „Transcode (v:h264 a:aac)“ */
  methodDetail: string;
  client: string;
  device: string;
  /** Gesehene Sekunden */
  seconds: number;
}

/** Das Plugin speichert die lokale Serverzeit („2026-10-30 13:14:59.6637135“). */
export function parseServerDate(value: string, serverOffsetSeconds: number): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?/.exec(value);
  if (!match) return Number.NaN;
  const [, y, mo, d, h, mi, s, frac] = match;
  const ms = frac ? Number(frac.slice(0, 3).padEnd(3, "0")) : 0;
  return Date.UTC(+y!, +mo! - 1, +d!, +h!, +mi!, +s!, ms) - serverOffsetSeconds * 1000;
}

/** Gegenrichtung für SQL-Filter: Zeitpunkt → lokale Serverzeit als Text. */
export function formatServerDate(at: number, serverOffsetSeconds: number): string {
  return new Date(at + serverOffsetSeconds * 1000).toISOString().slice(0, 19).replace("T", " ");
}

/** Folgen heißen „Serie - s01e02 - Titel“. */
export function splitEpisodeName(
  name: string,
): { series: string; code: string; title: string } | undefined {
  const match = /^(.*) - s(\d+)e(\d+) - (.*)$/.exec(name);
  if (!match) return undefined;
  const [, series, season, episode, title] = match;
  return {
    series: series!,
    code: `S${season!.padStart(2, "0")}E${episode!.padStart(2, "0")}`,
    title: title!,
  };
}

export function classifyMethod(value: string): PlayMethod {
  if (value.startsWith("Transcode")) return "transcode";
  if (value === "DirectStream") return "stream";
  return "direct";
}

const COLUMNS = [
  "DateCreated",
  "UserId",
  "ItemId",
  "ItemType",
  "ItemName",
  "PlaybackMethod",
  "ClientName",
  "DeviceName",
  "PlayDuration",
] as const;

/** Zeilen der Custom-Query (alle Werte als Text) in Datensätze umwandeln. */
export function parseRows(
  columns: string[],
  rows: string[][],
  serverOffsetSeconds: number,
): PlayRecord[] {
  const index = Object.fromEntries(COLUMNS.map((c) => [c, columns.indexOf(c)])) as Record<
    (typeof COLUMNS)[number],
    number
  >;
  const cell = (row: string[], column: (typeof COLUMNS)[number]) => row[index[column]] ?? "";
  return rows.flatMap((row) => {
    const at = parseServerDate(cell(row, "DateCreated"), serverOffsetSeconds);
    if (!Number.isFinite(at)) return [];
    const rawType = cell(row, "ItemType");
    const type = rawType === "Movie" || rawType === "Episode" ? rawType : "Other";
    const name = cell(row, "ItemName");
    const episode = type === "Episode" ? splitEpisodeName(name) : undefined;
    const methodDetail = cell(row, "PlaybackMethod");
    return [
      {
        at,
        userId: cell(row, "UserId"),
        itemId: cell(row, "ItemId"),
        type,
        ...(episode ? { series: episode.series } : {}),
        title: episode ? `${episode.code} · ${episode.title}` : name,
        method: classifyMethod(methodDetail),
        methodDetail,
        client: cell(row, "ClientName"),
        device: cell(row, "DeviceName"),
        seconds: Math.max(0, Number(cell(row, "PlayDuration")) || 0),
      },
    ];
  });
}

/** YYYY-MM-DD in Ortszeit des Browsers */
export function localDay(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface Summary {
  plays: number;
  seconds: number;
  titles: number;
  activeDays: number;
}

export function summarize(records: PlayRecord[]): Summary {
  return {
    plays: records.length,
    seconds: records.reduce((sum, r) => sum + r.seconds, 0),
    titles: new Set(records.map((r) => r.series ?? r.itemId)).size,
    activeDays: new Set(records.map((r) => localDay(r.at))).size,
  };
}

export type Bucket = "day" | "week" | "month";

export interface Timeline {
  /** Beginn jedes Abschnitts (Epoch-ms, lokale Mitternacht) */
  starts: number[];
  movies: number[];
  episodes: number[];
}

function startOf(at: number, bucket: Bucket): number {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  if (bucket === "week") d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Montag
  if (bucket === "month") d.setDate(1);
  return d.getTime();
}

function advance(at: number, bucket: Bucket): number {
  const d = new Date(at);
  if (bucket === "day") d.setDate(d.getDate() + 1);
  else if (bucket === "week") d.setDate(d.getDate() + 7);
  else d.setMonth(d.getMonth() + 1);
  return d.getTime();
}

/** Sinnvolle Abschnittsgröße für einen Zeitraum (höchstens ~120 Balken). */
export function bucketFor(from: number, to: number): Bucket {
  const days = (to - from) / 86_400_000;
  if (days <= 120) return "day";
  if (days <= 730) return "week";
  return "month";
}

/** Wiedergabezeit (Sekunden) je Abschnitt, getrennt nach Filmen und Folgen; lückenlos. */
export function timeline(
  records: PlayRecord[],
  from: number,
  to: number,
  bucket: Bucket,
): Timeline {
  const starts: number[] = [];
  for (let at = startOf(from, bucket); at <= to; at = advance(at, bucket)) starts.push(at);
  const movies = starts.map(() => 0);
  const episodes = starts.map(() => 0);
  const position = new Map(starts.map((s, i) => [s, i]));
  for (const r of records) {
    const i = position.get(startOf(r.at, bucket));
    if (i === undefined) continue;
    if (r.type === "Movie") movies[i]! += r.seconds;
    else episodes[i]! += r.seconds;
  }
  return { starts, movies, episodes };
}

/** Wiedergabezeit nach Wochentag (0 = Montag) und Stunde, in Ortszeit. */
export function heatmap(records: PlayRecord[]): number[][] {
  const grid = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  for (const r of records) {
    const d = new Date(r.at);
    grid[(d.getDay() + 6) % 7]![d.getHours()]! += r.seconds;
  }
  return grid;
}

export interface Ranked {
  key: string;
  label: string;
  plays: number;
  seconds: number;
  /** Ein Item der Gruppe (für Poster/Link) */
  itemId: string;
  lastAt: number;
}

/** Gruppieren und nach Wiedergabezeit sortieren. */
export function rank(
  records: PlayRecord[],
  keyOf: (r: PlayRecord) => string | undefined,
  labelOf: (r: PlayRecord) => string = (r) => keyOf(r) ?? "",
): Ranked[] {
  const groups = new Map<string, Ranked>();
  for (const r of records) {
    const key = keyOf(r);
    if (key === undefined) continue;
    const entry = groups.get(key);
    if (entry) {
      entry.plays += 1;
      entry.seconds += r.seconds;
      if (r.at > entry.lastAt) {
        entry.lastAt = r.at;
        entry.itemId = r.itemId;
      }
    } else {
      groups.set(key, {
        key,
        label: labelOf(r),
        plays: 1,
        seconds: r.seconds,
        itemId: r.itemId,
        lastAt: r.at,
      });
    }
  }
  return [...groups.values()].sort((a, b) => b.seconds - a.seconds || b.plays - a.plays);
}

export const topSeries = (records: PlayRecord[]) =>
  rank(records, (r) => (r.type === "Episode" ? r.series : undefined));
export const topMovies = (records: PlayRecord[]) =>
  rank(
    records,
    (r) => (r.type === "Movie" ? r.itemId : undefined),
    (r) => r.title,
  );
export const byUser = (records: PlayRecord[]) => rank(records, (r) => r.userId);
export const byClient = (records: PlayRecord[]) => rank(records, (r) => r.client || "?");
export const byDevice = (records: PlayRecord[]) => rank(records, (r) => r.device || "?");
export const byMethod = (records: PlayRecord[]) => rank(records, (r) => r.method);
