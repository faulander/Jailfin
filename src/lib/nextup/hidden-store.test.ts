import { IDBFactory } from "fake-indexeddb";
import "fake-indexeddb/auto";
import { describe, expect, it } from "vite-plus/test";
import { HiddenSeriesStore } from "./hidden-store";

const alice = { serverId: "server-1", userId: "alice" };
const bob = { serverId: "server-1", userId: "bob" };
const aliceOnOtherServer = { serverId: "server-2", userId: "alice" };

describe("HiddenSeriesStore", () => {
  it("persists hidden series across store instances (reload/restart)", async () => {
    const factory = new IDBFactory();
    const first = new HiddenSeriesStore(factory);
    await first.hide(alice, "series-a", "Serie A");
    first.close();

    const second = new HiddenSeriesStore(factory);
    const records = await second.list(alice);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ ...alice, seriesId: "series-a", seriesName: "Serie A" });
    expect(Number.isNaN(Date.parse(records[0]!.hiddenAt))).toBe(false);
  });

  it("isolates users and servers", async () => {
    const store = new HiddenSeriesStore(new IDBFactory());
    await store.hide(alice, "series-a");
    await store.hide(bob, "series-b");
    await store.hide(aliceOnOtherServer, "series-c");

    expect((await store.list(alice)).map((r) => r.seriesId)).toEqual(["series-a"]);
    expect((await store.list(bob)).map((r) => r.seriesId)).toEqual(["series-b"]);
    expect((await store.list(aliceOnOtherServer)).map((r) => r.seriesId)).toEqual(["series-c"]);
  });

  it("unhide removes only the given series for the given user", async () => {
    const store = new HiddenSeriesStore(new IDBFactory());
    await store.hide(alice, "series-a");
    await store.hide(alice, "series-b");
    await store.hide(bob, "series-a");

    await store.unhide(alice, "series-a");

    expect((await store.list(alice)).map((r) => r.seriesId)).toEqual(["series-b"]);
    expect((await store.list(bob)).map((r) => r.seriesId)).toEqual(["series-a"]);
  });

  it("hiding the same series twice keeps a single entry", async () => {
    const store = new HiddenSeriesStore(new IDBFactory());
    await store.hide(alice, "series-a");
    await store.hide(alice, "series-a");
    expect(await store.list(alice)).toHaveLength(1);
  });
});
