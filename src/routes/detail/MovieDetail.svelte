<script lang="ts">
  import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
  import Icon from "../../components/Icon.svelte";
  import ProgressBar from "../../components/ProgressBar.svelte";
  import { markPlayed, play } from "../../lib/actions";
  import { episodeCode, formatRuntime, hasResumePosition, progressPercent, remainingTime } from "../../lib/format";
  import { m } from "../../lib/i18n";
  import { describeError } from "../../lib/jellyfin/errors";
  import { toasts } from "../../lib/toast.svelte";
  import DetailHero from "./DetailHero.svelte";
  import ItemToggles from "./ItemToggles.svelte";

  let { item, onchange }: { item: BaseItemDto; onchange: (item: BaseItemDto) => void } = $props();

  let busy = $state(false);
  const resumable = $derived(hasResumePosition(item));
  const played = $derived(!!item.UserData?.Played);
  const progress = $derived(progressPercent(item));
  const meta = $derived(
    [
      item.Type === "Episode" ? episodeCode(item) : undefined,
      item.ProductionYear,
      formatRuntime(item.RunTimeTicks),
      item.OfficialRating,
      item.CommunityRating ? `★ ${item.CommunityRating.toFixed(1)}` : undefined,
    ].filter(Boolean),
  );

  async function togglePlayed() {
    busy = true;
    try {
      const userData = await markPlayed(item, !played);
      onchange({ ...item, UserData: { ...item.UserData, ...userData } });
    } catch (e) {
      toasts.show(describeError(e), { tone: "error" });
    } finally {
      busy = false;
    }
  }
</script>

<DetailHero {item}>
  {#if item.Type === "Episode" && item.SeriesId}
    <a class="series-link" href={`/item/${encodeURIComponent(item.SeriesId)}`}>{item.SeriesName}</a>
  {/if}
  <h1 class="title">{item.Name}</h1>
  {#if meta.length > 0}
    <p class="meta muted">{meta.join(" · ")}</p>
  {/if}

  {#if resumable && progress > 0}
    <div class="progress">
      <ProgressBar value={progress} />
      <span class="muted">{m.common.remaining(remainingTime(item) ?? "")}</span>
    </div>
  {/if}

  <div class="actions">
    <button class="btn btn-primary" type="button" onclick={() => play(item)}>
      <Icon name="play" size={20} />
      {resumable ? m.common.resume : m.common.play}
    </button>
    {#if resumable}
      <button class="btn" type="button" onclick={() => play(item, { fromStart: true })}>
        {m.common.playFromStart}
      </button>
    {/if}
    <button class="btn btn-ghost" type="button" disabled={busy} aria-pressed={played} onclick={togglePlayed}>
      <Icon name="check" size={20} />
      {played ? m.detail.markUnplayed : m.detail.markPlayed}
    </button>
    <ItemToggles {item} />
  </div>

  {#if item.Overview}
    <p class="overview">{item.Overview}</p>
  {/if}
  {#if item.Genres && item.Genres.length > 0}
    <p class="genres"><span class="muted">{m.detail.genres}:</span> {item.Genres.join(", ")}</p>
  {/if}
</DetailHero>

<style>
  .series-link {
    font-weight: 700;
    color: var(--color-accent);
    font-size: var(--text-lg);
  }

  .title {
    font-size: var(--text-2xl);
    line-height: 1.1;
    font-weight: 800;
    letter-spacing: -0.015em;
  }

  .progress {
    display: grid;
    grid-template-columns: minmax(120px, 280px) auto;
    align-items: center;
    gap: var(--space-3);
    font-size: var(--text-sm);
  }

  .progress :global(.bar) {
    border-radius: var(--radius-pill);
    overflow: hidden;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
  }

  .overview {
    line-height: 1.6;
  }

  .genres {
    font-size: var(--text-sm);
  }
</style>
