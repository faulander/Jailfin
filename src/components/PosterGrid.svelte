<script lang="ts">
  import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
  import { m } from "../lib/i18n";
  import PosterCard from "./PosterCard.svelte";

  let {
    items,
    hasMore = false,
    loading = false,
    onmore,
    showType = false,
  }: {
    items: BaseItemDto[];
    hasMore?: boolean;
    loading?: boolean;
    onmore?: () => void;
    showType?: boolean;
  } = $props();

  let sentinel: HTMLElement | undefined = $state();

  // Inkrementelles Nachladen; nach jedem Ladevorgang neu aufgebaut, damit der initiale
  // Callback weiterlädt, solange das Ende sichtbar ist.
  $effect(() => {
    if (!sentinel || !hasMore || !onmore || loading) return;
    const load = onmore;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) load();
      },
      { rootMargin: "800px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  });
</script>

<div class="grid">
  {#each items as item (item.Id)}
    <PosterCard {item} {showType} />
  {/each}
</div>
{#if hasMore}
  <div class="more" bind:this={sentinel}>
    <button class="btn btn-ghost" type="button" disabled={loading} onclick={() => onmore?.()}>
      {loading ? m.common.loading : m.common.loadMore}
    </button>
  </div>
{/if}

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(clamp(120px, 16vw, 180px), 1fr));
    gap: var(--space-5) var(--space-4);
  }

  .more {
    display: grid;
    place-items: center;
    padding: var(--space-6) 0;
  }
</style>
