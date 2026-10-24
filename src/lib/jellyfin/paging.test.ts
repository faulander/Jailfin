import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { describe, expect, it } from "vite-plus/test";
import { selectNextUp } from "../hidden/filters";
import { fetchAllPages, type PageFetcher } from "./paging";

const episode = (id: string, seriesId: string): BaseItemDto => ({
  Id: id,
  SeriesId: seriesId,
  Type: "Episode",
});

/** Simulierter Server mit `total` Next-Up-Einträgen, je eine Serie. */
function server(total: number, { reportTotal = true } = {}) {
  const all = Array.from({ length: total }, (_, i) => episode(`e${i}`, `s${i}`));
  const calls: [number, number][] = [];
  const fetchPage: PageFetcher = async (start, limit) => {
    calls.push([start, limit]);
    return {
      Items: all.slice(start, start + limit),
      ...(reportTotal ? { TotalRecordCount: total } : {}),
    };
  };
  return { all, calls, fetchPage };
}

describe("fetchAllPages", () => {
  it("loads every page until the reported total is reached", async () => {
    const { calls, fetchPage } = server(120);
    const items = await fetchAllPages(fetchPage, { pageSize: 50 });
    expect(items.map((i) => i.Id)).toEqual(Array.from({ length: 120 }, (_, i) => `e${i}`));
    expect(calls).toEqual([
      [0, 50],
      [50, 50],
      [100, 50],
    ]);
  });

  it("stops on a short page when the server omits the total", async () => {
    const { calls, fetchPage } = server(75, { reportTotal: false });
    const items = await fetchAllPages(fetchPage, { pageSize: 50 });
    expect(items).toHaveLength(75);
    expect(calls).toHaveLength(2);
  });

  it("stops on an empty page even if the total claims more", async () => {
    const fetchPage: PageFetcher = async (start) => ({
      Items: start === 0 ? [episode("a", "s")] : [],
      TotalRecordCount: 10,
    });
    expect(await fetchAllPages(fetchPage, { pageSize: 1 })).toHaveLength(1);
  });

  it("respects the safety cap without requesting beyond it", async () => {
    const { calls, fetchPage } = server(500);
    const items = await fetchAllPages(fetchPage, { pageSize: 50, maxItems: 120 });
    expect(items).toHaveLength(120);
    expect(calls.at(-1)).toEqual([100, 20]);
  });
});

describe("paging + hidden filter", () => {
  it("removes hidden series but keeps later results (more than one page)", async () => {
    // Szenario 8: 60 von 70 Serien ausgeblendet – die übrigen 10 stehen erst auf Seite 2.
    const { fetchPage } = server(70);
    const hidden = new Set(Array.from({ length: 60 }, (_, i) => `s${i}`));
    const items = selectNextUp(await fetchAllPages(fetchPage, { pageSize: 50 }), hidden);
    expect(items.map((i) => i.SeriesId)).toEqual(
      Array.from({ length: 10 }, (_, i) => `s${60 + i}`),
    );
  });
});
