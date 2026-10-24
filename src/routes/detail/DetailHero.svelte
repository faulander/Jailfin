<script lang="ts">
  import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
  import type { Snippet } from "svelte";
  import Icon from "../../components/Icon.svelte";
  import Img from "../../components/Img.svelte";
  import { m } from "../../lib/i18n";
  import { backdropUrl, posterUrl } from "../../lib/jellyfin/images";
  import { router } from "../../lib/router.svelte";

  let { item, children }: { item: BaseItemDto; children: Snippet } = $props();

  const backdrop = $derived(backdropUrl(item));
  const poster = $derived(posterUrl(item, 360));
</script>

<section class="hero">
  {#if backdrop}
    <div class="backdrop" aria-hidden="true">
      <img src={backdrop} alt="" decoding="async" />
    </div>
  {/if}
  <button class="btn btn-icon back" type="button" aria-label={m.common.back} onclick={() => router.back("/")}>
    <Icon name="back" />
  </button>
  <div class="content">
    <div class="poster">
      <Img src={poster} ratio="2 / 3" fallback={item.Name ?? ""} eager />
    </div>
    <div class="info">
      {@render children()}
    </div>
  </div>
</section>

<style>
  .hero {
    position: relative;
    isolation: isolate;
    padding: calc(var(--space-7) + var(--space-5)) var(--page-pad) var(--space-5);
  }

  .backdrop {
    position: absolute;
    inset: 0 0 auto;
    height: min(62vh, 560px);
    z-index: -1;
    overflow: hidden;
  }

  .backdrop img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center 25%;
    opacity: 0.45;
  }

  .backdrop::after {
    content: "";
    position: absolute;
    inset: 0;
    background:
      linear-gradient(to bottom, transparent 30%, var(--color-bg) 100%),
      linear-gradient(to right, var(--color-bg) 0%, transparent 70%);
  }

  .back {
    position: absolute;
    top: var(--space-4);
    left: var(--page-pad);
    background: rgb(10 12 16 / 55%);
    backdrop-filter: blur(6px);
  }

  .content {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-5);
    align-items: end;
  }

  .poster {
    display: none;
    border-radius: var(--radius-md);
    overflow: hidden;
    box-shadow: var(--shadow-card);
  }

  .info {
    display: grid;
    gap: var(--space-4);
    min-width: 0;
    max-width: 80ch;
  }

  @media (min-width: 700px) {
    .content {
      grid-template-columns: clamp(180px, 22vw, 260px) 1fr;
    }

    .poster {
      display: block;
    }
  }
</style>
