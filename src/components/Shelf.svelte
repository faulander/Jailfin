<script lang="ts">
  import type { Snippet } from "svelte";
  import { m } from "../lib/i18n";
  import Icon from "./Icon.svelte";

  /**
   * Horizontale Reihe mit Scroll-Snap. Blättern geht per Wischen, per großen
   * Pfeil-Buttons (Touch/Maus/Tastatur) oder über die gut greifbare Scrollleiste.
   */
  let { title, kind, children }: { title: string; kind: "landscape" | "poster"; children: Snippet } = $props();

  let track: HTMLDivElement | undefined = $state();
  let canPrev = $state(false);
  let canNext = $state(false);

  function update() {
    if (!track) return;
    canPrev = track.scrollLeft > 4;
    canNext = track.scrollLeft + track.clientWidth < track.scrollWidth - 4;
  }

  $effect(() => {
    if (!track) return;
    const el = track;
    const observer = new ResizeObserver(update);
    observer.observe(el);
    // Inhalte (Karten) kommen asynchron hinzu.
    const mutations = new MutationObserver(update);
    mutations.observe(el, { childList: true });
    update();
    return () => {
      observer.disconnect();
      mutations.disconnect();
    };
  });

  function page(direction: 1 | -1) {
    if (!track) return;
    track.scrollBy({ left: direction * track.clientWidth * 0.85, behavior: "smooth" });
  }
</script>

<section class="shelf">
  <header>
    <h2>{title}</h2>
    {#if canPrev || canNext}
      <div class="pager">
        <button class="btn btn-icon" type="button" aria-label={`${m.home.shelfPrev}: ${title}`} disabled={!canPrev} onclick={() => page(-1)}>
          <Icon name="back" />
        </button>
        <button class="btn btn-icon" type="button" aria-label={`${m.home.shelfNext}: ${title}`} disabled={!canNext} onclick={() => page(1)}>
          <Icon name="chevronRight" />
        </button>
      </div>
    {/if}
  </header>
  <div class={["track", kind]} bind:this={track} onscroll={update}>
    {@render children()}
  </div>
</section>

<style>
  .shelf {
    display: grid;
    gap: var(--space-3);
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    min-height: var(--touch);
    padding-inline: var(--page-pad);
  }

  h2 {
    font-size: var(--text-lg);
    font-weight: 700;
    letter-spacing: 0.01em;
  }

  .pager {
    display: flex;
    gap: var(--space-2);
  }

  .pager .btn {
    background: var(--color-surface-2);
  }

  .pager .btn:disabled {
    opacity: 0.3;
  }

  .track {
    display: grid;
    grid-auto-flow: column;
    gap: var(--space-4);
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scroll-snap-type: x mandatory;
    scroll-padding-inline: var(--page-pad);
    padding: var(--space-1) var(--page-pad) var(--space-4);
    /* Breite, gut greifbare Leiste statt der hauchdünnen Standardvariante */
    scrollbar-width: auto;
    scrollbar-color: var(--color-surface-3) transparent;
  }

  .track::-webkit-scrollbar {
    height: 14px;
  }

  .track::-webkit-scrollbar-track {
    margin-inline: var(--page-pad);
    border-radius: var(--radius-pill);
    background: var(--color-surface);
  }

  .track::-webkit-scrollbar-thumb {
    border: 3px solid var(--color-surface);
    border-radius: var(--radius-pill);
    background: var(--color-surface-3);
  }

  .track::-webkit-scrollbar-thumb:hover {
    background: var(--color-text-muted);
  }

  .track > :global(*) {
    scroll-snap-align: start;
  }

  .track.landscape {
    grid-auto-columns: clamp(260px, 30vw, 380px);
  }

  .track.poster {
    grid-auto-columns: clamp(130px, 14vw, 180px);
  }
</style>
