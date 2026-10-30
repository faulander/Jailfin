<script lang="ts" module>
  import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
  import type { LibrarySort } from "../lib/jellyfin/queries";

  interface Loaded {
    items: BaseItemDto[];
    total: number;
    /** Benutzerdaten-Version beim Laden (siehe userdata.svelte.ts) */
    version: number;
  }

  interface ViewPrefs {
    sort: LibrarySort;
    unwatchedOnly: boolean;
    favoritesOnly: boolean;
    genres: string[];
    /** Rohtext des Jahresfilters, z. B. „>1985“ */
    year: string;
  }

  // Geladene Seiten bleiben erhalten, damit „Zurück“ Position und Inhalt behält. Nach
  // „gesehen“/„Favorit“-Änderungen (neue Benutzerdaten-Version) wird beim nächsten Aufruf neu geladen.
  const cache = new Map<string, Loaded>();
  // Genres je Bibliothek (ändern sich selten)
  const genreCache = new Map<string, string[]>();
  const PAGE_SIZE = 60;
  const SORT_VALUES: LibrarySort[] = ["title", "year", "added", "rating"];
  const prefsKey = (type: string, favorites: boolean) => `jailfin.library.${favorites ? "fav." : ""}${type}.v1`;

  /** URL hat Vorrang (Zurück/Deep-Link), sonst die zuletzt gewählte Ansicht dieses Geräts. */
  function initialPrefs(type: string, favorites: boolean, query: URLSearchParams): ViewPrefs {
    let stored: Partial<ViewPrefs> = {};
    try {
      stored = JSON.parse(localStorage.getItem(prefsKey(type, favorites)) ?? "{}") as Partial<ViewPrefs>;
    } catch {
      // ungültige Daten ignorieren
    }
    const sortParam = query.get("sort") ?? stored.sort;
    // Ohne Query-Parameter (Aufruf über die Navigation) gilt die gespeicherte Ansicht.
    const fromUrl = ["sort", "unwatched", "fav", "genre", "year"].some((p) => query.has(p));
    return {
      sort: SORT_VALUES.includes(sortParam as LibrarySort) ? (sortParam as LibrarySort) : "title",
      unwatchedOnly: fromUrl ? query.has("unwatched") : stored.unwatchedOnly === true,
      favoritesOnly: favorites || (fromUrl ? query.has("fav") : stored.favoritesOnly === true),
      genres: fromUrl
        ? (query.get("genre") ?? "").split("|").filter(Boolean)
        : Array.isArray(stored.genres)
          ? stored.genres.filter((g) => typeof g === "string")
          : [],
      year: fromUrl ? (query.get("year") ?? "") : typeof stored.year === "string" ? stored.year : "",
    };
  }
</script>

