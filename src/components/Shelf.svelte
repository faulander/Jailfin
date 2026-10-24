<script lang="ts">
  import type { Snippet } from "svelte";

  /** Horizontale Reihe mit Scroll-Snap; `kind` bestimmt die Kartenbreite. */
  let {
    title,
    kind,
    children,
    aside,
  }: { title: string; kind: "landscape" | "poster"; children: Snippet; aside?: Snippet } = $props();
</script>

<section class="shelf">
  <header>
    <h2>{title}</h2>
    {@render aside?.()}
  </header>
  <div class={["track", kind]}>
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
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-4);
    padding-inline: var(--page-pad);
  }

  h2 {
    font-size: var(--text-lg);
    font-weight: 700;
    letter-spacing: 0.01em;
  }

  .track {
    display: grid;
    grid-auto-flow: column;
    gap: var(--space-4);
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scroll-snap-type: x mandatory;
    scroll-padding-inline: var(--page-pad);
    padding: var(--space-1) var(--page-pad) var(--space-3);
    scrollbar-width: thin;
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
