import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";

export interface ItemPage {
  Items?: BaseItemDto[] | null;
  TotalRecordCount?: number;
}

export type PageFetcher = (startIndex: number, limit: number) => Promise<ItemPage>;

/**
 * Lädt alle Seiten einer paginierten Jellyfin-Abfrage. Wird vor dem Filtern der
 * ausgeblendeten Serien verwendet, damit Ausblendungen keine späteren Ergebnisse
 * „verdrängen“ (PRD 4.4, Szenario 8). `maxItems` begrenzt nur pathologische Fälle.
 */
export async function fetchAllPages(
  fetchPage: PageFetcher,
  { pageSize = 50, maxItems = 2000 } = {},
): Promise<BaseItemDto[]> {
  const items: BaseItemDto[] = [];
  while (items.length < maxItems) {
    const page = await fetchPage(items.length, Math.min(pageSize, maxItems - items.length));
    const batch = page.Items ?? [];
    items.push(...batch);
    const total = page.TotalRecordCount;
    if (batch.length === 0) break;
    if (total != null ? items.length >= total : batch.length < pageSize) break;
  }
  return items;
}

/**
 * Entfernt ausgeblendete Serien und hält höchstens eine Folge pro Serie.
 * Die vom Server gelieferte Reihenfolge bleibt erhalten (NU-09).
 */
export function selectNextUp(
  items: BaseItemDto[],
  hiddenSeriesIds: ReadonlySet<string>,
): BaseItemDto[] {
  const seen = new Set<string>();
  const result: BaseItemDto[] = [];
  for (const item of items) {
    const seriesId = item.SeriesId;
    if (seriesId) {
      if (hiddenSeriesIds.has(seriesId) || seen.has(seriesId)) continue;
      seen.add(seriesId);
    }
    result.push(item);
  }
  return result;
}
