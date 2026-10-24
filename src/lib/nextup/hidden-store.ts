/**
 * Persistente, rein clientseitige Ausblendungen für „Als nächstes“ (PRD 4.3, 7.3).
 * Schlüssel: (serverId, userId, seriesId) — stabile Jellyfin-IDs, nie Namen.
 */

export interface HiddenSeriesPreference {
  serverId: string;
  userId: string;
  seriesId: string;
  /** ISO-8601 */
  hiddenAt: string;
  /** Nur Anzeige-Cache für die Einstellungen; maßgeblich ist die seriesId. */
  seriesName?: string;
}

export interface Scope {
  serverId: string;
  userId: string;
}

const DB_NAME = "jailfin";
/** Bei Schemaänderungen erhöhen und in `migrate` einen neuen Schritt ergänzen. */
export const DB_VERSION = 1;
const STORE = "hiddenSeries";
const BY_SCOPE = "byScope";

function migrate(db: IDBDatabase, oldVersion: number): void {
  if (oldVersion < 1) {
    const store = db.createObjectStore(STORE, { keyPath: ["serverId", "userId", "seriesId"] });
    store.createIndex(BY_SCOPE, ["serverId", "userId"], { unique: false });
  }
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export class HiddenSeriesStore {
  #db: Promise<IDBDatabase> | undefined;

  constructor(private readonly factory: IDBFactory = globalThis.indexedDB) {}

  #open(): Promise<IDBDatabase> {
    this.#db ??= new Promise<IDBDatabase>((resolve, reject) => {
      if (!this.factory) {
        reject(new Error("IndexedDB nicht verfügbar"));
        return;
      }
      const request = this.factory.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event) => migrate(request.result, event.oldVersion);
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

  list(scope: Scope): Promise<HiddenSeriesPreference[]> {
    return this.#tx("readonly", (store) =>
      store.index(BY_SCOPE).getAll(IDBKeyRange.only([scope.serverId, scope.userId])),
    );
  }

  async hide(scope: Scope, seriesId: string, seriesName?: string): Promise<HiddenSeriesPreference> {
    const record: HiddenSeriesPreference = {
      serverId: scope.serverId,
      userId: scope.userId,
      seriesId,
      hiddenAt: new Date().toISOString(),
      ...(seriesName ? { seriesName } : {}),
    };
    await this.#tx("readwrite", (store) => store.put(record));
    return record;
  }

  async unhide(scope: Scope, seriesId: string): Promise<void> {
    await this.#tx("readwrite", (store) => store.delete([scope.serverId, scope.userId, seriesId]));
  }

  close(): void {
    void this.#db?.then((db) => db.close()).catch(() => undefined);
    this.#db = undefined;
  }
}
