import type {
  BaseItemDto,
  BaseItemKind,
  ItemFields,
  ItemSortBy,
  SortOrder,
} from "@jellyfin/sdk/lib/generated-client/models";
import { getLibraryApi, getShowApi, getUserDataApi } from "@jellyfin/sdk/lib/utils/api";
import { fetchAllPages, type ItemPage } from "../nextup/nextup";
import { session } from "./session.svelte";

const CARD_FIELDS: ItemFields[] = ["PrimaryImageAspectRatio", "Overview", "DateCreated"];
const IMAGE_TYPES = ["Primary", "Thumb", "Backdrop"] as const;

const common = () => ({
  userId: session.userId,
  enableImageTypes: [...IMAGE_TYPES],
  imageTypeLimit: 1,
  enableUserData: true,
});

/**
 * Alle Next-Up-Seiten des Servers laden (ungefiltert). Das Filtern ausgeblendeter
 * Serien passiert reaktiv in der UI über `selectNextUp`, damit Aus-/Einblenden sofort wirkt.
 */
export function loadNextUp(signal?: AbortSignal): Promise<BaseItemDto[]> {
  const api = session.api;
  return fetchAllPages(async (startIndex, limit): Promise<ItemPage> => {
    const { data } = await getShowApi(api).getNextUp(
      {
        ...common(),
        startIndex,
        limit,
        fields: CARD_FIELDS,
        enableTotalRecordCount: true,
        enableResumable: true,
        enableRewatching: false,
      },
      { signal },
    );
    return data;
  });
}

export async function loadResume(signal?: AbortSignal): Promise<BaseItemDto[]> {
  const { data } = await getLibraryApi(session.api).getResumeItems(
    {
      ...common(),
      limit: 24,
      fields: CARD_FIELDS,
      mediaTypes: ["Video"],
      enableTotalRecordCount: false,
    },
    { signal },
  );
  return data.Items ?? [];
}

export async function loadLatest(signal?: AbortSignal): Promise<BaseItemDto[]> {
  const { data } = await getLibraryApi(session.api).getLatestMedia(
    {
      ...common(),
      limit: 24,
      fields: CARD_FIELDS,
      includeItemTypes: ["Movie", "Episode"],
      groupItems: true,
    },
    { signal },
  );
  return data;
}

export type LibrarySort = "title" | "year" | "added";

const SORTS: Record<LibrarySort, { sortBy: ItemSortBy[]; sortOrder: SortOrder[] }> = {
  title: { sortBy: ["SortName"], sortOrder: ["Ascending"] },
  year: {
    sortBy: ["ProductionYear", "PremiereDate", "SortName"],
    sortOrder: ["Descending", "Descending", "Ascending"],
  },
  added: { sortBy: ["DateCreated", "SortName"], sortOrder: ["Descending", "Ascending"] },
};

export async function loadLibraryPage(
  type: Extract<BaseItemKind, "Movie" | "Series">,
  sort: LibrarySort,
  startIndex: number,
  limit: number,
  signal?: AbortSignal,
): Promise<ItemPage> {
  const { data } = await getLibraryApi(session.api).getItems(
    {
      ...common(),
      includeItemTypes: [type],
      recursive: true,
      startIndex,
      limit,
      ...SORTS[sort],
      fields: ["PrimaryImageAspectRatio"],
      enableTotalRecordCount: true,
    },
    { signal },
  );
  return data;
}

export async function searchItems(term: string, signal?: AbortSignal): Promise<BaseItemDto[]> {
  const { data } = await getLibraryApi(session.api).getItems(
    {
      ...common(),
      searchTerm: term,
      includeItemTypes: ["Movie", "Series"],
      recursive: true,
      limit: 60,
      fields: ["PrimaryImageAspectRatio"],
      enableTotalRecordCount: false,
    },
    { signal },
  );
  return data.Items ?? [];
}

export async function loadItem(id: string, signal?: AbortSignal): Promise<BaseItemDto> {
  const { data } = await getLibraryApi(session.api).getItem(
    { itemId: id, userId: session.userId },
    { signal },
  );
  return data;
}

/** Mehrere Items per ID (z. B. ausgeblendete Serien für die Einstellungen). */
export async function loadItemsByIds(ids: string[], signal?: AbortSignal): Promise<BaseItemDto[]> {
  if (ids.length === 0) return [];
  const { data } = await getLibraryApi(session.api).getItems(
    { ...common(), ids, enableTotalRecordCount: false },
    { signal },
  );
  return data.Items ?? [];
}

export async function loadSeasons(seriesId: string, signal?: AbortSignal): Promise<BaseItemDto[]> {
  const { data } = await getShowApi(session.api).getSeasons(
    { ...common(), seriesId, fields: ["PrimaryImageAspectRatio"] },
    { signal },
  );
  return data.Items ?? [];
}

export async function loadEpisodes(
  seriesId: string,
  seasonId: string,
  signal?: AbortSignal,
): Promise<BaseItemDto[]> {
  const { data } = await getShowApi(session.api).getEpisodes(
    { ...common(), seriesId, seasonId, fields: ["Overview", "PrimaryImageAspectRatio"] },
    { signal },
  );
  return data.Items ?? [];
}

/** Die nächste Folge einer Serie nach `episodeId` (für „Nächste Folge“ im Player). */
export async function loadFollowingEpisode(
  seriesId: string,
  episodeId: string,
): Promise<BaseItemDto | undefined> {
  const { data } = await getShowApi(session.api).getEpisodes({
    ...common(),
    seriesId,
    startItemId: episodeId,
    limit: 2,
    fields: ["Overview"],
  });
  const items = data.Items ?? [];
  return items[0]?.Id === episodeId ? items[1] : undefined;
}

/** Nächste Serienfolge laut Jellyfin (für „Abspielen“ auf der Serienseite). */
export async function loadSeriesNextUp(seriesId: string): Promise<BaseItemDto | undefined> {
  const { data } = await getShowApi(session.api).getNextUp({
    ...common(),
    seriesId,
    limit: 1,
    enableResumable: true,
  });
  return data.Items?.[0];
}

export async function setPlayed(itemId: string, played: boolean) {
  const api = getUserDataApi(session.api);
  const { data } = played
    ? await api.markPlayedItem({ itemId, userId: session.userId })
    : await api.markUnplayedItem({ itemId, userId: session.userId });
  return data;
}
