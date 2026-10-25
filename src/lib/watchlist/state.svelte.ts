import type { BaseItemDto, DisplayPreferencesDto } from "@jellyfin/sdk/lib/generated-client/models";
import { getDisplayPreferenceApi } from "@jellyfin/sdk/lib/utils/api";
import { session, type UserScope } from "../jellyfin/session.svelte";
import { parseWatchlist, type WatchlistEntry } from "./watchlist";

/**
 * Die Merkliste liegt in den Jellyfin-Anzeigeeinstellungen des Benutzers (DisplayPreferences,
 * Client „jailfin“). Damit ist sie auf allen Geräten gleich, ohne eigenes Backend.
 */
const PREFS_ID = "jailfin";
const CLIENT = "jailfin";
const KEY = "watchlist";

async function readPrefs(): Promise<DisplayPreferencesDto> {
  const { data } = await getDisplayPreferenceApi(session.api).getDisplayPreferences({
    displayPreferencesId: PREFS_ID,
    client: CLIENT,
    userId: session.userId,
  });
  return data;
}

const sameScope = (a: UserScope | null, b: UserScope | null) =>
  a?.serverId === b?.serverId && a?.userId === b?.userId;

class Watchlist {
  entries = $state<WatchlistEntry[]>([]);
  ready = $state(false);
  error = $state<unknown>(null);
  #scope: UserScope | null = null;
  /** Schreibvorgänge nacheinander, damit sich Änderungen nicht gegenseitig überschreiben. */
  #queue: Promise<unknown> = Promise.resolve();

  async load(scope: UserScope): Promise<void> {
    this.#scope = scope;
    this.ready = false;
    try {
      const prefs = await readPrefs();
      if (!sameScope(scope, this.#scope)) return;
      this.entries = parseWatchlist(prefs.CustomPrefs?.[KEY]);
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
    const run = this.#queue.then(async () => {
      const prefs = await readPrefs();
      const next = remote(parseWatchlist(prefs.CustomPrefs?.[KEY]));
      await getDisplayPreferenceApi(session.api).updateDisplayPreferences({
        displayPreferencesId: PREFS_ID,
        client: CLIENT,
        userId: session.userId,
        displayPreferencesDto: {
          ...prefs,
          CustomPrefs: { ...prefs.CustomPrefs, [KEY]: JSON.stringify(next) },
        },
      });
      if (sameScope(scope, this.#scope)) this.entries = next;
    });
    this.#queue = run.catch(() => undefined);
    return run.catch(async (error: unknown) => {
      if (scope) await this.load(scope);
      throw error;
    });
  }
}

export const watchlist = new Watchlist();
