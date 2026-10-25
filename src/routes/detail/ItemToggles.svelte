<script lang="ts">
  import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
  import Icon from "../../components/Icon.svelte";
  import { toggleWatchlist } from "../../lib/actions";
  import { m } from "../../lib/i18n";
  import { describeError } from "../../lib/jellyfin/errors";
  import { setFavorite } from "../../lib/jellyfin/queries";
  import { toasts } from "../../lib/toast.svelte";
  import { watchlist } from "../../lib/watchlist/state.svelte";

  /** Favorit (Jellyfin) und Merkliste (Filme/Serien) für die Detailseiten. */
  let { item }: { item: BaseItemDto } = $props();

  let favoriteOverride = $state<boolean>();
  let busy = $state(false);
  const favorite = $derived(favoriteOverride ?? !!item.UserData?.IsFavorite);
  const canWatchlist = $derived(item.Type === "Movie" || item.Type === "Series");
  const onWatchlist = $derived(watchlist.has(item.Id));

  async function toggleFavorite() {
    if (!item.Id) return;
    busy = true;
    try {
      const data = await setFavorite(item.Id, !favorite);
      favoriteOverride = !!data.IsFavorite;
    } catch (e) {
      toasts.show(describeError(e), { tone: "error" });
    } finally {
      busy = false;
    }
  }
</script>

{#if canWatchlist}
  <button
    class="btn btn-ghost toggle"
    class:on={onWatchlist}
    type="button"
    aria-pressed={onWatchlist}
    aria-label={onWatchlist ? m.detail.watchlistRemoveLabel : m.detail.watchlistAddLabel}
    disabled={!watchlist.ready}
    onclick={() => toggleWatchlist(item)}
  >
    <Icon name="bookmark" size={20} />
    {onWatchlist ? m.detail.watchlistRemove : m.detail.watchlistAdd}
  </button>
{/if}
<button
  class="btn btn-ghost toggle"
  class:on={favorite}
  type="button"
  aria-pressed={favorite}
  aria-label={favorite ? m.detail.removeFavorite : m.detail.addFavorite}
  disabled={busy}
  onclick={toggleFavorite}
>
  <Icon name="heart" size={20} />
  {m.detail.favorite}
</button>

<style>
  .toggle.on {
    border-color: var(--color-accent);
    color: var(--color-accent);
  }

  .toggle.on :global(svg path) {
    fill: currentColor;
  }
</style>
