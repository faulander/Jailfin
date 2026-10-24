import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import type { HiddenEntry } from "./store";

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

/**
 * Entfernt aus „Weiterschauen“ ausgeblendete Titel — aber nur, solange seit dem
 * Ausblenden nicht weitergeschaut wurde (geänderte `LastPlayedDate` holt ihn zurück).
 */
export function selectResume(
  items: BaseItemDto[],
  hidden: ReadonlyMap<string, Pick<HiddenEntry, "lastPlayed">>,
): BaseItemDto[] {
  return items.filter((item) => {
    const entry = item.Id ? hidden.get(item.Id) : undefined;
    if (!entry) return true;
    return (item.UserData?.LastPlayedDate ?? "") !== (entry.lastPlayed ?? "");
  });
}