<script lang="ts">
  import { tick, untrack } from "svelte";
  import Icon from "../components/Icon.svelte";
  import PosterGrid from "../components/PosterGrid.svelte";
  import StateView from "../components/StateView.svelte";
  import { m } from "../lib/i18n";
  import { parseYearFilter, yearsOf } from "../lib/library-filters";
  import { loadGenres, loadLibraryPage } from "../lib/jellyfin/queries";
  import { session } from "../lib/jellyfin/session.svelte";
  import { userDataVersion } from "../lib/jellyfin/userdata.svelte";
  import { router } from "../lib/router.svelte";

  /** `favorites`: Favoriten-Seite (nur Favoriten, mit Umschalter Serien/Filme). */
  let { type, favorites = false }: { type: "Movie" | "Series"; favorites?: boolean } = $props();

  const sorts: { value: LibrarySort; label: string }[] = [
    { value: "title", label: m.library.sortTitle },
    { value: "year", label: m.library.sortYear },
    { value: "added", label: m.library.sortAdded },
    { value: "rating", label: m.library.sortRating },
  ];

  const initial = untrack(() => initialPrefs(type, favorites, router.query));
  let sort = $state<LibrarySort>(initial.sort);
  let unwatchedOnly = $state(initial.unwatchedOnly);
  let favoritesOnly = $state(initial.favoritesOnly);
  let genres = $state<string[]>(initial.genres);
  let year = $state(initial.year);
  let yearInput = $state(initial.year);
  let items = $state<BaseItemDto[]>([]);
  let total = $state(0);
  let loading = $state(false);
  let error = $state<unknown>(null);
  let controller: AbortController | undefined;

  const yearRange = $derived(parseYearFilter(year));
  const yearInvalid = $derived(yearInput.trim() !== "" && parseYearFilter(yearInput) === null);
  const filtered = $derived(unwatchedOnly || (!favorites && favoritesOnly) || genres.length > 0 || !!yearRange);

  // Ohne Benutzerdaten-Version: Ein Favoriten-/Merken-Tipp im Raster soll die Liste nicht neu
  // aufbauen. Die Version wird beim Lesen aus dem Cache geprüft (nächster Aufruf lädt frisch).
  const key = $derived(
    [
      session.current?.serverId,
      session.userId,
      type,
      sort,
      unwatchedOnly ? "unwatched" : "all",
      favoritesOnly ? "fav" : "",
      genres.join("|"),
      yearRange ? `${yearRange.min}-${yearRange.max}` : "",
    ].join("/"),
  );

  async function loadMore() {
    if (loading) return;
    loading = true;
    error = null;
    const requestKey = key;
    const signal = controller?.signal;
    try {
      const page = await loadLibraryPage(type, sort, items.length, PAGE_SIZE, signal, {
        unwatchedOnly,
        favoritesOnly,
        genres,
        years: yearRange ? yearsOf(yearRange) : [],
      });
      if (requestKey !== key) return;
      items = [...items, ...(page.Items ?? [])];
      total = page.TotalRecordCount ?? items.length;
      cache.set(requestKey, { items, total, version: userDataVersion.value });
    } catch (e) {
      if (!signal?.aborted && requestKey === key) error = e;
    } finally {
      if (requestKey === key) loading = false;
    }
  }

  // Bei Ansichtswechsel bzw. erstem Aufruf: aus dem Cache oder neu laden.
  $effect(() => {
    const k = key;
    untrack(() => {
      controller?.abort();
      controller = new AbortController();
      const cached = cache.get(k);
      // Nach „gesehen“/„Favorit“-Änderungen sind gefilterte Listen veraltet: dann neu laden.
      const hit = cached?.version === userDataVersion.value ? cached : undefined;
      loading = false;
      if (hit) {
        items = hit.items;
        total = hit.total;
        tick().then(() => router.restoreScroll());
      } else {
        items = [];
        total = 0;
        void loadMore();
      }
    });
    return () => controller?.abort();
  });

  // ---- Genres ---------------------------------------------------------------

  let genreOptions = $state<string[]>([]);
  let genrePanel = $state<HTMLDetailsElement>();

  $effect(() => {
    const cacheKey = `${session.current?.serverId}/${session.userId}/${type}`;
    const known = genreCache.get(cacheKey);
    if (known) {
      genreOptions = known;
      return;
    }
    const abort = new AbortController();
    loadGenres(type, abort.signal)
      .then((list) => {
        genreCache.set(cacheKey, list);
        genreOptions = list;
      })
      .catch(() => undefined);
    return () => abort.abort();
  });

  function toggleGenre(genre: string) {
    applyView({ genres: genres.includes(genre) ? genres.filter((g) => g !== genre) : [...genres, genre] });
  }

  // Klick außerhalb schließt die Genre-Auswahl.
  function closeGenres(event: PointerEvent) {
    if (genrePanel?.open && !genrePanel.contains(event.target as Node)) genrePanel.open = false;
  }

  // ---- Jahr -----------------------------------------------------------------

  function applyYear() {
    const value = yearInput.trim();
    if (value === year || (value !== "" && parseYearFilter(value) === null)) return;
    applyView({ year: value });
  }

  // ---- Ansicht --------------------------------------------------------------

  function applyView(next: Partial<ViewPrefs>) {
    if (next.sort) sort = next.sort;
    if (next.unwatchedOnly != null) unwatchedOnly = next.unwatchedOnly;
    if (next.favoritesOnly != null && !favorites) favoritesOnly = next.favoritesOnly;
    if (next.genres) genres = next.genres;
    if (next.year != null) year = yearInput = next.year;
    router.setQuery({
      sort: sort === "title" ? null : sort,
      unwatched: unwatchedOnly ? "1" : null,
      fav: favoritesOnly && !favorites ? "1" : null,
      genre: genres.length ? genres.join("|") : null,
      year: year || null,
    });
    localStorage.setItem(
      prefsKey(type, favorites),
      JSON.stringify({ sort, unwatchedOnly, favoritesOnly, genres, year } satisfies ViewPrefs),
    );
    scrollTo(0, 0);
  }

  function resetFilters() {
    applyView({ unwatchedOnly: false, favoritesOnly: false, genres: [], year: "" });
  }

  const hasMore = $derived(items.length < total);
  const title = $derived(favorites ? m.nav.favorites : type === "Movie" ? m.nav.movies : m.nav.series);
</script>

<svelte:document onpointerdown={closeGenres} />

