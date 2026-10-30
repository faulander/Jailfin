<script lang="ts">
  import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
  import { tick, untrack } from "svelte";
  import Icon from "../../components/Icon.svelte";
  import Img from "../../components/Img.svelte";
  import ProgressBar from "../../components/ProgressBar.svelte";
  import StateView from "../../components/StateView.svelte";
  import { hideFromNextUp, markPlayed, play, showInNextUp } from "../../lib/actions";
  import { episodeCode, formatRuntime, hasResumePosition, progressPercent } from "../../lib/format";
  import { m } from "../../lib/i18n";
  import { describeError } from "../../lib/jellyfin/errors";
  import { landscapeUrl } from "../../lib/jellyfin/images";
  import { loadEpisodes, loadItem, loadSeasons, loadSeriesNextUp } from "../../lib/jellyfin/queries";
  import { hiddenSeries } from "../../lib/hidden/state.svelte";
  import { router } from "../../lib/router.svelte";
  import { toasts } from "../../lib/toast.svelte";
  import DetailHero from "./DetailHero.svelte";
  import ItemToggles from "./ItemToggles.svelte";

  let { series }: { series: BaseItemDto } = $props();

  let seasons = $state<BaseItemDto[]>([]);
  let seasonsError = $state<unknown>(null);
  let seasonsLoading = $state(true);
  let nextUp = $state<BaseItemDto | undefined>();
  let selected = $state<string | undefined>(router.query.get("season") ?? undefined);
  let episodes = $state<BaseItemDto[]>([]);
  let episodesLoading = $state(false);
  let episodesError = $state<unknown>(null);
  let userDataOverride = $state<BaseItemDto["UserData"]>();
  const userData = $derived(userDataOverride ?? series.UserData);

  const seriesId = $derived(series.Id ?? "");
  const hidden = $derived(hiddenSeries.has(seriesId));
  const played = $derived(!!userData?.Played);
  const meta = $derived(
    [
      series.ProductionYear,
      series.OfficialRating,
      series.CommunityRating ? `★ ${series.CommunityRating.toFixed(1)}` : undefined,
      series.Status === "Continuing" ? "laufend" : undefined,
    ].filter(Boolean),
  );

  async function loadOverview() {
    seasonsLoading = true;
    seasonsError = null;
    try {
      const [s, next] = await Promise.all([loadSeasons(seriesId), loadSeriesNextUp(seriesId).catch(() => undefined)]);
      seasons = s;
      nextUp = next;
      const valid = selected && s.some((x) => x.Id === selected);
      if (!valid) selected = next?.SeasonId ?? s.find((x) => (x.IndexNumber ?? 0) > 0)?.Id ?? s[0]?.Id;
    } catch (e) {
      seasonsError = e;
    } finally {
      seasonsLoading = false;
    }
  }

  async function loadSeasonEpisodes(seasonId: string) {
    episodesLoading = true;
    episodesError = null;
    try {
      const result = await loadEpisodes(seriesId, seasonId);
      if (selected !== seasonId) return;
      episodes = result;
      await tick();
      router.restoreScroll();
    } catch (e) {
      if (selected === seasonId) episodesError = e;
    } finally {
      if (selected === seasonId) episodesLoading = false;
    }
  }

  $effect(() => {
    untrack(() => void loadOverview());
  });

  $effect(() => {
    const id = selected;
    if (!id) return;
    untrack(() => {
      router.setQuery({ season: id });
      void loadSeasonEpisodes(id);
    });
  });

  // „Abspielen“: nächste Folge laut Jellyfin, sonst erste Folge der gewählten Staffel.
  const playTarget = $derived(nextUp ?? episodes.find((e) => !e.UserData?.Played) ?? episodes[0]);

  // Gesehen-Markierungen für Serie, Staffel oder Folge; danach Staffeln, Folgen und Serie neu laden.
  let marking = $state<string>();

  async function togglePlayedFor(target: BaseItemDto, next: boolean) {
    if (!target.Id || marking) return;
    marking = target.Id;
    try {
      await markPlayed(target, next);
      const seasonId = selected;
      const [s, upcoming, fresh, eps] = await Promise.all([
        loadSeasons(seriesId),
        loadSeriesNextUp(seriesId).catch(() => undefined),
        loadItem(seriesId).catch(() => undefined),
        seasonId ? loadEpisodes(seriesId, seasonId) : Promise.resolve(undefined),
      ]);
      seasons = s;
      nextUp = upcoming;
      if (fresh?.UserData) userDataOverride = fresh.UserData;
      if (eps && selected === seasonId) episodes = eps;
    } catch (e) {
      toasts.show(describeError(e), { tone: "error" });
    } finally {
      marking = undefined;
    }
  }

  const selectedSeason = $derived(seasons.find((s) => s.Id === selected));

  function seasonLabel(season: BaseItemDto) {
    if (season.IndexNumber === 0) return m.detail.specials;
    return season.Name ?? m.detail.season(season.IndexNumber ?? 0);
  }
