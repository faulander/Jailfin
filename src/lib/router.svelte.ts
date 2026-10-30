import { randomId } from "./random-id";

/**
 * Kleiner History-API-Router mit Scroll-Wiederherstellung pro Verlaufseintrag.
 * Links sind normale `<a href>`-Elemente; `interceptLinks` fängt Klicks ab.
 */

export type Route =
  | { name: "home" }
  | { name: "movies" }
  | { name: "series" }
  | { name: "search" }
  | { name: "settings" }
  | { name: "stats" }
  | { name: "item"; id: string }
  | { name: "play"; id: string }
  | { name: "login" }
  | { name: "notFound" };

export function matchRoute(path: string): Route {
  const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
  if (parts.length === 0) return { name: "home" };
  const [first, second] = parts;
  if (parts.length === 1) {
    if (
      first === "movies" ||
      first === "series" ||
      first === "search" ||
      first === "settings" ||
      first === "stats"
    ) {
      return { name: first };
    }
    if (first === "login") return { name: "login" };
  }
  if (parts.length === 2 && second) {
    if (first === "item") return { name: "item", id: second };
    if (first === "play") return { name: "play", id: second };
  }
  return { name: "notFound" };
}

interface HistoryState {
  key: string;
  idx: number;
}

const SCROLL_STORE = "jailfin.scroll";

class Router {
  path = $state(location.pathname);
  search = $state(location.search);
  route = $derived(matchRoute(this.path));
  #state: HistoryState;
  #scroll: Record<string, number>;

  constructor() {
    history.scrollRestoration = "manual";
    const existing = history.state as Partial<HistoryState> | null;
    this.#state =
      existing?.key != null && existing.idx != null
        ? (existing as HistoryState)
        : { key: randomId(), idx: 0 };
    history.replaceState(this.#state, "");
    try {
      this.#scroll = JSON.parse(sessionStorage.getItem(SCROLL_STORE) ?? "{}");
    } catch {
      this.#scroll = {};
    }

    addEventListener("popstate", (event) => {
      this.#saveScroll();
      const state = event.state as HistoryState | null;
      this.#state = state ?? { key: randomId(), idx: 0 };
      this.#sync();
    });
    addEventListener("pagehide", () => this.#saveScroll());
  }

  get query(): URLSearchParams {
    return new URLSearchParams(this.search);
  }

  navigate(to: string, { replace = false } = {}): void {
    const url = new URL(to, location.href);
    if (url.pathname === this.path && url.search === this.search && !replace) return;
    this.#saveScroll();
    if (replace) {
      this.#state = { key: randomId(), idx: this.#state.idx };
      history.replaceState(this.#state, "", url);
    } else {
      this.#state = { key: randomId(), idx: this.#state.idx + 1 };
      history.pushState(this.#state, "", url);
    }
    this.#sync();
    scrollTo(0, 0);
  }

  /** Aktualisiert nur die Query (z. B. Sortierung), ohne neuen Verlaufseintrag. */
  setQuery(params: Record<string, string | null>): void {
    const q = this.query;
    for (const [k, v] of Object.entries(params)) {
      if (v == null || v === "") q.delete(k);
      else q.set(k, v);
    }
    const s = q.toString();
    history.replaceState(this.#state, "", `${this.path}${s ? `?${s}` : ""}`);
    this.search = location.search;
  }

  /** Zurück innerhalb der App; ohne App-Verlauf zur Fallback-Seite. */
  back(fallback = "/"): void {
    if (this.#state.idx > 0) history.back();
    else this.navigate(fallback, { replace: true });
  }

  /** Stellt die gespeicherte Scrollposition dieses Verlaufseintrags wieder her. */
  restoreScroll(): void {
    const y = this.#scroll[this.#state.key];
    if (y == null) return;
    let attempts = 0;
    const apply = () => {
      scrollTo(0, y);
      // Inhalte laden ggf. noch nach: wiederholen, bis die Position erreichbar ist.
      if (Math.abs(scrollY - y) > 2 && attempts++ < 20) requestAnimationFrame(apply);
    };
    requestAnimationFrame(apply);
  }

  #sync() {
    this.path = location.pathname;
    this.search = location.search;
  }

  #saveScroll() {
    this.#scroll[this.#state.key] = scrollY;
    const keys = Object.keys(this.#scroll);
    // Speicher begrenzen: nur die jüngsten Einträge behalten.
    for (const key of keys.slice(0, Math.max(0, keys.length - 100))) delete this.#scroll[key];
    try {
      sessionStorage.setItem(SCROLL_STORE, JSON.stringify(this.#scroll));
    } catch {
      // Scroll-Wiederherstellung ist optional.
    }
  }
}

export const router = new Router();

/** Globaler Klick-Handler: interne Links ohne Seiten-Reload navigieren. */
export function interceptLinks(event: MouseEvent): void {
  if (event.defaultPrevented || event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const anchor = (event.target as Element | null)?.closest?.("a");
  if (!anchor || anchor.target || anchor.hasAttribute("download")) return;
  const url = new URL(anchor.href, location.href);
  if (url.origin !== location.origin) return;
  event.preventDefault();
  router.navigate(url.pathname + url.search);
}
