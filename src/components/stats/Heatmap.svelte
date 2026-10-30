<script lang="ts">
  import { formatDuration } from "../../lib/stats/format";

  /** Wiedergabezeit nach Wochentag (Zeilen, Montag zuerst) und Stunde (Spalten). */
  let { grid, title }: { grid: number[][]; title: string } = $props();

  const days = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  const max = $derived(Math.max(1, ...grid.flat()));
</script>

<div class="heatmap" role="img" aria-label={title}>
  <span></span>
  {#each Array.from({ length: 24 }, (_, h) => h) as hour (hour)}
    <span class="hour" aria-hidden="true">{hour % 3 === 0 ? hour : ""}</span>
  {/each}
  {#each grid as row, d (d)}
    <span class="day" aria-hidden="true">{days[d]}</span>
    {#each row as value, h (h)}
      <span
        class="cell"
        style:--level={value / max}
        title={`${days[d]} ${String(h).padStart(2, "0")}–${String(h + 1).padStart(2, "0")} Uhr: ${formatDuration(value)}`}
      ></span>
    {/each}
  {/each}
</div>

<style>
  .heatmap {
    display: grid;
    grid-template-columns: auto repeat(24, minmax(0, 1fr));
    gap: 3px;
    align-items: center;
  }

  .hour,
  .day {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
  }

  .day {
    padding-right: var(--space-2);
  }

  .cell {
    aspect-ratio: 1;
    min-height: 10px;
    border-radius: 3px;
    background: color-mix(
      in srgb,
      var(--color-accent) calc(var(--level) * 100%),
      var(--color-surface-2)
    );
  }
</style>
