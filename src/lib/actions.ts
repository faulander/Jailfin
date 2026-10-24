import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { m } from "./i18n";
import { hiddenSeries } from "./nextup/hidden.svelte";
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
    await hiddenSeries.hide(seriesId, seriesName);
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
