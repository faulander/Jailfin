<script lang="ts" module>
  export interface RankRow {
    key: string;
    label: string;
    /** Zweite Zeile, z. B. „12 Wiedergaben“ */
    sub?: string;
    seconds: number;
    href?: string;
    image?: string;
  }
</script>

<script lang="ts">
  import Img from "../Img.svelte";
  import { formatDuration } from "../../lib/stats/format";

  /** Rangliste mit Balken (Anteil an der größten Wiedergabezeit). */
  let { rows, empty, images = false }: { rows: RankRow[]; empty: string; images?: boolean } = $props();

  const max = $derived(Math.max(1, ...rows.map((r) => r.seconds)));
</script>

{#if rows.length === 0}
  <p class="muted small">{empty}</p>
{:else}
  <ol class="list">
    {#each rows as row, i (row.key)}
      <li class="row" class:with-image={images}>
        {#if images}
          <span class="thumb">
            {#if row.image}<Img src={row.image} ratio="2 / 3" fallback={row.label} />{/if}
          </span>
        {/if}
        <span class="body">
          <span class="line">
            <span class="rank">{i + 1}</span>
            {#if row.href}
              <a class="name" href={row.href}>{row.label}</a>
            {:else}
              <span class="name">{row.label}</span>
            {/if}
            <span class="value">{formatDuration(row.seconds)}</span>
          </span>
          <span class="bar"><span style:width={`${(row.seconds / max) * 100}%`}></span></span>
          {#if row.sub}<span class="sub">{row.sub}</span>{/if}
        </span>
      </li>
    {/each}
  </ol>
{/if}

<style>
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-3);
  }

  .row {
    display: grid;
    gap: var(--space-3);
    align-items: center;
  }

  .row.with-image {
    grid-template-columns: 40px 1fr;
  }

  .thumb {
    width: 40px;
    border-radius: var(--radius-sm, 4px);
    overflow: hidden;
    background: var(--color-surface-2);
    aspect-ratio: 2 / 3;
  }

  .body {
    display: grid;
    gap: 4px;
    min-width: 0;
  }

  .line {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    min-width: 0;
  }

  .rank {
    flex: none;
    width: 1.5em;
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
  }

  .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
    color: inherit;
    text-decoration: none;
  }

  a.name:hover {
    text-decoration: underline;
  }

  .value {
    flex: none;
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
  }

  .bar {
    display: block;
    height: 6px;
    border-radius: 3px;
    background: var(--color-surface-2);
    overflow: hidden;
  }

  .bar span {
    display: block;
    height: 100%;
    border-radius: 3px;
    background: var(--color-accent);
  }

  .sub {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
  }

  .small {
    font-size: var(--text-sm);
  }
</style>
