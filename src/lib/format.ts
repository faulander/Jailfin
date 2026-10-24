import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { locale, m } from "./i18n";

/** Jellyfin-Zeiteinheit: 1 Tick = 100 ns. */
export const TICKS_PER_SECOND = 10_000_000;

export const ticksToSeconds = (ticks: number | null | undefined): number =>
  ticks ? ticks / TICKS_PER_SECOND : 0;

export const secondsToTicks = (seconds: number): number => Math.round(seconds * TICKS_PER_SECOND);

/** 3725 → "1:02:05", 65 → "1:05" */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const h = Math.floor(total / 3600);
  const min = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(min).padStart(2, "0")}:${ss}` : `${min}:${ss}`;
}

/** Laufzeit als "1 Std. 45 Min." bzw. "45 Min." */
export function formatRuntime(ticks: number | null | undefined): string | undefined {
  if (!ticks) return undefined;
  const minutes = Math.round(ticksToSeconds(ticks) / 60);
  if (minutes < 60) return m.common.minutes(minutes);
  const h = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${h} Std. ${rest} Min.` : `${h} Std.`;
}

/** "S02E04"; Specials bzw. fehlende Nummern werden defensiv behandelt. */
export function episodeCode(item: BaseItemDto): string | undefined {
  const season = item.ParentIndexNumber;
  const episode = item.IndexNumber;
  if (episode == null) return undefined;
  const e = `E${String(episode).padStart(2, "0")}`;
  if (item.IndexNumberEnd != null && item.IndexNumberEnd !== episode) {
    return `${season != null ? `S${String(season).padStart(2, "0")}` : ""}${e}–E${String(item.IndexNumberEnd).padStart(2, "0")}`;
  }
  return season != null ? `S${String(season).padStart(2, "0")}${e}` : e;
}

/** Fortschritt 0..100 aus den UserData eines Items. */
export function progressPercent(item: BaseItemDto): number {
  const pct = item.UserData?.PlayedPercentage;
  if (pct != null && pct > 0) return Math.min(100, pct);
  const pos = item.UserData?.PlaybackPositionTicks;
  if (pos && item.RunTimeTicks) return Math.min(100, (pos / item.RunTimeTicks) * 100);
  return 0;
}

export const hasResumePosition = (item: BaseItemDto): boolean =>
  (item.UserData?.PlaybackPositionTicks ?? 0) > 0;

export function remainingTime(item: BaseItemDto): string | undefined {
  const pos = item.UserData?.PlaybackPositionTicks;
  if (!pos || !item.RunTimeTicks) return undefined;
  return formatRuntime(item.RunTimeTicks - pos);
}

const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

export function formatDate(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? undefined : dateFormat.format(d);
}
