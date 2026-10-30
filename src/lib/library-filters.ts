/**
 * Jahresfilter der Bibliothek: „<1960“, „>1985“, „=2025“, „2025“, „<=1999“, „>=2000“
 * oder ein Bereich „1980-1989“. Gilt für das Erscheinungs- bzw. Erstausstrahlungsjahr.
 */
export interface YearRange {
  min: number;
  max: number;
}

/** Ältestes sinnvolles Jahr (Anfänge des Films) */
const FIRST_YEAR = 1888;

export function parseYearFilter(
  input: string,
  currentYear = new Date().getFullYear(),
): YearRange | null {
  const value = input.replace(/\s+/g, "").replace(/[–—]/g, "-");
  if (!value) return null;
  const last = currentYear + 2; // angekündigte Titel
  const range = /^(\d{4})-(\d{4})$/.exec(value);
  if (range) {
    const a = Number(range[1]);
    const b = Number(range[2]);
    return { min: Math.min(a, b), max: Math.max(a, b) };
  }
  const match = /^(<=|>=|<|>|=)?(\d{4})$/.exec(value);
  if (!match) return null;
  const year = Number(match[2]);
  switch (match[1]) {
    case "<":
      return year - 1 < FIRST_YEAR ? null : { min: FIRST_YEAR, max: year - 1 };
    case "<=":
      return { min: FIRST_YEAR, max: year };
    case ">":
      return year + 1 > last ? null : { min: year + 1, max: last };
    case ">=":
      return { min: year, max: Math.max(year, last) };
    default:
      return { min: year, max: year };
  }
}

/** Jahre für den Jellyfin-Parameter `years` (Liste einzelner Jahre). */
export function yearsOf(range: YearRange): number[] {
  return Array.from({ length: range.max - range.min + 1 }, (_, i) => range.min + i);
}
