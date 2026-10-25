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

  it("treats an untouched movie or series as not started", () => {
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
});
