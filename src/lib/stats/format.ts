const number = new Intl.NumberFormat("de-DE");

export const formatNumber = (value: number) => number.format(value);

/** Wiedergabezeit: „42 Min.“, „5 Std. 12 Min.“, ab zehn Stunden nur noch Stunden. */
export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  if (hours >= 10) return `${number.format(Math.round(minutes / 60))} Std.`;
  const rest = minutes % 60;
  return rest ? `${hours} Std. ${rest} Min.` : `${hours} Std.`;
}

/** Kompakt für Achsen: „3 h“, „45 min“ */
export function formatAxis(seconds: number): string {
  if (seconds >= 3600) return `${number.format(Math.round((seconds / 3600) * 10) / 10)} h`;
  return `${Math.round(seconds / 60)} min`;
}

const dayFormat = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
});
const monthFormat = new Intl.DateTimeFormat("de-DE", { month: "short", year: "numeric" });
const dateTimeFormat = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export const formatDay = (at: number) => dayFormat.format(at);
export const formatMonth = (at: number) => monthFormat.format(at);
export const formatDateTime = (at: number) => dateTimeFormat.format(at);

/** „vor 5 Min.“, „vor 3 Std.“, „vor 2 Tagen“ */
export function formatAgo(at: number, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - at) / 60_000));
  if (minutes < 1) return "gerade eben";
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.round(hours / 24);
  return days === 1 ? "vor 1 Tag" : `vor ${days} Tagen`;
}
