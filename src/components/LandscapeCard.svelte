<script lang="ts">
  import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
  import { episodeCode, formatRuntime, progressPercent, remainingTime } from "../lib/format";
  import { m } from "../lib/i18n";
  import { landscapeUrl } from "../lib/jellyfin/images";
  import ActionSheet, { type Action } from "./ActionSheet.svelte";
  import Icon from "./Icon.svelte";
  import Img from "./Img.svelte";
  import ProgressBar from "./ProgressBar.svelte";

  let {
    item,
    onplay,
    actions = [],
  }: { item: BaseItemDto; onplay: (item: BaseItemDto) => void; actions?: Action[] } = $props();

  let menuOpen = $state(false);
  const isEpisode = $derived(item.Type === "Episode");
  const title = $derived((isEpisode ? item.SeriesName : item.Name) ?? item.Name ?? "");
  const code = $derived(isEpisode ? episodeCode(item) : undefined);
  const subtitle = $derived(
    isEpisode
      ? [code, item.Name].filter(Boolean).join(" · ")
      : [item.ProductionYear, formatRuntime(item.RunTimeTicks)].filter(Boolean).join(" · "),
  );
  const progress = $derived(progressPercent(item));
  const remaining = $derived(progress > 0 ? remainingTime(item) : undefined);
  const detailHref = $derived(
    `/item/${encodeURIComponent((isEpisode ? item.SeriesId : item.Id) ?? item.Id ?? "")}`,
  );

  // Long-Press öffnet das Kontextmenü auch auf Touch-Geräten.
  let pressTimer: ReturnType<typeof setTimeout> | undefined;
  function pressStart(event: PointerEvent) {
    if (event.pointerType === "mouse" || actions.length === 0) return;
    pressTimer = setTimeout(() => (menuOpen = true), 550);
  }
  function pressEnd() {
    clearTimeout(pressTimer);
  }
</script>

<article
  class="card"
  oncontextmenu={(e) => {
    if (actions.length === 0) return;
    e.preventDefault();
    menuOpen = true;
  }}
  onpointerdown={pressStart}
  onpointerup={pressEnd}
  onpointercancel={pressEnd}
  onpointerleave={pressEnd}
>
  <button
    class="media"
    type="button"
    onclick={() => onplay(item)}
    aria-label={`${progress > 0 ? m.common.resume : m.common.play}: ${title}${code ? ` ${code}` : ""}`}
  >
    <Img src={landscapeUrl(item)} ratio="16 / 9" />
    <span class="play" aria-hidden="true"><Icon name="play" size={28} /></span>
    {#if progress > 0}
      <span class="progress"><ProgressBar value={progress} /></span>
    {/if}
  </button>
  <div class="meta">
    <a class="text" href={detailHref}>
      <h3 class="title">{title}</h3>
      {#if subtitle}<p class="subtitle">{subtitle}</p>{/if}
      {#if remaining}<p class="remaining">{m.common.remaining(remaining)}</p>{/if}
    </a>
    {#if actions.length > 0}
      <button class="btn btn-icon more" type="button" aria-label={`${m.common.more}: ${title}`} onclick={() => (menuOpen = true)}>
        <Icon name="more" />
      </button>
    {/if}
  </div>
</article>

{#if actions.length > 0}
  <ActionSheet bind:open={menuOpen} {title} subtitle={subtitle || undefined} {actions} />
{/if}

<style>
  .card {
    display: grid;
    gap: var(--space-2);
    min-width: 0;
    -webkit-touch-callout: none;
  }

  .media {
    position: relative;
    display: block;
    padding: 0;
    border: 0;
    border-radius: var(--radius-md);
    overflow: hidden;
    background: var(--color-surface);
    box-shadow: var(--shadow-card);
  }

  .play {
    position: absolute;
    inset: 0;
    margin: auto;
    width: 60px;
    height: 60px;
    display: grid;
    place-items: center;
    padding-left: 4px;
    border-radius: 50%;
    background: rgb(10 12 16 / 62%);
    color: white;
    backdrop-filter: blur(4px);
    transition:
      transform 150ms var(--ease),
      background-color 150ms var(--ease);
  }

  .media:hover .play,
  .media:focus-visible .play {
    transform: scale(1.08);
    background: var(--color-accent);
    color: var(--color-on-accent);
  }

  .progress {
    position: absolute;
    inset: auto 0 0;
  }

  .meta {
    display: flex;
    align-items: flex-start;
    gap: var(--space-1);
  }

  .text {
    flex: 1;
    min-width: 0;
    padding-top: var(--space-1);
  }

  .title,
  .subtitle {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .title {
    font-size: var(--text-md);
    font-weight: 700;
  }

  .subtitle,
  .remaining {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }

  .more {
    background: transparent;
    margin-right: calc(-1 * var(--space-2));
  }
</style>