</script>

<DetailHero item={series}>
  <h1 class="title">{series.Name}</h1>
  {#if meta.length > 0}<p class="muted">{meta.join(" · ")}</p>{/if}

  <div class="actions">
    {#if playTarget}
      <button class="btn btn-primary" type="button" onclick={() => play(playTarget)}>
        <Icon name="play" size={20} />
        {hasResumePosition(playTarget) ? m.common.resume : m.common.play}
        {#if episodeCode(playTarget)}<span class="code">{episodeCode(playTarget)}</span>{/if}
      </button>
    {/if}
    {#if hidden}
      <button class="btn" type="button" onclick={() => showInNextUp(seriesId)}>
        <Icon name="eye" size={20} />
        {m.detail.showInNextUp}
      </button>
    {:else}
      <button class="btn btn-ghost" type="button" onclick={() => hideFromNextUp(seriesId, series.Name ?? "")}>
        <Icon name="eyeOff" size={20} />
        {m.detail.hideFromNextUp}
      </button>
    {/if}
    <button
      class="btn btn-ghost"
      type="button"
      aria-pressed={played}
      disabled={!!marking}
      onclick={() => togglePlayedFor(series, !played)}
    >
      <Icon name="check" size={20} />
      {played ? m.detail.markUnplayed : m.detail.markPlayed}
    </button>
    <ItemToggles item={series} />
  </div>
  {#if hidden}<p class="muted note">{m.detail.hiddenFromNextUp}</p>{/if}

  {#if series.Overview}<p class="overview">{series.Overview}</p>{/if}
  {#if series.Genres && series.Genres.length > 0}
    <p class="genres"><span class="muted">{m.detail.genres}:</span> {series.Genres.join(", ")}</p>
  {/if}
</DetailHero>

<section class="page seasons">
  <StateView loading={seasonsLoading} error={seasonsError} onretry={loadOverview} />
  {#if seasons.length > 0}
    <div class="tabs" role="tablist" aria-label={m.detail.seasons}>
      {#each seasons as season (season.Id)}
        <button
          type="button"
          role="tab"
          class="tab"
          aria-selected={season.Id === selected}
          onclick={() => (selected = season.Id ?? undefined)}
        >
          {seasonLabel(season)}
          {#if season.UserData?.Played}<Icon name="check" size={16} />{/if}
        </button>
      {/each}
    </div>

    {#if selectedSeason && episodes.length > 0}
      {@const seasonPlayed = !!selectedSeason.UserData?.Played}
      <div class="season-bar">
        <button
          class="btn btn-ghost"
          type="button"
          aria-pressed={seasonPlayed}
          disabled={!!marking}
          onclick={() => togglePlayedFor(selectedSeason, !seasonPlayed)}
        >
          <Icon name="check" size={18} />
          {seasonPlayed ? m.detail.seasonMarkUnplayed : m.detail.seasonMarkPlayed}
        </button>
      </div>
    {/if}

    <ol class="episodes" aria-busy={episodesLoading}>
      {#each episodes as episode (episode.Id)}
        {@const progress = progressPercent(episode)}
        {@const epPlayed = !!episode.UserData?.Played}
        <li class="episode">
          <button class="thumb" type="button" onclick={() => play(episode)} aria-label={`${m.common.play}: ${episode.Name}`}>
            <Img src={landscapeUrl(episode, 360)} ratio="16 / 9" />
            <span class="play" aria-hidden="true"><Icon name="play" size={22} /></span>
            {#if progress > 0 && !episode.UserData?.Played}
              <span class="bar"><ProgressBar value={progress} /></span>
            {/if}
          </button>
          <div class="ep-info">
            <a href={`/item/${encodeURIComponent(episode.Id ?? "")}`} class="ep-title">
              <span class="code">{episodeCode(episode) ?? ""}</span>
              {episode.Name}
            </a>
            <p class="muted ep-meta">
              {formatRuntime(episode.RunTimeTicks) ?? ""}
              <button
                class="ep-played"
                class:on={epPlayed}
                type="button"
                aria-pressed={epPlayed}
                disabled={!!marking}
                aria-label={`${epPlayed ? m.detail.markUnplayed : m.detail.markPlayed}: ${episode.Name ?? ""}`}
                onclick={() => togglePlayedFor(episode, !epPlayed)}
              >
                <Icon name="check" size={16} />
                {epPlayed ? m.detail.played : m.detail.notPlayed}
              </button>
            </p>
            {#if episode.Overview}<p class="ep-overview">{episode.Overview}</p>{/if}
          </div>
        </li>
      {/each}
    </ol>
    <StateView
      loading={episodesLoading && episodes.length === 0}
      error={episodesError}
      onretry={() => selected && loadSeasonEpisodes(selected)}
      empty={!episodesLoading && !episodesError && episodes.length === 0 ? m.detail.noEpisodes : undefined}
    />
  {/if}
</section>

<style>
  .title {
    font-size: var(--text-2xl);
    line-height: 1.1;
    font-weight: 800;
    letter-spacing: -0.015em;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
  }

  .code {
    opacity: 0.75;
    font-variant-numeric: tabular-nums;
  }

  .note {
    font-size: var(--text-sm);
  }

  .overview {
    line-height: 1.6;
  }

  .genres {
    font-size: var(--text-sm);
  }

  .seasons {
    padding-top: 0;
  }

  .tabs {
    display: flex;
    gap: var(--space-2);
    overflow-x: auto;
    padding-bottom: var(--space-3);
    margin-bottom: var(--space-4);
    border-bottom: 1px solid var(--color-border);
    scrollbar-width: thin;
  }

  .tab {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 44px;
    padding: 0 var(--space-4);
    border: 0;
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--color-text-muted);
    font-weight: 600;
  }

  .tab[aria-selected="true"] {
    background: var(--color-surface-3);
    color: var(--color-text);
  }

  .episodes {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-4);
  }

  .episode {
    display: grid;
    grid-template-columns: clamp(140px, 26vw, 280px) 1fr;
    gap: var(--space-4);
    align-items: start;
  }

  .thumb {
    position: relative;
    padding: 0;
    border: 0;
    border-radius: var(--radius-md);
    overflow: hidden;
    background: var(--color-surface);
  }

  .thumb .play {
    position: absolute;
    inset: 0;
    margin: auto;
    width: 46px;
    height: 46px;
    display: grid;
    place-items: center;
    padding-left: 3px;
    border-radius: 50%;
    background: rgb(10 12 16 / 62%);
    color: white;
  }

  .thumb:hover .play,
  .thumb:focus-visible .play {
    background: var(--color-accent);
    color: var(--color-on-accent);
  }

  .bar {
    position: absolute;
    inset: auto 0 0;
  }

  .ep-info {
    display: grid;
    gap: var(--space-1);
    min-width: 0;
  }

  .ep-title {
    font-weight: 700;
  }

  .ep-title .code {
    margin-right: var(--space-2);
    color: var(--color-text-muted);
  }

  .ep-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
    font-size: var(--text-sm);
  }

  .ep-played {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-height: 36px;
    padding: 4px 12px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--color-text-muted);
    font: inherit;
    cursor: pointer;
  }

  .ep-played:hover:not(:disabled) {
    color: var(--color-text);
    border-color: var(--color-text-muted);
  }

  .ep-played.on {
    color: var(--color-success);
    border-color: color-mix(in srgb, var(--color-success) 50%, transparent);
  }

  .ep-played:disabled {
    cursor: progress;
  }

  .season-bar {
    display: flex;
    justify-content: flex-end;
    margin-block: var(--space-3);
  }

  .ep-overview {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
