import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { hiddenResume, hiddenSeries } from "./hidden/state.svelte";
import { m } from "./i18n";
import { router } from "./router.svelte";
import { toasts } from "./toast.svelte";

/** Öffnet den Player; ohne `fromStart` wird an der gespeicherten Position fortgesetzt. */
export function play(item: BaseItemDto, { fromStart = false } = {}): void {
  if (!item.Id) return;
  router.navigate(`/play/${encodeURIComponent(item.Id)}${fromStart ? "?start=0" : ""}`);
}

/** NU-04: Serie aus „Als nächstes“ ausblenden (nur lokale Präferenz, keine Serveränderung). */
export async function hideFromNextUp(seriesId: string, seriesName: string): Promise<void> {
  try {
    await hiddenSeries.hide(seriesId, { name: seriesName });
    toasts.show(m.home.seriesHidden(seriesName), {
      action: { label: m.common.undo, run: () => void showInNextUp(seriesId) },
    });
  } catch {
    toasts.show(m.errors.storage, { tone: "error" });
  }
}

export async function showInNextUp(seriesId: string): Promise<void> {
  try {
    await hiddenSeries.unhide(seriesId);
  } catch {
    toasts.show(m.errors.storage, { tone: "error" });
  }
}

/** Titel aus „Weiterschauen“ ausblenden, bis er erneut angesehen wird (lokal, Server unverändert). */
export async function hideFromResume(item: BaseItemDto): Promise<void> {
  if (!item.Id) return;
  const id = item.Id;
  const name =
    item.Type === "Episode"
      ? [item.SeriesName, item.Name].filter(Boolean).join(" – ")
      : (item.Name ?? "");
  try {
    await hiddenResume.hide(id, { name, lastPlayed: item.UserData?.LastPlayedDate ?? undefined });
    toasts.show(m.home.resumeHidden(name), {
      action: { label: m.common.undo, run: () => void showInResume(id) },
    });
  } catch {
    toasts.show(m.errors.storage, { tone: "error" });
  }
}

export async function showInResume(itemId: string): Promise<void> {
  try {
    await hiddenResume.unhide(itemId);
  } catch {
    toasts.show(m.errors.storage, { tone: "error" });
  }
}
