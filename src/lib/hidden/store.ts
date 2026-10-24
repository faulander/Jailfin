/**
 * Persistente, rein clientseitige Ausblendungen (PRD 4.3, 7.3). Nichts davon
 * verändert Daten auf dem Jellyfin-Server.
 *
 * Schlüssel: (serverId, userId, list, id) — stabile Jellyfin-IDs, nie Namen.
 * - list "nextUp": id = SeriesId (ganze Serie aus „Als nächstes“)
 * - list "resume": id = ItemId (einzelner Titel aus „Weiterschauen“)
 */

export type HiddenList = "nextUp" | "resume";

export interface HiddenEntry {
  serverId: string;
  userId: string;
  list: HiddenList;
  id: string;
  /** ISO-8601, Zeitpunkt des Ausblendens (Client-Uhr, nur Anzeige) */
  hiddenAt: string;
  /** Anzeige-Cache für die Einstellungen; maßgeblich ist die id. */
  name?: string;
  /**
   * Nur "resume": `UserData.LastPlayedDate` des Servers beim Ausblenden. Ändert es
   * sich (erneut angesehen), erscheint der Titel wieder. Server-Zeit, daher
   * unabhängig von Uhrabweichungen des Geräts.
   */
  lastPlayed?: string;
}

export interface Scope {
  serverId: string;
  userId: string;
}

const DB_NAME = "jailfin";
/** Bei Schemaänderungen erhöhen und in `migrate` einen neuen Schritt ergänzen. */
export const DB_VERSION = 2;
const STORE = "hidden";
const BY_LIST = "byList";

/** Schritte sind kumulativ: eine v0-Installation durchläuft alle, eine v1-Installation ab Schritt 2. */
function migrate(db: IDBDatabase, tx: IDBTransaction, oldVersion: number): void {
  if (oldVersion < 1) {
    // v1: nur ausgeblendete Serien
    const v1 = db.createObjectStore("hiddenSeries", {
      keyPath: ["serverId", "userId", "seriesId"],
    });
    v1.createIndex("byScope", ["serverId", "userId"], { unique: false });
  }
  if (oldVersion < 2) {
    // v2: gemeinsamer Store für mehrere Listen; v1-Daten werden übernommen.
    const store = db.createObjectStore(STORE, { keyPath: ["serverId", "userId", "list", "id"] });
    store.createIndex(BY_LIST, ["serverId", "userId", "list"], { unique: false });
    const cursorRequest = tx.objectStore("hiddenSeries").openCursor();
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (!cursor) {
        db.deleteObjectStore("hiddenSeries");
        return;
      }
      const old = cursor.value as {
        serverId: string;
        userId: string;
        seriesId: string;
        hiddenAt: string;
        seriesName?: string;
      };
      const entry: HiddenEntry = {
        serverId: old.serverId,
        userId: old.userId,
        list: "nextUp",
        id: old.seriesId,
        hiddenAt: old.hiddenAt,
        ...(old.seriesName ? { name: old.seriesName } : {}),
      };
      store.put(entry);
      cursor.continue();
    };
  }
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export class HiddenStore {
  #db: Promise<IDBDatabase> | undefined;

  constructor(private readonly factory: IDBFactory = globalThis.indexedDB) {}

  #open(): Promise<IDBDatabase> {
    this.#db ??= new Promise<IDBDatabase>((resolve, reject) => {
      if (!this.factory) {
        reject(new Error("IndexedDB nicht verfügbar"));
        return;
      }
      const request = this.factory.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event) =>
        migrate(request.result, request.transaction!, event.oldVersion);
      request.onsuccess = () => {
        const db = request.result;
        // Andere Tabs mit neuerer Version nicht blockieren.
        db.onversionchange = () => {
          db.close();
          this.#db = undefined;
        };
        resolve(db);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("IndexedDB blockiert"));
    }).catch((error: unknown) => {
      this.#db = undefined;
      throw error;
    });
    return this.#db;
  }

  async #tx<T>(
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const db = await this.#open();
    const tx = db.transaction(STORE, mode);
    const result = promisify(run(tx.objectStore(STORE)));
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error("Transaktion abgebrochen"));
    });
    return result;
  }

  list(scope: Scope, list: HiddenList): Promise<HiddenEntry[]> {
    return this.#tx("readonly", (store) =>
      store.index(BY_LIST).getAll(IDBKeyRange.only([scope.serverId, scope.userId, list])),
    );
  }

  async hide(
    scope: Scope,
    list: HiddenList,
    id: string,
    details: { name?: string; lastPlayed?: string } = {},
  ): Promise<HiddenEntry> {
    const entry: HiddenEntry = {
      serverId: scope.serverId,
      userId: scope.userId,
      list,
      id,
      hiddenAt: new Date().toISOString(),
      ...(details.name ? { name: details.name } : {}),
      ...(details.lastPlayed ? { lastPlayed: details.lastPlayed } : {}),
    };
    await this.#tx("readwrite", (store) => store.put(entry));
    return entry;
  }

  async unhide(scope: Scope, list: HiddenList, id: string): Promise<void> {
    await this.#tx("readwrite", (store) => store.delete([scope.serverId, scope.userId, list, id]));
  }

  close(): void {
    void this.#db?.then((db) => db.close()).catch(() => undefined);
    this.#db = undefined;
  }
}