<div class="page">
  <header>
    <div>
      <h1 class="page-title">{title}</h1>
      {#if total > 0}<p class="muted count">{m.library.count(total)}</p>{/if}
    </div>
    {#if favorites}
      <div class="segmented" role="group" aria-label={m.library.kind}>
        <a class="chip" href="/favorites/series" aria-current={type === "Series" ? "page" : undefined}>{m.nav.series}</a>
        <a class="chip" href="/favorites/movies" aria-current={type === "Movie" ? "page" : undefined}>{m.nav.movies}</a>
      </div>
    {/if}
  </header>

  <div class="controls">
    <div class="segmented" role="group" aria-label={m.library.sort}>
      {#each sorts as option (option.value)}
        <button
          type="button"
          class="chip"
          aria-pressed={sort === option.value}
          onclick={() => applyView({ sort: option.value })}>{option.label}</button
        >
      {/each}
    </div>
    <div class="filters">
      <details class="genres" bind:this={genrePanel}>
        <summary class="chip filter" class:active={genres.length > 0}>
          {genres.length === 0 ? m.library.genres : m.library.genresSelected(genres)}
          <Icon name="chevronDown" size={16} />
        </summary>
        <div class="panel" role="group" aria-label={m.library.genres}>
          {#if genreOptions.length === 0}
            <p class="muted small">{m.library.noGenres}</p>
          {/if}
          {#each genreOptions as genre (genre)}
            <button
              type="button"
              class="chip small-chip"
              aria-pressed={genres.includes(genre)}
              onclick={() => toggleGenre(genre)}>{genre}</button
            >
          {/each}
          <p class="muted small hint">{m.library.genresHint}</p>
        </div>
      </details>
      <label class="year" class:invalid={yearInvalid}>
        <span class="muted small">{m.library.year}</span>
        <input
          class="input"
          type="text"
          inputmode="text"
          autocomplete="off"
          spellcheck="false"
          placeholder={m.library.yearPlaceholder}
          title={m.library.yearHint}
          aria-invalid={yearInvalid}
          bind:value={yearInput}
          onchange={applyYear}
          onkeydown={(e) => e.key === "Enter" && applyYear()}
        />
      </label>
      <button
        type="button"
        class="chip filter"
        aria-pressed={unwatchedOnly}
        onclick={() => applyView({ unwatchedOnly: !unwatchedOnly })}
      >
        <Icon name="eyeOff" size={18} />
        {m.library.hideWatched}
      </button>
      {#if !favorites}
        <button
          type="button"
          class="chip filter"
          aria-pressed={favoritesOnly}
          onclick={() => applyView({ favoritesOnly: !favoritesOnly })}
        >
          <Icon name="heart" size={18} />
          {m.library.favoritesOnly}
        </button>
      {/if}
      {#if filtered}
        <button type="button" class="btn btn-ghost reset" onclick={resetFilters}>
          <Icon name="close" size={18} />
          {m.library.resetFilters}
        </button>
      {/if}
    </div>
    {#if yearInvalid}<p class="error small" role="status">{m.library.yearHint}</p>{/if}
  </div>

  {#if items.length > 0}
    <PosterGrid {items} hasMore={hasMore && !error} {loading} onmore={loadMore} />
  {/if}
  <StateView
    loading={loading && items.length === 0}
    {error}
    onretry={loadMore}
    empty={!loading && !error && items.length === 0
      ? filtered
        ? m.library.emptyFiltered
        : favorites
          ? m.library.emptyFavorites
          : m.library.empty
      : undefined}
  />
</div>

<style>
  header {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-4);
    margin-bottom: var(--space-4);
  }

  .count {
    font-size: var(--text-sm);
  }

  .controls {
    display: grid;
    gap: var(--space-3);
    margin-bottom: var(--space-5);
  }

  .filters {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
  }

  .filter {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }

  a.chip {
    display: inline-flex;
    align-items: center;
    text-decoration: none;
  }

  .genres {
    position: relative;
  }

  .genres summary {
    list-style: none;
    cursor: pointer;
  }

  .genres summary::-webkit-details-marker {
    display: none;
  }

  .panel {
    position: absolute;
    z-index: 15;
    top: calc(100% + var(--space-2));
    left: 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    width: min(560px, calc(100vw - 2 * var(--page-pad)));
    max-height: 60vh;
    overflow-y: auto;
    padding: var(--space-4);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    box-shadow: var(--shadow-card);
  }

  .small-chip {
    min-height: 40px;
  }

  .hint {
    flex-basis: 100%;
    margin: var(--space-2) 0 0;
  }

  .year {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }

  .year .input {
    width: 9rem;
    min-height: 44px;
  }

  .year.invalid .input {
    border-color: var(--color-danger);
  }

  .error {
    margin: 0;
    color: var(--color-danger);
  }

  .small {
    font-size: var(--text-sm);
  }

  .reset {
    min-height: 44px;
  }
</style>
