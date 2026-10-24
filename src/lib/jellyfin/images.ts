import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { session } from "./session.svelte";

/**
 * Bild-URLs. Jellyfin liefert Bilder ohne Authentifizierung aus, daher enthält
 * die URL kein Token. `tag` macht die URL cachebar (ändert sich mit dem Bild).
 */
function build(
  itemId: string,
  type: string,
  tag: string,
  maxWidth: number,
  index?: number,
): string {
  const base = session.current?.serverUrl ?? "";
  const params = new URLSearchParams({
    tag,
    maxWidth: String(Math.round(maxWidth * Math.min(devicePixelRatio || 1, 2))),
    quality: "90",
  });
  const suffix = index != null ? `/${index}` : "";
  return `${base}/Items/${encodeURIComponent(itemId)}/Images/${type}${suffix}?${params}`;
}

/** Hochformat-Poster (Film, Serie, Staffel); Episoden fallen auf das Serienposter zurück. */
export function posterUrl(item: BaseItemDto, width = 300): string | undefined {
  const tag = item.ImageTags?.Primary;
  if (tag && item.Id && item.Type !== "Episode") return build(item.Id, "Primary", tag, width);
  if (item.SeriesId && item.SeriesPrimaryImageTag) {
    return build(item.SeriesId, "Primary", item.SeriesPrimaryImageTag, width);
  }
  if (tag && item.Id) return build(item.Id, "Primary", tag, width);
  return undefined;
}

/** Querformat-Bild (16:9) für Episoden- und Weiterschauen-Karten. */
export function landscapeUrl(item: BaseItemDto, width = 480): string | undefined {
  if (item.Type === "Episode" && item.ImageTags?.Primary && item.Id) {
    return build(item.Id, "Primary", item.ImageTags.Primary, width);
  }
  if (item.ImageTags?.Thumb && item.Id) return build(item.Id, "Thumb", item.ImageTags.Thumb, width);
  if (item.ParentThumbItemId && item.ParentThumbImageTag) {
    return build(item.ParentThumbItemId, "Thumb", item.ParentThumbImageTag, width);
  }
  // Letzter Ausweg: Primärbild (bei Filmen ein Poster, per object-fit beschnitten).
  return backdropUrl(item, width) ?? posterUrl(item, width);
}

export function backdropUrl(item: BaseItemDto, width = 1280): string | undefined {
  const tag = item.BackdropImageTags?.[0];
  if (tag && item.Id) return build(item.Id, "Backdrop", tag, width, 0);
  const parentTag = item.ParentBackdropImageTags?.[0];
  if (parentTag && item.ParentBackdropItemId) {
    return build(item.ParentBackdropItemId, "Backdrop", parentTag, width, 0);
  }
  return undefined;
}
