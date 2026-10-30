import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { describe, expect, it } from "vite-plus/test";
import { activityFrom, isStarted, parseWatchlist } from "./watchlist";

const none = activityFrom();

describe("parseWatchlist", () => {
  it("keeps valid entries once and drops garbage", () => {
    const raw = JSON.stringify([
      { id: "a", type: "Movie", addedAt: "2026-10-25" },
      { id: "a", type: "Movie", addedAt: "dup" },
      { id: "b", type: "Episode" },
      { type: "Series" },
      null,
      { id: "c", type: "Series", addedAt: "2026-10-24" },
    ]);
    expect(parseWatchlist(raw).map((e) => e.id)).toEqual(["a", "c"]);
  });

  it("tolerates missing or broken data", () => {
    expect(parseWatchlist(undefined)).toEqual([]);
    expect(parseWatchlist("{kaputt")).toEqual([]);
    expect(parseWatchlist('{"id":"a"}')).toEqual([]);
  });
});

describe("isStarted", () => {
  const movie = (data: BaseItemDto["UserData"]): BaseItemDto => ({
    Id: "m",
    Type: "Movie",
    UserData: data,
  });
  const series = (data: BaseItemDto["UserData"]): BaseItemDto => ({
    Id: "s",
    Type: "Series",
    UserData: data,
  });

  it("legacy entries (no baseline): an untouched movie or series is not started", () => {
    expect(isStarted(movie({ Key: "m" }), none)).toBe(false);
    expect(isStarted(series({ Key: "s", PlayedPercentage: 0 }), none)).toBe(false);
  });

  it("a movie counts as started once playback began", () => {
    expect(isStarted(movie({ Key: "m", PlaybackPositionTicks: 1 }), none)).toBe(true);
    expect(isStarted(movie({ Key: "m", Played: true }), none)).toBe(true);
  });

  it("a series counts as started after one watched episode", () => {
    expect(isStarted(series({ Key: "s", PlayedPercentage: 10 }), none)).toBe(true);
  });

  it("a series with only an in-progress episode counts as started via the home lists", () => {
    const resume: BaseItemDto[] = [
      {
        Id: "e1",
        Type: "Episode",
        SeriesId: "s",
        UserData: { Key: "e1", PlaybackPositionTicks: 5 },
      },
    ];
    expect(isStarted(series({ Key: "s", PlayedPercentage: 0 }), activityFrom(resume))).toBe(true);
  });

  describe("entries added while already started (baseline)", () => {
    const addedAt = "2026-10-30T12:00:00.000Z";
    const entry = (id: string, playedPercentage: number) => ({
      id,
      type: "Series" as const,
      addedAt,
      baseline: { played: false, playedPercentage },
    });

    it("keeps a series that was already in progress when it was added", () => {
      const s = series({ Key: "s", PlayedPercentage: 30 });
      const nextUp: BaseItemDto[] = [
        { Id: "e4", Type: "Episode", SeriesId: "s", UserData: { Key: "e4" } },
      ];
      expect(isStarted(s, activityFrom(nextUp), entry("s", 30))).toBe(false);
    });

    it("removes it once another episode was finished after adding", () => {
      expect(isStarted(series({ Key: "s", PlayedPercentage: 40 }), none, entry("s", 30))).toBe(
        true,
      );
    });

    it("removes it once an episode was started after adding (in another client)", () => {
      const resume: BaseItemDto[] = [
        {
          Id: "e4",
          Type: "Episode",
          SeriesId: "s",
          UserData: {
            Key: "e4",
            PlaybackPositionTicks: 5,
            LastPlayedDate: "2026-10-30T20:00:00.0000000Z",
          },
        },
      ];
      expect(
        isStarted(series({ Key: "s", PlayedPercentage: 30 }), activityFrom(resume), entry("s", 30)),
      ).toBe(true);
    });

    it("ignores episodes watched before adding", () => {
      const resume: BaseItemDto[] = [
        {
          Id: "e3",
          Type: "Episode",
          SeriesId: "s",
          UserData: { Key: "e3", PlaybackPositionTicks: 5, LastPlayedDate: "2026-10-29T20:00:00Z" },
        },
      ];
      expect(
        isStarted(series({ Key: "s", PlayedPercentage: 30 }), activityFrom(resume), entry("s", 30)),
      ).toBe(false);
    });

    it("a movie leaves the list when played after adding", () => {
      const m = {
        id: "m",
        type: "Movie" as const,
        addedAt,
        baseline: { played: false, playedPercentage: 0 },
      };
      expect(
        isStarted(
          movie({ Key: "m", LastPlayedDate: "2026-10-31T10:00:00Z", PlaybackPositionTicks: 9 }),
          none,
          m,
        ),
      ).toBe(true);
      expect(
        isStarted(
          movie({ Key: "m", LastPlayedDate: "2026-10-01T10:00:00Z", PlaybackPositionTicks: 9 }),
          none,
          m,
        ),
      ).toBe(false);
    });
  });
});
