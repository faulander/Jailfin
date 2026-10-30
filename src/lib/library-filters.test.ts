import { describe, expect, it } from "vite-plus/test";
import { parseYearFilter, yearsOf } from "./library-filters";

describe("parseYearFilter", () => {
  it("understands comparisons, exact years and ranges", () => {
    expect(parseYearFilter("<1960", 2026)).toEqual({ min: 1888, max: 1959 });
    expect(parseYearFilter("<=1960", 2026)).toEqual({ min: 1888, max: 1960 });
    expect(parseYearFilter(">1985", 2026)).toEqual({ min: 1986, max: 2028 });
    expect(parseYearFilter(">= 2020", 2026)).toEqual({ min: 2020, max: 2028 });
    expect(parseYearFilter("=2025", 2026)).toEqual({ min: 2025, max: 2025 });
    expect(parseYearFilter("2025", 2026)).toEqual({ min: 2025, max: 2025 });
    expect(parseYearFilter("1989 – 1980", 2026)).toEqual({ min: 1980, max: 1989 });
  });

  it("rejects invalid or empty input", () => {
    expect(parseYearFilter("", 2026)).toBeNull();
    expect(parseYearFilter("<60", 2026)).toBeNull();
    expect(parseYearFilter("neu", 2026)).toBeNull();
    expect(parseYearFilter(">2030", 2026)).toBeNull();
  });
});

describe("yearsOf", () => {
  it("lists every year of the range", () => {
    expect(yearsOf({ min: 1998, max: 2001 })).toEqual([1998, 1999, 2000, 2001]);
  });
});
