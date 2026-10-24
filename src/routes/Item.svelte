<script lang="ts">
  import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
  import StateView from "../components/StateView.svelte";
  import { loadItem } from "../lib/jellyfin/queries";
  import { router } from "../lib/router.svelte";
  import MovieDetail from "./detail/MovieDetail.svelte";
  import SeriesDetail from "./detail/SeriesDetail.svelte";

  let { id }: { id: string } = $props();

  let item = $state<BaseItemDto | null>(null);
  let error = $state<unknown>(null);
  let loading = $state(true);

  async function load() {
    loading = true;
    error = null;
    try {
      const result = await loadItem(id);
      // Staffeln werden auf der Serienseite dargestellt.
      if (result.Type === "Season" && result.SeriesId) {
        router.navigate(`/item/${encodeURIComponent(result.SeriesId)}?season=${encodeURIComponent(id)}`, {
          replace: true,
        });
        return;
      }
      item = result;
    } catch (e) {
      error = e;
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    void load();
  });
</script>

{#if item?.Type === "Series"}
  <SeriesDetail series={item} />
{:else if item}
  <MovieDetail {item} onchange={(updated) => (item = updated)} />
{:else}
  <div class="page">
    <StateView {loading} {error} onretry={load} />
  </div>
{/if}
