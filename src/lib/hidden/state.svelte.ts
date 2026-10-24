import { SvelteMap } from "svelte/reactivity";
import { HiddenStore, type HiddenEntry, type HiddenList, type Scope } from "./store";

const sameScope = (a: Scope | null, b: Scope | null) =>
  a?.serverId === b?.serverId && a?.userId === b?.userId;

const store = new HiddenStore();

/** Reaktive Sicht auf eine Ausblendungsliste des angemeldeten Benutzers. */
export class HiddenItems {
  readonly entries = new SvelteMap<string, HiddenEntry>();
  ready = $state(false);
  error = $state<unknown>(null);
  #scope: Scope | null = null;
  #loading: Promise<void> | null = null;

  constructor(private readonly list: HiddenList) {}

  /** Lädt die Einträge für Server+Benutzer; idempotent pro Scope. */
  load(scope: Scope): Promise<void> {
    if (sameScope(scope, this.#scope) && this.#loading) return this.#loading;
    this.#scope = scope;
    this.ready = false;
    this.entries.clear();
    this.#loading = store.list(scope, this.list).then(
      (records) => {
        if (!sameScope(scope, this.#scope)) return;
        for (const r of records) this.entries.set(r.id, r);
        this.error = null;
        this.ready = true;
      },
      (error: unknown) => {
        this.error = error;
        this.#loading = null;
        throw error;
      },
    );
    return this.#loading;
  }

  has(id: string | null | undefined): boolean {
    return !!id && this.entries.has(id);
  }

  get ids(): ReadonlySet<string> {
    return new Set(this.entries.keys());
  }

  /** Optimistisch ausblenden; bei Speicherfehler wird der Zustand zurückgesetzt. */
  async hide(id: string, details: { name?: string; lastPlayed?: string } = {}): Promise<void> {
    const scope = this.#requireScope();
    const previous = this.entries.get(id);
    this.entries.set(id, {
      ...scope,
      list: this.list,
      id,
      hiddenAt: new Date().toISOString(),
      ...details,
    });
    try {
      this.entries.set(id, await store.hide(scope, this.list, id, details));
    } catch (error) {
      if (previous) this.entries.set(id, previous);
      else this.entries.delete(id);
      throw error;
    }
  }

  async unhide(id: string): Promise<void> {
    const scope = this.#requireScope();
    const previous = this.entries.get(id);
    this.entries.delete(id);
    try {
      await store.unhide(scope, this.list, id);
    } catch (error) {
      if (previous) this.entries.set(id, previous);
      throw error;
    }
  }

  reset(): void {
    this.#scope = null;
    this.#loading = null;
    this.entries.clear();
    this.ready = false;
  }

  #requireScope(): Scope {
    if (!this.#scope) throw new Error("Kein Benutzer angemeldet");
    return this.#scope;
  }
}

/** Serien, die nicht unter „Als nächstes“ erscheinen (Schlüssel: SeriesId). */
export const hiddenSeries = new HiddenItems("nextUp");
/** Titel, die nicht unter „Weiterschauen“ erscheinen (Schlüssel: ItemId). */
export const hiddenResume = new HiddenItems("resume");
