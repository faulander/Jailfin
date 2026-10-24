import { IDBFactory } from "fake-indexeddb";
import "fake-indexeddb/auto";
import { describe, expect, it } from "vite-plus/test";
import { HiddenStore } from "./store";

const alice = { serverId: "server-1", userId: "alice" };
const bob = { serverId: "server-1", userId: "bob" };
const aliceOnOtherServer = { serverId: "server-2", userId: "alice" };

const ids = async (store: HiddenStore, scope: typeof alice, list: "nextUp" | "resume" = "nextUp") =>
  (await store.list(scope, list)).map((r) => r.id).sort();

describe("HiddenStore", () => {
  it("persists entries across store instances (reload/restart)", async () => {
    const factory = new IDBFactory();
    const first = new HiddenStore(factory);
    await first.hide(alice, "nextUp", "series-a", { name: "Serie A" });
    first.close();

    const records = await new HiddenStore(factory).list(alice, "nextUp");
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ ...alice, list: "nextUp", id: "series-a", name: "Serie A" });
    expect(Number.isNaN(Date.parse(records[0]!.hiddenAt))).toBe(false);
  });

  it("isolates users, servers and lists", async () => {
    const store = new HiddenStore(new IDBFactory());
    await store.hide(alice, "nextUp", "a");
    await store.hide(bob, "nextUp", "b");
    await store.hide(aliceOnOtherServer, "nextUp", "c");
    await store.hide(alice, "resume", "movie-1", { lastPlayed: "2026-10-24T10:00:00Z" });

    expect(await ids(store, alice)).toEqual(["a"]);
    expect(await ids(store, bob)).toEqual(["b"]);
    expect(await ids(store, aliceOnOtherServer)).toEqual(["c"]);
    expect(await store.list(alice, "resume")).toMatchObject([
      { id: "movie-1", lastPlayed: "2026-10-24T10:00:00Z" },
    ]);
  });

  it("unhide removes only the given entry", async () => {
    const store = new HiddenStore(new IDBFactory());
    await store.hide(alice, "nextUp", "a");
    await store.hide(alice, "nextUp", "b");
    await store.hide(alice, "resume", "a");
    await store.hide(bob, "nextUp", "a");

    await store.unhide(alice, "nextUp", "a");

    expect(await ids(store, alice)).toEqual(["b"]);
    expect(await ids(store, alice, "resume")).toEqual(["a"]);
    expect(await ids(store, bob)).toEqual(["a"]);
  });

  it("migrates hidden series from database version 1", async () => {
    const factory = new IDBFactory();
    // Datenbank so anlegen, wie Version 0.1.0 sie hinterlassen hat.
    await new Promise<void>((resolve, reject) => {
      const open = factory.open("jailfin", 1);
      open.onupgradeneeded = () => {
        const v1 = open.result.createObjectStore("hiddenSeries", {
          keyPath: ["serverId", "userId", "seriesId"],
        });
        v1.createIndex("byScope", ["serverId", "userId"]);
        v1.put({
          ...alice,
          seriesId: "old-series",
          hiddenAt: "2026-10-01T00:00:00.000Z",
          seriesName: "Alt",
        });
        v1.put({ ...bob, seriesId: "bobs-series", hiddenAt: "2026-10-02T00:00:00.000Z" });
      };
      open.onsuccess = () => {
        open.result.close();
        resolve();
      };
      open.onerror = () => reject(open.error);
    });

    const store = new HiddenStore(factory);
    expect(await store.list(alice, "nextUp")).toEqual([
      {
        ...alice,
        list: "nextUp",
        id: "old-series",
        hiddenAt: "2026-10-01T00:00:00.000Z",
        name: "Alt",
      },
    ]);
    expect(await ids(store, bob)).toEqual(["bobs-series"]);
    expect(await ids(store, alice, "resume")).toEqual([]);
  });
});
