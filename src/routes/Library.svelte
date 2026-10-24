<script lang="ts" module>
  import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";

  interface Loaded {
    items: BaseItemDto[];
    total: number;
  }

  // Geladene Seiten bleiben erhalten, damit „Zurück“ Position und Inhalt behält.
  const cache = new Map<string, Loaded>();
  const PAGE_SIZE = 60;
</script>

<script lang="ts">
  import { tick, untrack } from "svelte";
  import PosterGrid from "../components/PosterGrid.svelte";
  import StateView from "../components/StateView.svelte";
  import { m } from "../lib/i18n";
  import { loadLibraryPage, type LibrarySort } from "../lib/jellyfin/queries";
  import { session } from "../lib/jellyfin/session.svelte";
  import { router } from "../lib/router.svelte";

  let { type }: { type: "Movie" | "Series" } = $props();

  const sorts: { value: LibrarySort; label: string }[] = [
    { value: "title", label: m.library.sortTitle },
    { value: "year", label: m.library.sortYear },
    { value: "added", label: m.library.sortAdded },
  ];

  const initialSort = router.query.get("sort");
  let sort = $state<LibrarySort>(sorts.some((s) => s.value === initialSort) ? (initialSort as LibrarySort) : "title");
  let items = $state<BaseItemDto[]>([]);
  let total = $state(0);
  let loading = $state(false);
  let error = $state<unknown>(null);
  let controller: AbortController | undefined;

  const key = $derived(`${session.current?.serverId}/${session.userId}/${type}/${sort}`);

  async function loadMore() {
    if (loading) return;
    loading = true;
    error = null;
    const requestKey = key;
    const signal = controller?.signal;
    try {
      const page = await loadLibraryPage(type, sort, items.length, PAGE_SIZE, signal);
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

  // Bei Sortierwechsel bzw. erstem Aufruf: aus dem Cache oder neu laden.
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

  function changeSort(value: LibrarySort) {
    sort = value;
    router.setQuery({ sort: value === "title" ? null : value });
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
    <div class="sort" role="group" aria-label={m.library.sort}>
      {#each sorts as option (option.value)}
        <button
          type="button"
          class="chip"
          aria-pressed={sort === option.value}
          onclick={() => changeSort(option.value)}>{option.label}</button
        >
      {/each}
    </div>
  </header>

  {#if items.length > 0}
    <PosterGrid {items} hasMore={hasMore && !error} {loading} onmore={loadMore} />
  {/if}
  <StateView
    loading={loading && items.length === 0}
    {error}
    onretry={loadMore}
    empty={!loading && !error && items.length === 0 ? m.library.empty : undefined}
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

  .sort {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .chip {
    min-height: 44px;
    padding: 0 var(--space-4);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--color-text-muted);
    font-weight: 600;
    font-size: var(--text-sm);
  }

  .chip[aria-pressed="true"] {
    background: var(--color-text);
    border-color: var(--color-text);
    color: var(--color-bg);
  }
</style>
