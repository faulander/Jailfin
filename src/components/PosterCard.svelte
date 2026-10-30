<script lang="ts">
  import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
  import { toggleWatchlist, watchlistTarget } from "../lib/actions";
  import { m } from "../lib/i18n";
  import { posterUrl } from "../lib/jellyfin/images";
  import { describeError } from "../lib/jellyfin/errors";
  import { setFavorite } from "../lib/jellyfin/queries";
  import { toasts } from "../lib/toast.svelte";
  import { watchlist } from "../lib/watchlist/state.svelte";
  import Icon from "./Icon.svelte";
  import Img from "./Img.svelte";
  import type { SeasonStatus } from "../lib/season-status";

  const today = () => new Date().toLocaleDateString("sv-SE");

  let {
    item,
    showType = false,
    season,
  }: {
    item: BaseItemDto;
    showType?: boolean;
    /** Vollständigkeit der aktuellen Staffel (Merkliste); ersetzt dort die Kritiker-Bewertung */
    season?: SeasonStatus;
  } = $props();

  const isEpisode = $derived(item.Type === "Episode");
  // Gruppierte neue Folgen verlinken auf die Serie.
  const target = $derived(isEpisode ? (item.SeriesId ?? item.Id) : item.Id);
  const title = $derived((isEpisode ? item.SeriesName : item.Name) ?? item.Name ?? "");
  const played = $derived(!!item.UserData?.Played);
  const unplayed = $derived(item.Type === "Series" ? (item.UserData?.UnplayedItemCount ?? 0) : 0);
  const typeLabel = $derived(item.Type === "Movie" ? m.common.movie : m.common.series);

  // Bewertungen: IMDb/Community unten rechts, Rotten Tomatoes (Kritiker) unten links.
  const community = $derived(item.CommunityRating ? item.CommunityRating.toFixed(1) : undefined);
  const critic = $derived(item.CriticRating != null ? Math.round(item.CriticRating) : undefined);
  const finaleAhead = $derived(season && !season.complete && season.finale && season.finale > today() ? season.finale : undefined);
  const seasonLabel = $derived(
    season &&
      (season.complete
        ? m.seasonStatus.complete(season.season, season.total)
        : m.seasonStatus.partial(season.season, season.have, season.total, finaleAhead)),
  );

  // Merken direkt aus der Übersicht – auch bereits begonnene Serien (z. B. aus „Als nächstes“).
  const watchTarget = $derived(watchlistTarget(item));
  const onWatchlist = $derived(watchlist.has(watchTarget?.Id));
  const canWatchlist = $derived(!!watchTarget && watchlist.ready);

  // Favorit direkt aus der Übersicht (Folgen-Poster stehen für ihre Serie).
  let favoriteOverride = $state<boolean>();
  let favoriteBusy = $state(false);
  const favorite = $derived(favoriteOverride ?? (!isEpisode && !!item.UserData?.IsFavorite));

  async function toggleFavorite() {
    const id = watchTarget?.Id;
    if (!id || favoriteBusy) return;
    favoriteBusy = true;
    try {
      const data = await setFavorite(id, !favorite);
      favoriteOverride = !!data.IsFavorite;
    } catch (e) {
      toasts.show(describeError(e), { tone: "error" });
    } finally {
      favoriteBusy = false;
    }
  }
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
      {#if season}
        <span class={["rating-badge", "season", season.complete && "complete"]} aria-label={seasonLabel} title={seasonLabel}>
          S{season.season}
          {#if season.complete}<Icon name="check" size={14} />{:else}{season.have}/{season.total}{/if}
        </span>
      {:else if critic != null}
        <span class="rating-badge critic" aria-label={m.ratings.criticLabel(critic)}>RT {critic} %</span>
      {/if}
      {#if community}
        <span class="rating-badge community" aria-label={m.ratings.communityLabel(community)}>★ {community}</span>
      {/if}
    </div>
    <span class="title">{title}</span>
    <span class="sub">
      {#if showType}<span class="type">{typeLabel}</span>{/if}
      {[item.ProductionYear, finaleAhead && m.seasonStatus.finale(finaleAhead)].filter(Boolean).join(" · ")}
    </span>
  </a>
  {#if watchTarget}
    <div class="quick">
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
      <button
        class="mark"
        class:on={favorite}
        type="button"
        aria-pressed={favorite}
        aria-label={`${favorite ? m.detail.removeFavorite : m.detail.addFavorite}: ${title}`}
        disabled={favoriteBusy}
        onclick={toggleFavorite}
      >
        <span class="mark-icon"><Icon name="heart" size={18} /></span>
      </button>
    </div>
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

  .rating-badge {
    position: absolute;
    bottom: var(--space-2);
    padding: 3px 8px;
    border-radius: var(--radius-pill);
    background: rgb(10 12 16 / 72%);
    backdrop-filter: blur(4px);
    font-size: var(--text-xs);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    pointer-events: none;
  }

  .rating-badge.community {
    right: var(--space-2);
    color: var(--color-focus);
  }

  .rating-badge.critic {
    left: var(--space-2);
    color: #ff8a65;
  }

  .rating-badge.season {
    left: var(--space-2);
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: #ffb74d;
    pointer-events: auto;
  }

  .rating-badge.season.complete {
    color: var(--color-success);
  }

  /* Merken/Favorit oben links auf dem Poster (rechts sitzen die Gesehen-Badges): je 48 px Trefferfläche */
  .quick {
    position: absolute;
    top: 0;
    left: 0;
    display: grid;
  }

  .mark {
    width: var(--touch);
    height: var(--touch);
    display: grid;
    place-items: center;
    padding: 0;
    border: 0;
    background: transparent;
    color: white;
  }

  .mark + .mark {
    margin-top: -6px;
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

  .type {
    margin-right: var(--space-2);
    padding: 1px 6px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
</style>
