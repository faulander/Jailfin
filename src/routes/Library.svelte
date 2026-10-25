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
  }

  // Geladene Seiten bleiben erhalten, damit „Zurück“ Position und Inhalt behält. Nach
  // „gesehen“/„Favorit“-Änderungen (neue Benutzerdaten-Version) wird beim nächsten Aufruf neu geladen.
  const cache = new Map<string, Loaded>();
  const PAGE_SIZE = 60;
  const SORT_VALUES: LibrarySort[] = ["title", "year", "added", "rating"];
  const prefsKey = (type: string) => `jailfin.library.${type}.v1`;

  /** URL hat Vorrang (Zurück/Deep-Link), sonst die zuletzt gewählte Ansicht dieses Geräts. */
  function initialPrefs(type: string, query: URLSearchParams): ViewPrefs {
    let stored: Partial<ViewPrefs> = {};
    try {
      stored = JSON.parse(localStorage.getItem(prefsKey(type)) ?? "{}") as Partial<ViewPrefs>;
    } catch {
      // ungültige Daten ignorieren
    }
    const sortParam = query.get("sort") ?? stored.sort;
    // Ohne Query-Parameter (Aufruf über die Navigation) gilt die gespeicherte Ansicht.
    const fromUrl = query.has("sort") || query.has("unwatched") || query.has("fav");
    return {
      sort: SORT_VALUES.includes(sortParam as LibrarySort) ? (sortParam as LibrarySort) : "title",
      unwatchedOnly: fromUrl ? query.has("unwatched") : stored.unwatchedOnly === true,
      favoritesOnly: fromUrl ? query.has("fav") : stored.favoritesOnly === true,
    };
  }
</script>

<script lang="ts">
  import { tick, untrack } from "svelte";
  import Icon from "../components/Icon.svelte";
  import PosterGrid from "../components/PosterGrid.svelte";
  import StateView from "../components/StateView.svelte";
  import { m } from "../lib/i18n";
  import { loadLibraryPage } from "../lib/jellyfin/queries";
  import { session } from "../lib/jellyfin/session.svelte";
  import { userDataVersion } from "../lib/jellyfin/userdata.svelte";
  import { router } from "../lib/router.svelte";

  let { type }: { type: "Movie" | "Series" } = $props();

  const sorts: { value: LibrarySort; label: string }[] = [
    { value: "title", label: m.library.sortTitle },
    { value: "year", label: m.library.sortYear },
    { value: "added", label: m.library.sortAdded },
    { value: "rating", label: m.library.sortRating },
  ];

  const initial = untrack(() => initialPrefs(type, router.query));
  let sort = $state<LibrarySort>(initial.sort);
  let unwatchedOnly = $state(initial.unwatchedOnly);
  let favoritesOnly = $state(initial.favoritesOnly);
  let items = $state<BaseItemDto[]>([]);
  let total = $state(0);
  let loading = $state(false);
  let error = $state<unknown>(null);
  let controller: AbortController | undefined;

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

  function applyView(next: Partial<ViewPrefs>) {
    if (next.sort) sort = next.sort;
    if (next.unwatchedOnly != null) unwatchedOnly = next.unwatchedOnly;
    if (next.favoritesOnly != null) favoritesOnly = next.favoritesOnly;
    router.setQuery({
      sort: sort === "title" ? null : sort,
      unwatched: unwatchedOnly ? "1" : null,
      fav: favoritesOnly ? "1" : null,
    });
    localStorage.setItem(
      prefsKey(type),
      JSON.stringify({ sort, unwatchedOnly, favoritesOnly } satisfies ViewPrefs),
    );
    scrollTo(0, 0);
  }

  const hasMore = $derived(items.length < total);
</script>

<div class="page">
  <header>
    <div>
      <h1 class="page-title">{type === "Movie" ? m.nav.movies : m.nav.series}</h1>
      {#if total > 0}<p class="muted count">{m.library.count(total)}</p>{/if}
    </div>
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
      <button
        type="button"
        class="chip filter"
        aria-pressed={unwatchedOnly}
        onclick={() => applyView({ unwatchedOnly: !unwatchedOnly })}
      >
        <Icon name="eyeOff" size={18} />
        {m.library.hideWatched}
      </button>
      <button
        type="button"
        class="chip filter"
        aria-pressed={favoritesOnly}
        onclick={() => applyView({ favoritesOnly: !favoritesOnly })}
      >
        <Icon name="heart" size={18} />
        {m.library.favoritesOnly}
      </button>
    </div>
  </header>

  {#if items.length > 0}
    <PosterGrid {items} hasMore={hasMore && !error} {loading} onmore={loadMore} showRating={sort === "rating"} />
  {/if}
  <StateView
    loading={loading && items.length === 0}
    {error}
    onretry={loadMore}
    empty={!loading && !error && items.length === 0
      ? unwatchedOnly || favoritesOnly
        ? m.library.emptyFiltered
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
    margin-bottom: var(--space-5);
  }

  .count {
    font-size: var(--text-sm);
  }

  .controls {
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
</style>
