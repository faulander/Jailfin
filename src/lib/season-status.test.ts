import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { describe, expect, it } from "vite-plus/test";
import { computeStatus, currentSeason, episodeNumbers, type TvmazeShow } from "./season-status";

// MobLand laut TVmaze (Stand 30.10.2026): Staffel 2 läuft, Folge 7 von 10 heute.
const show: TvmazeShow = {
  seasons: [
    { number: 1, episodeOrder: 10, premiereDate: "2025-03-30", endDate: "2025-06-01" },
    { number: 2, episodeOrder: 10, premiereDate: "2026-09-18", endDate: "2026-11-20" },
    { number: 3, episodeOrder: null, premiereDate: null, endDate: null },
  ],
  episodes: Array.from({ length: 10 }, (_, i) => ({
    season: 2,
    number: i + 1,
    airdate: `2026-${i < 4 ? "09" : i < 9 ? "10" : "11"}-01`,
  })),
};
const range = (n: number) => new Set(Array.from({ length: n }, (_, i) => i + 1));

describe("currentSeason", () => {
  it("is the latest season that already premiered, ignoring announced ones", () => {
    expect(currentSeason(show, "2026-10-30")).toBe(2);
    expect(currentSeason(show, "2026-01-01")).toBe(1);
    expect(currentSeason(show, "2020-01-01")).toBeUndefined();
  });
});

describe("computeStatus", () => {
  it("reports a running season as incomplete with its finale", () => {
    expect(computeStatus(show, 2, range(7), "2026-10-30")).toMatchObject({
      season: 2,
      have: 7,
      total: 10,
      finale: "2026-11-20",
      complete: false,
    });
  });

  it("is complete once every planned episode is on the server", () => {
    expect(computeStatus(show, 2, range(10), "2026-11-21")?.complete).toBe(true);
  });

  it("ignores extras numbered beyond the season length", () => {
    expect(computeStatus(show, 2, new Set([1, 2, 99]), "2026-10-30")?.have).toBe(2);
  });

  it("uses the listed episodes when the season length is unknown", () => {
    const unknown: TvmazeShow = {
      seasons: [{ number: 1, episodeOrder: null, premiereDate: "2026-01-01", endDate: null }],
      episodes: [1, 2, 3].map((n) => ({ season: 1, number: n, airdate: "2026-01-0" + n })),
    };
    expect(computeStatus(unknown, 1, range(3), "2026-02-01")).toMatchObject({
      total: 3,
      complete: true,
    });
  });

  it("has no status for a season without any episode information", () => {
    expect(computeStatus(show, 3, new Set(), "2027-01-01")).toBeUndefined();
  });
});

describe("episodeNumbers", () => {
  it("counts double episodes and skips missing placeholders", () => {
    const items: BaseItemDto[] = [
      { IndexNumber: 1, IndexNumberEnd: 2 },
      { IndexNumber: 3 },
      { IndexNumber: 4, LocationType: "Virtual" },
    ];
    expect([...episodeNumbers(items)]).toEqual([1, 2, 3]);
  });
});
