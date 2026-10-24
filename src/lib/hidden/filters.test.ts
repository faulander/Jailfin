import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { describe, expect, it } from "vite-plus/test";
import { selectNextUp, selectResume } from "./filters";

const episode = (id: string, seriesId: string): BaseItemDto => ({
  Id: id,
  SeriesId: seriesId,
  Type: "Episode",
});

describe("selectNextUp", () => {
  it("keeps at most one episode per series in server order", () => {
    const items = [episode("a1", "A"), episode("b1", "B"), episode("a2", "A"), episode("c1", "C")];
    expect(selectNextUp(items, new Set()).map((i) => i.Id)).toEqual(["a1", "b1", "c1"]);
  });

  it("matches hidden entries by SeriesId, not by name", () => {
    const items: BaseItemDto[] = [
      { Id: "x", SeriesId: "id-1", SeriesName: "Doppelt" },
      { Id: "y", SeriesId: "id-2", SeriesName: "Doppelt" },
    ];
    expect(selectNextUp(items, new Set(["id-1"])).map((i) => i.Id)).toEqual(["y"]);
  });
});

describe("selectResume", () => {
  const item = (id: string, lastPlayed?: string): BaseItemDto => ({
    Id: id,
    UserData: { Key: id, ...(lastPlayed ? { LastPlayedDate: lastPlayed } : {}) },
  });

  it("hides an item while it has not been played again", () => {
    const hidden = new Map([["m1", { lastPlayed: "2026-10-24T10:00:00Z" }]]);
    const items = [item("m1", "2026-10-24T10:00:00Z"), item("m2", "2026-10-24T09:00:00Z")];
    expect(selectResume(items, hidden).map((i) => i.Id)).toEqual(["m2"]);
  });

  it("shows the item again once it was watched after hiding", () => {
    const hidden = new Map([["m1", { lastPlayed: "2026-10-24T10:00:00Z" }]]);
    expect(selectResume([item("m1", "2026-10-25T20:00:00Z")], hidden)).toHaveLength(1);
  });

  it("hides items without any play date when hidden without one", () => {
    const hidden = new Map([["m1", {}]]);
    expect(selectResume([item("m1")], hidden)).toEqual([]);
  });
});
