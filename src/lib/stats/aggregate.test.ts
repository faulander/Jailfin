import { describe, expect, it } from "vite-plus/test";
import {
  classifyMethod,
  formatServerDate,
  heatmap,
  parseRows,
  parseServerDate,
  rank,
  splitEpisodeName,
  timeline,
  type PlayRecord,
} from "./aggregate";

const COLUMNS = [
  "DateCreated",
  "UserId",
  "ItemId",
  "ItemType",
  "ItemName",
  "PlaybackMethod",
  "ClientName",
  "DeviceName",
  "PlayDuration",
];

const record = (at: Date, patch: Partial<PlayRecord> = {}): PlayRecord => ({
  at: at.getTime(),
  userId: "u",
  itemId: "i",
  type: "Episode",
  title: "t",
  method: "direct",
  methodDetail: "DirectPlay",
  client: "Jailfin",
  device: "Firefox",
  seconds: 60,
  ...patch,
});

describe("server dates", () => {
  it("converts the plugin's local server time to UTC and back", () => {
    // Server in UTC+1: 13:14 lokal = 12:14 UTC
    const at = parseServerDate("2026-10-30 13:14:59.6637135", 3600);
    expect(new Date(at).toISOString()).toBe("2026-10-30T12:14:59.663Z");
    expect(formatServerDate(at, 3600)).toBe("2026-10-30 13:14:59");
  });

  it("rejects unparsable values", () => {
    expect(parseServerDate("gestern", 0)).toBeNaN();
  });
});

describe("parseRows", () => {
  it("maps plugin rows, splitting episode names into series and code", () => {
    const [r] = parseRows(
      COLUMNS,
      [
        [
          "2026-10-30 20:00:00.0000000",
          "abc",
          "ep1",
          "Episode",
          "MobLand - s02e07 - Ace of Spades",
          "Transcode (v:h264 a:aac)",
          "Jailfin",
          "Firefox (Linux)",
          "3240",
        ],
      ],
      0,
    );
    expect(r).toMatchObject({
      type: "Episode",
      series: "MobLand",
      title: "S02E07 · Ace of Spades",
      method: "transcode",
      seconds: 3240,
    });
  });

  it("keeps series names that contain the separator", () => {
    expect(splitEpisodeName("Law - Order - s01e02 - Pilot")).toEqual({
      series: "Law - Order",
      code: "S01E02",
      title: "Pilot",
    });
    expect(splitEpisodeName("Ein Film")).toBeUndefined();
  });

  it("classifies playback methods", () => {
    expect(classifyMethod("DirectPlay")).toBe("direct");
    expect(classifyMethod("DirectStream")).toBe("stream");
    expect(classifyMethod("Transcode (v:direct a:aac)")).toBe("transcode");
  });
});

describe("timeline", () => {
  it("fills empty days and separates movies from episodes", () => {
    const day1 = new Date(2026, 9, 1, 21);
    const day3 = new Date(2026, 9, 3, 9);
    const t = timeline(
      [
        record(day1, { type: "Movie", seconds: 100 }),
        record(day1, { seconds: 50 }),
        record(day3, { seconds: 10 }),
      ],
      new Date(2026, 9, 1).getTime(),
      new Date(2026, 9, 3, 23).getTime(),
      "day",
    );
    expect(t.movies).toEqual([100, 0, 0]);
    expect(t.episodes).toEqual([50, 0, 10]);
  });

  it("groups weeks starting on Monday", () => {
    // 2026-10-04 ist ein Sonntag, 2026-10-05 ein Montag
    const t = timeline(
      [record(new Date(2026, 9, 4, 12)), record(new Date(2026, 9, 5, 12))],
      new Date(2026, 9, 1).getTime(),
      new Date(2026, 9, 6).getTime(),
      "week",
    );
    expect(t.starts.map((s) => new Date(s).getDate())).toEqual([28, 5]);
    expect(t.episodes).toEqual([60, 60]);
  });
});

describe("heatmap", () => {
  it("puts Monday first and uses local hours", () => {
    const grid = heatmap([record(new Date(2026, 9, 5, 21, 30)), record(new Date(2026, 9, 4, 8))]);
    expect(grid[0]![21]).toBe(60); // Montag 21 Uhr
    expect(grid[6]![8]).toBe(60); // Sonntag 8 Uhr
  });
});

describe("rank", () => {
  it("sums per group, sorts by watch time and remembers the latest item", () => {
    const rows = rank(
      [
        record(new Date(2026, 9, 1), { series: "A", itemId: "a1", seconds: 10 }),
        record(new Date(2026, 9, 2), { series: "A", itemId: "a2", seconds: 10 }),
        record(new Date(2026, 9, 1), { series: "B", itemId: "b1", seconds: 30 }),
      ],
      (r) => r.series,
    );
    expect(rows.map((r) => [r.key, r.seconds, r.plays, r.itemId])).toEqual([
      ["B", 30, 1, "b1"],
      ["A", 20, 2, "a2"],
    ]);
  });
});
