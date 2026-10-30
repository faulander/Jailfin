import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { loadSeasonEpisodeItems } from "./jellyfin/queries";
import {
  computeStatus,
  currentSeason,
  episodeNumbers,
  type SeasonStatus,
  type TvmazeShow,
} from "./season-status";

/**
 * Staffel-Vollständigkeit für die Merkliste. Geplante Folgen kommen von TVmaze (öffentliche
 * API ohne Schlüssel, CORS erlaubt), vorhandene Folgen von Jellyfin.
 */
const API = "https://api.tvmaze.com";
const CACHE_KEY = "jailfin.tvmaze.v1";
const TTL_MS = 6 * 60 * 60 * 1000;
const CONCURRENCY = 3;

interface CacheEntry {
  at: number;
  /** null = bei TVmaze nicht gefunden */
  show: TvmazeShow | null;
}

type RawShow = {
  _embedded?: {
    seasons?: {
      number?: number;
      episodeOrder?: number | null;
      premiereDate?: string | null;
      endDate?: string | null;
    }[];
    episodes?: { season?: number; number?: number | null; airdate?: string; type?: string }[];
  };
};

function readCache(): Record<string, CacheEntry> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}") as Record<string, CacheEntry>;
  } catch {
    return {};
  }
}

function writeCache(cache: Record<string, CacheEntry>): void {
  const now = Date.now();
  const fresh = Object.fromEntries(Object.entries(cache).filter(([, e]) => now - e.at < TTL_MS));
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(fresh));
  } catch {
    // Speicher voll: ohne Cache weiter
  }
}

function reduce(raw: RawShow): TvmazeShow {
  return {
    seasons: (raw._embedded?.seasons ?? []).flatMap((s) =>
      s.number == null
        ? []
        : [
            {
              number: s.number,
              episodeOrder: s.episodeOrder ?? null,
              premiereDate: s.premiereDate ?? null,
              endDate: s.endDate ?? null,
            },
          ],
    ),
    episodes: (raw._embedded?.episodes ?? []).flatMap((e) =>
      e.season == null || e.number == null || (e.type && e.type !== "regular")
        ? []
        : [{ season: e.season, number: e.number, airdate: e.airdate ?? "" }],
    ),
  };
}

/** TVmaze-ID aus den Jellyfin-Provider-IDs, sonst Suche über IMDb- bzw. TheTVDB-ID. */
async function fetchShow(series: BaseItemDto, signal: AbortSignal): Promise<TvmazeShow | null> {
  const ids = series.ProviderIds ?? {};
  const embed = "embed[]=seasons&embed[]=episodes";
  const urls = [
    ids.TvMaze && `${API}/shows/${encodeURIComponent(ids.TvMaze)}?${embed}`,
    ids.Imdb && `${API}/lookup/shows?imdb=${encodeURIComponent(ids.Imdb)}`,
    ids.Tvdb && `${API}/lookup/shows?thetvdb=${encodeURIComponent(ids.Tvdb)}`,
  ].filter((u): u is string => !!u);
  for (const url of urls) {
    const response = await fetch(url, { signal });
    if (response.status === 404) continue;
    if (!response.ok) throw new Error(`TVmaze ${response.status}`);
    const show = (await response.json()) as RawShow & { id?: number };
    if (show._embedded) return reduce(show);
    // Lookup liefert die Serie ohne Einbettungen: mit ID nachladen.
    if (show.id != null) {
      const full = await fetch(`${API}/shows/${show.id}?${embed}`, { signal });
      if (full.ok) return reduce((await full.json()) as RawShow);
    }
  }
  return null;
}

const today = () => new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD in Ortszeit

class SeasonStatuses {
  /** Serien-ID → Status (null = unbekannt, kein Badge) */
  byId = $state<Record<string, SeasonStatus | null>>({});
  #controller: AbortController | undefined;

  /** Status für die übergebenen Serien neu berechnen (TVmaze aus dem Cache, Jellyfin frisch). */
  async refresh(items: BaseItemDto[]): Promise<void> {
    this.#controller?.abort();
    const controller = new AbortController();
    this.#controller = controller;
    // Zwischengespeicherte Startseitendaten haben keine Provider-IDs: erst die frischen abwarten.
    const series = items.filter((i) => i.Type === "Series" && i.Id && i.ProviderIds);
    const cache = readCache();
    const queue = [...series];

    const work = async () => {
      for (let item = queue.shift(); item; item = queue.shift()) {
        const id = item.Id!;
        try {
          let entry = cache[id];
          if (!entry || Date.now() - entry.at >= TTL_MS) {
            entry = { at: Date.now(), show: await fetchShow(item, controller.signal) };
            cache[id] = entry;
          }
          const day = today();
          const season = entry.show ? currentSeason(entry.show, day) : undefined;
          let status: SeasonStatus | null = null;
          if (entry.show && season != null) {
            const local = await loadSeasonEpisodeItems(id, season, controller.signal);
            status = computeStatus(entry.show, season, episodeNumbers(local), day) ?? null;
          }
          if (!controller.signal.aborted) this.byId = { ...this.byId, [id]: status };
        } catch {
          if (controller.signal.aborted) return;
          // Netzwerkfehler: vorherigen Stand behalten
        }
      }
    };

    await Promise.all(Array.from({ length: CONCURRENCY }, work));
    if (!controller.signal.aborted) writeCache(cache);
  }
}

export const seasonStatuses = new SeasonStatuses();
