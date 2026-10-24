<script lang="ts">
  import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
  import { tick } from "svelte";
  import Icon from "../components/Icon.svelte";
  import PosterGrid from "../components/PosterGrid.svelte";
  import StateView from "../components/StateView.svelte";
  import { m } from "../lib/i18n";
  import { searchItems } from "../lib/jellyfin/queries";
  import { router } from "../lib/router.svelte";

  let input = $state(router.query.get("q") ?? "");
  let term = $state((router.query.get("q") ?? "").trim());
  let results = $state<BaseItemDto[] | null>(null);
  let loading = $state(false);
  let error = $state<unknown>(null);
  let field: HTMLInputElement | undefined = $state();
  let restored = false;

  // Debouncing: erst nach kurzer Tipppause suchen.
  $effect(() => {
    const value = input.trim();
    const timer = setTimeout(() => {
      term = value;
      router.setQuery({ q: value || null });
    }, 300);
    return () => clearTimeout(timer);
  });

  $effect(() => {
    const q = term;
    if (q.length < 2) {
      results = null;
      loading = false;
      error = null;
      return;
    }
    const controller = new AbortController();
    loading = true;
    error = null;
    searchItems(q, controller.signal).then(
      async (items) => {
        results = items;
        loading = false;
        if (!restored) {
          restored = true;
          await tick();
          router.restoreScroll();
        }
      },
      (e: unknown) => {
        if (controller.signal.aborted) return;
        error = e;
        loading = false;
      },
    );
    return () => controller.abort();
  });

  $effect(() => {
    if (!router.query.get("q")) field?.focus();
  });
</script>

<div class="page">
  <h1 class="visually-hidden">{m.nav.search}</h1>
  <form class="search" role="search" onsubmit={(e) => e.preventDefault()}>
    <Icon name="search" />
    <input
      bind:this={field}
      bind:value={input}
      class="input"
      type="search"
      enterkeyhint="search"
      autocomplete="off"
      placeholder={m.search.placeholder}
      aria-label={m.search.placeholder}
    />
  </form>

  {#if results && results.length > 0}
    <PosterGrid items={results} showType />
  {/if}
  <StateView
    loading={loading && !results}
    {error}
    empty={results && results.length === 0 && !loading
      ? m.search.empty(term)
      : term.length < 2
        ? m.search.prompt
        : undefined}
  />
</div>

<style>
  .search {
    position: relative;
    display: flex;
    align-items: center;
    margin-bottom: var(--space-5);
    max-width: 720px;
  }

  .search :global(svg) {
    position: absolute;
    left: var(--space-4);
    color: var(--color-text-muted);
    pointer-events: none;
  }

  .search input {
    min-height: 56px;
    padding-left: calc(var(--space-4) * 2 + 24px);
    font-size: var(--text-lg);
    border-radius: var(--radius-pill);
  }
</style>
