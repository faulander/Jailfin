import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";

/** Eintrag der Merkliste: ein Film oder eine Serie, die man als Nächstes anschauen möchte. */
export interface WatchlistEntry {
  id: string;
  type: "Movie" | "Series";
  /** ISO-8601 */
  addedAt: string;
}

/** Robustes Einlesen (Daten liegen als JSON-String in den Jellyfin-Anzeigeeinstellungen). */
export function parseWatchlist(raw: string | null | undefined): WatchlistEntry[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    return value.flatMap((entry: Partial<WatchlistEntry>) => {
      if (!entry || typeof entry.id !== "string" || seen.has(entry.id)) return [];
      if (entry.type !== "Movie" && entry.type !== "Series") return [];
      seen.add(entry.id);
      return [{ id: entry.id, type: entry.type, addedAt: String(entry.addedAt ?? "") }];
    });
  } catch {
    return [];
  }
}

/** Was gerade angefangen ist (aus „Als nächstes“ und „Weiterschauen“). */
export interface Activity {
  /** Serien mit gesehener oder angefangener Folge */
  seriesIds: ReadonlySet<string>;
  /** Angefangene Filme/Folgen */
  itemIds: ReadonlySet<string>;
}

/**
 * Ein vorgemerkter Titel gilt als begonnen – und verlässt damit die Merkliste –, sobald
 * eine Folge der Serie gesehen bzw. angefangen oder der Film gestartet wurde. Dann taucht
 * er unter „Als nächstes“ bzw. „Weiterschauen“ auf.
 */
export function isStarted(item: BaseItemDto, activity: Activity): boolean {
  const data = item.UserData;
  if (!item.Id) return false;
  if (data?.Played) return true;
  if (item.Type === "Series") {
    return (data?.PlayedPercentage ?? 0) > 0 || activity.seriesIds.has(item.Id);
  }
  return (data?.PlaybackPositionTicks ?? 0) > 0 || activity.itemIds.has(item.Id);
}

/** Aktivität aus den Startseiten-Listen ableiten. */
export function activityFrom(...lists: (BaseItemDto[] | undefined)[]): Activity {
  const seriesIds = new Set<string>();
  const itemIds = new Set<string>();
  for (const item of lists.flat()) {
    if (!item?.Id) continue;
    const started = item.UserData?.Played || (item.UserData?.PlaybackPositionTicks ?? 0) > 0;
    if (started) itemIds.add(item.Id);
    // Next Up enthält nur Serien, von denen schon etwas gesehen wurde.
    if (item.SeriesId) seriesIds.add(item.SeriesId);
  }
  return { seriesIds, itemIds };
}
