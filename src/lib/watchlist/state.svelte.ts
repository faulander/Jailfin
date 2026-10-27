import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import type { UserScope } from "../jellyfin/session.svelte";
import { readCustomPrefs, updateCustomPrefs } from "../jellyfin/user-prefs";
import { parseWatchlist, type WatchlistEntry } from "./watchlist";

/**
 * Die Merkliste liegt in den Jellyfin-Anzeigeeinstellungen des Benutzers (siehe user-prefs.ts).
 * Damit ist sie auf allen Geräten gleich, ohne eigenes Backend.
 */
const KEY = "watchlist";

const sameScope = (a: UserScope | null, b: UserScope | null) =>
  a?.serverId === b?.serverId && a?.userId === b?.userId;

class Watchlist {
  entries = $state<WatchlistEntry[]>([]);
  ready = $state(false);
  error = $state<unknown>(null);
  #scope: UserScope | null = null;

  async load(scope: UserScope): Promise<void> {
    this.#scope = scope;
    this.ready = false;
    try {
      const prefs = await readCustomPrefs();
      if (!sameScope(scope, this.#scope)) return;
      this.entries = parseWatchlist(prefs[KEY]);
      this.error = null;
    } catch (error) {
      if (sameScope(scope, this.#scope)) this.error = error;
    } finally {
      if (sameScope(scope, this.#scope)) this.ready = true;
    }
  }

  reset(): void {
    this.#scope = null;
    this.entries = [];
    this.ready = false;
    this.error = null;
  }

  has(id: string | null | undefined): boolean {
    return !!id && this.entries.some((e) => e.id === id);
  }

  add(item: BaseItemDto): Promise<void> {
    if (!item.Id || (item.Type !== "Movie" && item.Type !== "Series") || this.has(item.Id)) {
      return Promise.resolve();
    }
    const entry: WatchlistEntry = {
      id: item.Id,
      type: item.Type,
      addedAt: new Date().toISOString(),
    };
    return this.#update(
      () => [...this.entries, entry],
      (list) => (list.some((e) => e.id === entry.id) ? list : [...list, entry]),
    );
  }

  remove(ids: string[]): Promise<void> {
    const drop = new Set(ids.filter((id) => this.has(id)));
    if (drop.size === 0) return Promise.resolve();
    return this.#update(
      () => this.entries.filter((e) => !drop.has(e.id)),
      (list) => list.filter((e) => !drop.has(e.id)),
    );
  }

  /**
   * Optimistisch lokal ändern, dann auf dem Server lesen–ändern–schreiben, damit Änderungen
   * anderer Geräte erhalten bleiben. Bei Fehlern wird der Serverstand wiederhergestellt.
   */
  #update(
    local: () => WatchlistEntry[],
    remote: (list: WatchlistEntry[]) => WatchlistEntry[],
  ): Promise<void> {
    const scope = this.#scope;
    this.entries = local();
    let next: WatchlistEntry[] = [];
    return updateCustomPrefs((prefs) => {
      next = remote(parseWatchlist(prefs[KEY]));
      return { [KEY]: JSON.stringify(next) };
    }).then(
      () => {
        if (sameScope(scope, this.#scope)) this.entries = next;
      },
      async (error: unknown) => {
        if (scope) await this.load(scope);
        throw error;
      },
    );
  }
}

export const watchlist = new Watchlist();
