<script lang="ts">
  import type { Bucket, Timeline } from "../../lib/stats/aggregate";
  import { formatAxis, formatDay, formatDuration, formatMonth } from "../../lib/stats/format";

  /** Gestapelte Balken: Wiedergabezeit je Tag/Woche/Monat, Filme und Serien getrennt. */
  let {
    data,
    bucket,
    labels,
  }: { data: Timeline; bucket: Bucket; labels: { title: string; movies: string; episodes: string } } = $props();

  const totals = $derived(data.starts.map((_, i) => data.movies[i]! + data.episodes[i]!));
  const max = $derived(Math.max(1, ...totals));
  // Höchstens ~8 Beschriftungen unter der Achse
  const labelEvery = $derived(Math.max(1, Math.ceil(data.starts.length / 8)));

  function label(at: number) {
    if (bucket === "month") return formatMonth(at);
    return formatDay(at);
  }

  function tooltip(i: number) {
    const at = data.starts[i]!;
    const prefix = bucket === "week" ? `Woche ab ${label(at)}` : label(at);
    return `${prefix}: ${formatDuration(totals[i]!)} (${labels.movies} ${formatDuration(data.movies[i]!)}, ${labels.episodes} ${formatDuration(data.episodes[i]!)})`;
  }
</script>

<div class="chart">
  <div class="axis" aria-hidden="true">
    <span>{formatAxis(max)}</span>
    <span>{formatAxis(max / 2)}</span>
    <span>0</span>
  </div>
  <div class="plot">
    <div class="bars" role="img" aria-label={labels.title}>
      {#each data.starts as at, i (at)}
        <div class="bar" title={tooltip(i)}>
          <span class="seg episodes" style:height={`${(data.episodes[i]! / max) * 100}%`}></span>
          <span class="seg movies" style:height={`${(data.movies[i]! / max) * 100}%`}></span>
        </div>
      {/each}
    </div>
    <div class="labels" aria-hidden="true">
      {#each data.starts as at, i (at)}
        <span class="label">{i % labelEvery === 0 ? label(at) : ""}</span>
      {/each}
    </div>
  </div>
</div>
<p class="legend">
  <span><i class="swatch episodes"></i>{labels.episodes}</span>
  <span><i class="swatch movies"></i>{labels.movies}</span>
</p>

<style>
  .chart {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--space-2);
  }

  .axis {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 180px;
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    text-align: right;
  }

  .plot {
    min-width: 0;
  }

  .bars {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 180px;
    border-bottom: 1px solid var(--color-border);
    /* Hilfslinien bei 100 % und 50 % */
    background:
      linear-gradient(var(--color-border), var(--color-border)) 0 0 / 100% 1px no-repeat,
      linear-gradient(var(--color-border), var(--color-border)) 0 50% / 100% 1px no-repeat;
  }

  .bar {
    flex: 1 1 0;
    min-width: 0;
    height: 100%;
    display: flex;
    flex-direction: column-reverse;
    border-radius: 3px 3px 0 0;
    overflow: hidden;
  }

  .bar:hover {
    background: color-mix(in srgb, var(--color-text) 6%, transparent);
  }

  .seg {
    display: block;
    flex: none;
  }

  .episodes {
    background: var(--color-accent);
  }

  .movies {
    background: #ffb74d;
  }

  .labels {
    display: flex;
    gap: 2px;
    margin-top: var(--space-1);
  }

  .label {
    flex: 1 1 0;
    min-width: 0;
    overflow: visible;
    white-space: nowrap;
    font-size: var(--text-xs);
    color: var(--color-text-muted);
  }

  .legend {
    display: flex;
    gap: var(--space-4);
    margin: var(--space-3) 0 0;
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }

  .legend span {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }

  .swatch {
    width: 12px;
    height: 12px;
    border-radius: 3px;
  }
</style>
