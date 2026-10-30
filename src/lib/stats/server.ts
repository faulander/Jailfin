import type { BaseItemDto, SessionInfoDto } from "@jellyfin/sdk/lib/generated-client/models";
import { getLibraryApi, getSessionApi, getUserApi } from "@jellyfin/sdk/lib/utils/api";
import { episodeCode } from "../format";
import { fetchAllPages, type ItemPage } from "../jellyfin/paging";
import { session } from "../jellyfin/session.svelte";
import type { PlayRecord } from "./aggregate";

/** Ist der angemeldete Benutzer Administrator? */
export async function loadIsAdmin(signal?: AbortSignal): Promise<boolean> {
  const { data } = await getUserApi(session.api).getUserById(
    { userId: session.userId },
    { signal },
  );
  return !!data.Policy?.IsAdministrator;
}

/** Benutzer des Servers (nur für Administratoren). */
export async function loadUsers(signal?: AbortSignal): Promise<{ id: string; name: string }[]> {
  const { data } = await getUserApi(session.api).getUsers({}, { signal });
  return data
    .flatMap((u) =>
      u.Id ? [{ id: u.Id.replaceAll("-", "").toLowerCase(), name: u.Name ?? "?" }] : [],
    )
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
}

/** Laufende Wiedergaben aller Benutzer (nur für Administratoren). */
export async function loadNowPlaying(signal?: AbortSignal): Promise<SessionInfoDto[]> {
  const { data } = await getSessionApi(session.api).getSessions(
    { activeWithinSeconds: 960 },
    { signal },
  );
  return data.filter((s) => s.NowPlayingItem);
}

export interface LibraryCounts {
  movies: number;
  series: number;
  episodes: number;
}

export async function loadLibraryCounts(signal?: AbortSignal): Promise<LibraryCounts> {
  const { data } = await getLibraryApi(session.api).getItemCounts(
    { userId: session.userId },
    { signal },
  );
  return {
    movies: data.MovieCount ?? 0,
    series: data.SeriesCount ?? 0,
    episodes: data.EpisodeCount ?? 0,
  };
}

/**
 * Ohne Plugin: eigener Verlauf aus den Jellyfin-Benutzerdaten. Pro Titel ist nur die
 * letzte Wiedergabe bekannt; die Zeit ergibt sich aus Laufzeit × Anzahl der Wiedergaben.
 */
export async function loadOwnHistory(signal?: AbortSignal): Promise<PlayRecord[]> {
  const items = await fetchAllPages(
    async (startIndex, limit): Promise<ItemPage> => {
      const { data } = await getLibraryApi(session.api).getItems(
        {
          userId: session.userId,
          recursive: true,
          includeItemTypes: ["Movie", "Episode"],
          isPlayed: true,
          enableImages: false,
          enableUserData: true,
          enableTotalRecordCount: true,
          startIndex,
          limit,
        },
        { signal },
      );
      return data;
    },
    { pageSize: 500, maxItems: 50_000 },
  );
  return items.flatMap((item: BaseItemDto) => {
    const at = Date.parse(item.UserData?.LastPlayedDate ?? "");
    if (!item.Id || !Number.isFinite(at)) return [];
    const plays = Math.max(1, item.UserData?.PlayCount ?? 1);
    const isEpisode = item.Type === "Episode";
    return [
      {
        at,
        userId: session.userId,
        itemId: isEpisode ? (item.SeriesId ?? item.Id) : item.Id,
        type: isEpisode ? "Episode" : "Movie",
        ...(isEpisode && item.SeriesName ? { series: item.SeriesName } : {}),
        title: isEpisode ? `${episodeCode(item) ?? ""} · ${item.Name ?? ""}` : (item.Name ?? ""),
        method: "direct",
        methodDetail: "",
        client: "",
        device: "",
        seconds: Math.round(((item.RunTimeTicks ?? 0) / 10_000_000) * plays),
      } satisfies PlayRecord,
    ];
  });
}
