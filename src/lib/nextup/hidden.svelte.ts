import { SvelteMap } from "svelte/reactivity";
import { HiddenSeriesStore, type HiddenSeriesPreference, type Scope } from "./hidden-store";

const sameScope = (a: Scope | null, b: Scope | null) =>
  a?.serverId === b?.serverId && a?.userId === b?.userId;

/** Reaktive Sicht auf die Ausblendungen des angemeldeten Benutzers. */
class HiddenSeries {
  readonly entries = new SvelteMap<string, HiddenSeriesPreference>();
  ready = $state(false);
  error = $state<unknown>(null);
  #scope: Scope | null = null;
  #loading: Promise<void> | null = null;
  #store = new HiddenSeriesStore();

  /** Lädt die Ausblendungen für Server+Benutzer; idempotent pro Scope. */
  load(scope: Scope): Promise<void> {
    if (sameScope(scope, this.#scope) && this.#loading) return this.#loading;
    this.#scope = scope;
    this.ready = false;
    this.entries.clear();
    this.#loading = this.#store.list(scope).then(
      (records) => {
        if (!sameScope(scope, this.#scope)) return;
        for (const r of records) this.entries.set(r.seriesId, r);
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

  has(seriesId: string | null | undefined): boolean {
    return !!seriesId && this.entries.has(seriesId);
  }

  get ids(): ReadonlySet<string> {
    return new Set(this.entries.keys());
  }

  /** Optimistisch ausblenden; bei Speicherfehler wird der Zustand zurückgesetzt. */
  async hide(seriesId: string, seriesName?: string): Promise<void> {
    const scope = this.#requireScope();
    const optimistic: HiddenSeriesPreference = {
      ...scope,
      seriesId,
      hiddenAt: new Date().toISOString(),
      ...(seriesName ? { seriesName } : {}),
    };
    this.entries.set(seriesId, optimistic);
    try {
      this.entries.set(seriesId, await this.#store.hide(scope, seriesId, seriesName));
    } catch (error) {
      this.entries.delete(seriesId);
      throw error;
    }
  }

  async unhide(seriesId: string): Promise<void> {
    const scope = this.#requireScope();
    const previous = this.entries.get(seriesId);
    this.entries.delete(seriesId);
    try {
      await this.#store.unhide(scope, seriesId);
    } catch (error) {
      if (previous) this.entries.set(seriesId, previous);
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

export const hiddenSeries = new HiddenSeries();
