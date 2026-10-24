<script lang="ts">
  /** Lazy geladenes Bild mit ruhigem Platzhalter; fehlende/defekte Bilder zerstören kein Layout. */
  let {
    src,
    alt = "",
    ratio,
    fallback = "",
    eager = false,
  }: {
    src: string | undefined;
    alt?: string;
    /** CSS aspect-ratio, z. B. "2 / 3" */
    ratio: string;
    /** Text im Platzhalter (z. B. Titel), wenn kein Bild existiert */
    fallback?: string;
    eager?: boolean;
  } = $props();

  // Zustand an die konkrete URL binden, damit ein Wechsel von `src` sauber zurücksetzt.
  let loadedSrc = $state<string>();
  let failedSrc = $state<string>();
  const failed = $derived(!!src && failedSrc === src);
  const loaded = $derived(!!src && loadedSrc === src);
</script>

<div class="frame" style:aspect-ratio={ratio}>
  {#if src && !failed}
    <img
      {src}
      {alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      class:loaded
      onload={() => (loadedSrc = src)}
      onerror={() => (failedSrc = src)}
    />
  {/if}
  {#if !src || failed}
    <span class="fallback" aria-hidden="true">{fallback}</span>
  {/if}
</div>

<style>
  .frame {
    position: relative;
    width: 100%;
    overflow: hidden;
    border-radius: inherit;
    background: linear-gradient(135deg, var(--color-surface-2), var(--color-surface));
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0;
    transition: opacity 200ms var(--ease);
  }

  img.loaded {
    opacity: 1;
  }

  .fallback {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    padding: var(--space-3);
    text-align: center;
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    font-weight: 600;
    overflow: hidden;
  }
</style>
