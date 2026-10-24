<script lang="ts">
  import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
  import { m } from "../lib/i18n";
  import { posterUrl } from "../lib/jellyfin/images";
  import Icon from "./Icon.svelte";
  import Img from "./Img.svelte";

  let { item, showType = false }: { item: BaseItemDto; showType?: boolean } = $props();

  const isEpisode = $derived(item.Type === "Episode");
  // Gruppierte neue Folgen verlinken auf die Serie.
  const target = $derived(isEpisode ? (item.SeriesId ?? item.Id) : item.Id);
  const title = $derived((isEpisode ? item.SeriesName : item.Name) ?? item.Name ?? "");
  const played = $derived(!!item.UserData?.Played);
  const unplayed = $derived(item.Type === "Series" ? (item.UserData?.UnplayedItemCount ?? 0) : 0);
  const typeLabel = $derived(item.Type === "Movie" ? m.common.movie : m.common.series);
</script>

<a class="poster" href={`/item/${encodeURIComponent(target ?? "")}`}>
  <div class="art">
    <Img src={posterUrl(item)} ratio="2 / 3" fallback={title} />
    {#if played}
      <span class="badge played" aria-label={m.detail.played}><Icon name="check" size={16} /></span>
    {:else if unplayed > 0}
      <span class="badge">{unplayed}</span>
    {/if}
  </div>
  <span class="title">{title}</span>
  <span class="sub">
    {#if showType}<span class="type">{typeLabel}</span>{/if}
    {item.ProductionYear ?? ""}
  </span>
</a>

<style>
  .poster {
    display: grid;
    gap: var(--space-1);
    min-width: 0;
    border-radius: var(--radius-md);
  }

  .art {
    position: relative;
    border-radius: var(--radius-md);
    overflow: hidden;
    box-shadow: var(--shadow-card);
    transition: transform 150ms var(--ease);
  }

  .poster:hover .art {
    transform: translateY(-2px);
  }

  .badge {
    position: absolute;
    top: var(--space-2);
    right: var(--space-2);
    min-width: 26px;
    height: 26px;
    display: grid;
    place-items: center;
    padding: 0 var(--space-2);
    border-radius: var(--radius-pill);
    background: var(--color-accent);
    color: var(--color-on-accent);
    font-size: var(--text-xs);
    font-weight: 700;
  }

  .badge.played {
    padding: 0;
    background: var(--color-success);
  }

  .title {
    margin-top: var(--space-1);
    font-weight: 600;
    font-size: var(--text-sm);
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .sub {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    min-height: 1.2em;
  }

  .type {
    margin-right: var(--space-2);
    padding: 1px 6px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
</style>
