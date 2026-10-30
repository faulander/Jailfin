import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";

/** Stand beim Vormerken – maßgeblich ist, was danach geschaut wird. */
export interface WatchlistBaseline {
  played?: boolean;
  playedPercentage?: number;
}

/** Eintrag der Merkliste: ein Film oder eine Serie, die man als Nächstes anschauen möchte. */
export interface WatchlistEntry {
  id: string;
  type: "Movie" | "Series";
  /** ISO-8601 */
  addedAt: string;
  /** Fehlt bei Einträgen aus Version 0.5.0–0.5.5 (dort durften nur unbegonnene Titel hinein). */
  baseline?: WatchlistBaseline;
}

export function baselineOf(item: BaseItemDto): WatchlistBaseline {
  return {
    played: !!item.UserData?.Played,
    playedPercentage: item.UserData?.PlayedPercentage ?? 0,
  };
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
      const baseline =
        entry.baseline && typeof entry.baseline === "object"
          ? {
              played: entry.baseline.played === true,
              playedPercentage: Number(entry.baseline.playedPercentage) || 0,
            }
          : undefined;
      return [
        {
          id: entry.id,
          type: entry.type,
          addedAt: String(entry.addedAt ?? ""),
          ...(baseline ? { baseline } : {}),
        },
      ];
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
  /** Zuletzt angeschaut (aus „Weiterschauen“): Serie → spätestes Datum einer ihrer Folgen */
  seriesLastPlayed: ReadonlyMap<string, string>;
}

const after = (date: string | null | undefined, since: string): boolean => {
  const a = Date.parse(date ?? "");
  const b = Date.parse(since);
  return Number.isFinite(a) && Number.isFinite(b) && a > b;
};

/**
 * Ein vorgemerkter Titel verlässt die Merkliste, sobald nach dem Vormerken weitergeschaut
 * wurde (eine Folge gesehen bzw. angefangen, Film gestartet) – auch in anderen Clients.
 * Bereits begonnene Serien (z. B. aus „Als nächstes“) lassen sich so trotzdem vormerken.
 */
export function isStarted(item: BaseItemDto, activity: Activity, entry?: WatchlistEntry): boolean {
  const data = item.UserData;
  if (!item.Id) return false;

  const baseline = entry?.baseline;
  if (!baseline) {
    // Einträge älterer Versionen: alles Begonnene zählt.
    if (data?.Played) return true;
    if (item.Type === "Series") {
      return (data?.PlayedPercentage ?? 0) > 0 || activity.seriesIds.has(item.Id);
    }
    return (data?.PlaybackPositionTicks ?? 0) > 0 || activity.itemIds.has(item.Id);
  }

  const since = entry.addedAt;
  if (data?.Played && !baseline.played) return true;
  if (after(data?.LastPlayedDate, since)) return true;
  if (item.Type === "Series") {
    return (
      (data?.PlayedPercentage ?? 0) > (baseline.playedPercentage ?? 0) ||
      after(activity.seriesLastPlayed.get(item.Id), since)
    );
  }
  return false;
}

/** Aktivität aus den Startseiten-Listen ableiten. */
export function activityFrom(...lists: (BaseItemDto[] | undefined)[]): Activity {
  const seriesIds = new Set<string>();
  const itemIds = new Set<string>();
  const seriesLastPlayed = new Map<string, string>();
  for (const item of lists.flat()) {
    if (!item?.Id) continue;
    const started = item.UserData?.Played || (item.UserData?.PlaybackPositionTicks ?? 0) > 0;
    if (started) itemIds.add(item.Id);
    // Next Up enthält nur Serien, von denen schon etwas gesehen wurde.
    if (item.SeriesId) {
      seriesIds.add(item.SeriesId);
      const last = item.UserData?.LastPlayedDate;
      const known = seriesLastPlayed.get(item.SeriesId);
      if (last && (!known || Date.parse(last) > Date.parse(known)))
        seriesLastPlayed.set(item.SeriesId, last);
    }
  }
  return { seriesIds, itemIds, seriesLastPlayed };
}
