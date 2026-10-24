<script lang="ts" module>
  import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
  import type { LibrarySort } from "../lib/jellyfin/queries";

  interface Loaded {
    items: BaseItemDto[];
    total: number;
  }

  interface ViewPrefs {
    sort: LibrarySort;
    unwatchedOnly: boolean;
  }

  // Geladene Seiten bleiben erhalten, damit „Zurück“ Position und Inhalt behält.
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
    return {
      sort: SORT_VALUES.includes(sortParam as LibrarySort) ? (sortParam as LibrarySort) : "title",
      unwatchedOnly: query.has("unwatched") || (!query.has("sort") && stored.unwatchedOnly === true),
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
  let items = $state<BaseItemDto[]>([]);
  let total = $state(0);
  let loading = $state(false);
  let error = $state<unknown>(null);
  let controller: AbortController | undefined;

  const key = $derived(
    `${session.current?.serverId}/${session.userId}/${type}/${sort}/${unwatchedOnly ? "unwatched" : "all"}`,
  );

  async function loadMore() {
    if (loading) return;
    loading = true;
    error = null;
    const requestKey = key;
    const signal = controller?.signal;
    try {
      const page = await loadLibraryPage(type, sort, items.length, PAGE_SIZE, signal, { unwatchedOnly });
      if (requestKey !== key) return;
      items = [...items, ...(page.Items ?? [])];
      total = page.TotalRecordCount ?? items.length;
      cache.set(requestKey, { items, total });
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
      const hit = cache.get(k);
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
    router.setQuery({ sort: sort === "title" ? null : sort, unwatched: unwatchedOnly ? "1" : null });
    localStorage.setItem(prefsKey(type), JSON.stringify({ sort, unwatchedOnly } satisfies ViewPrefs));
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
      ? unwatchedOnly
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
