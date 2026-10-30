import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";

/** Reduzierte TVmaze-Daten einer Serie (nur reguläre Folgen, ohne Specials). */
export interface TvmazeShow {
  seasons: {
    number: number;
    episodeOrder: number | null;
    premiereDate: string | null;
    endDate: string | null;
  }[];
  episodes: { season: number; number: number; airdate: string }[];
}

/** Vollständigkeit der aktuellen Staffel: vorhanden auf dem Server vs. geplant laut TVmaze. */
export interface SeasonStatus {
  season: number;
  /** Folgen dieser Staffel auf dem Server */
  have: number;
  /** Geplante Folgen der Staffel */
  total: number;
  /** Bereits ausgestrahlte Folgen */
  aired: number;
  /** Datum (YYYY-MM-DD) der letzten Folge der Staffel, sofern bekannt */
  finale?: string;
  complete: boolean;
}

/** Aktuelle Staffel: die letzte, die bereits angelaufen ist (angekündigte zählen noch nicht). */
export function currentSeason(show: TvmazeShow, today: string): number | undefined {
  const started = new Set(
    show.episodes.filter((e) => e.airdate && e.airdate <= today).map((e) => e.season),
  );
  for (const s of show.seasons)
    if (s.premiereDate && s.premiereDate <= today) started.add(s.number);
  return started.size ? Math.max(...started) : undefined;
}

/** Folgennummern der vorhandenen Folgen (Doppelfolgen „E01-E02“ zählen beide). */
export function episodeNumbers(items: BaseItemDto[]): Set<number> {
  const numbers = new Set<number>();
  for (const item of items) {
    if (item.LocationType === "Virtual" || item.IndexNumber == null) continue;
    const end = Math.max(item.IndexNumber, item.IndexNumberEnd ?? item.IndexNumber);
    for (let n = item.IndexNumber; n <= end; n++) numbers.add(n);
  }
  return numbers;
}

export function computeStatus(
  show: TvmazeShow,
  season: number,
  have: Set<number>,
  today: string,
): SeasonStatus | undefined {
  const episodes = show.episodes.filter((e) => e.season === season);
  const info = show.seasons.find((s) => s.number === season);
  const total = Math.max(info?.episodeOrder ?? 0, episodes.length);
  if (total === 0) return undefined;
  const airdates = episodes
    .map((e) => e.airdate)
    .filter(Boolean)
    .sort();
  const finale = info?.endDate ?? (episodes.length === total ? airdates.at(-1) : undefined);
  // Nur Folgen zählen, die es laut TVmaze in dieser Staffel gibt (keine Extras mit hoher Nummer).
  const count = [...have].filter((n) => n >= 1 && n <= total).length;
  return {
    season,
    have: count,
    total,
    aired: airdates.filter((d) => d <= today).length,
    ...(finale ? { finale } : {}),
    complete: count >= total,
  };
}
