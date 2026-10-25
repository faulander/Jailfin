<script lang="ts">
  import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
  import { toggleWatchlist, watchlistTarget } from "../lib/actions";
  import { m } from "../lib/i18n";
  import { posterUrl } from "../lib/jellyfin/images";
  import { watchlist } from "../lib/watchlist/state.svelte";
  import Icon from "./Icon.svelte";
  import Img from "./Img.svelte";

  let {
    item,
    showType = false,
    showRating = false,
  }: { item: BaseItemDto; showType?: boolean; showRating?: boolean } = $props();

  const isEpisode = $derived(item.Type === "Episode");
  // Gruppierte neue Folgen verlinken auf die Serie.
  const target = $derived(isEpisode ? (item.SeriesId ?? item.Id) : item.Id);
  const title = $derived((isEpisode ? item.SeriesName : item.Name) ?? item.Name ?? "");
  const played = $derived(!!item.UserData?.Played);
  const unplayed = $derived(item.Type === "Series" ? (item.UserData?.UnplayedItemCount ?? 0) : 0);
  const typeLabel = $derived(item.Type === "Movie" ? m.common.movie : m.common.series);

  // Merken direkt aus der Übersicht; bereits begonnene Titel gehören nicht auf die Merkliste.
  const watchTarget = $derived(watchlistTarget(item));
  const onWatchlist = $derived(watchlist.has(watchTarget?.Id));
  const started = $derived(
    !isEpisode &&
      (played ||
        (item.UserData?.PlaybackPositionTicks ?? 0) > 0 ||
        (item.Type === "Series" && (item.UserData?.PlayedPercentage ?? 0) > 0)),
  );
  const canWatchlist = $derived(!!watchTarget && watchlist.ready && (onWatchlist || !started));
</script>

<div class="poster">
  <a class="link" href={`/item/${encodeURIComponent(target ?? "")}`}>
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
      {#if showRating && item.CommunityRating}<span class="rating">★ {item.CommunityRating.toFixed(1)}</span>{/if}
    </span>
  </a>
  {#if canWatchlist}
    <button
      class="mark"
      class:on={onWatchlist}
      type="button"
      aria-pressed={onWatchlist}
      aria-label={`${onWatchlist ? m.detail.watchlistRemoveLabel : m.detail.watchlistAddLabel}: ${title}`}
      onclick={() => toggleWatchlist(item)}
    >
      <span class="mark-icon"><Icon name="bookmark" size={18} /></span>
    </button>
  {/if}
</div>

<style>
  .poster {
    position: relative;
    min-width: 0;
  }

  .link {
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

  .link:hover .art {
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

  /* Merken-Button oben links auf dem Poster (rechts sitzen die Gesehen-Badges): 48 px Trefferfläche */
  .mark {
    position: absolute;
    top: 0;
    left: 0;
    width: var(--touch);
    height: var(--touch);
    display: grid;
    place-items: center;
    padding: 0;
    border: 0;
    background: transparent;
    color: white;
  }

  .mark-icon {
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: rgb(10 12 16 / 62%);
    backdrop-filter: blur(4px);
    transition:
      background-color 150ms var(--ease),
      transform 150ms var(--ease);
  }

  .mark:hover .mark-icon,
  .mark:focus-visible .mark-icon {
    transform: scale(1.08);
  }

  .mark.on .mark-icon {
    background: var(--color-accent);
    color: var(--color-on-accent);
  }

  .mark.on :global(svg path) {
    fill: currentColor;
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

  .rating {
    margin-left: var(--space-2);
    color: var(--color-focus);
    font-weight: 600;
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
