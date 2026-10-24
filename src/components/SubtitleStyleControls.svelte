<script lang="ts">
  import { m } from "../lib/i18n";
  import {
    POSITION_MAX,
    POSITION_MIN,
    WIDTH_MAX,
    WIDTH_MIN,
    WIDTH_STEP,
    subtitleSettings,
    type SubtitleStyle,
  } from "../lib/player/subtitle-style.svelte";
  import Icon from "./Icon.svelte";

  const t = m.subtitleStyle;
  const style = $derived(subtitleSettings.style);

  const sizes = Object.entries(t.sizes) as [SubtitleStyle["size"], string][];
  const backgrounds = Object.entries(t.backgrounds) as [SubtitleStyle["background"], string][];
  const colors = Object.entries(t.colors) as [SubtitleStyle["color"], string][];
  const weights = Object.entries(t.weights) as [SubtitleStyle["weight"], string][];
</script>

<div class="controls">
  <div class="row">
    <span class="label">{t.size}</span>
    <div class="segmented" role="group" aria-label={t.size}>
      {#each sizes as [value, label] (value)}
        <button type="button" class="chip" aria-pressed={style.size === value} onclick={() => subtitleSettings.update({ size: value })}>
          {label}
        </button>
      {/each}
    </div>
  </div>

  <div class="row">
    <span class="label" id="sub-pos-label">{t.position}</span>
    <div class="stepper" role="group" aria-labelledby="sub-pos-label">
      <button
        type="button"
        class="btn btn-icon"
        aria-label={t.down}
        disabled={style.position <= POSITION_MIN}
        onclick={() => subtitleSettings.update({ position: style.position - 2 })}
      >
        <Icon name="minus" />
      </button>
      <output aria-live="polite">{t.positionValue(style.position)}</output>
      <button
        type="button"
        class="btn btn-icon"
        aria-label={t.up}
        disabled={style.position >= POSITION_MAX}
        onclick={() => subtitleSettings.update({ position: style.position + 2 })}
      >
        <Icon name="plus" />
      </button>
    </div>
  </div>

  <div class="row">
    <span class="label" id="sub-width-label">{t.width}</span>
    <div class="stepper" role="group" aria-labelledby="sub-width-label">
      <button
        type="button"
        class="btn btn-icon"
        aria-label={t.narrower}
        disabled={style.width <= WIDTH_MIN}
        onclick={() => subtitleSettings.update({ width: style.width - WIDTH_STEP })}
      >
        <Icon name="minus" />
      </button>
      <output aria-live="polite">{t.widthValue(style.width)}</output>
      <button
        type="button"
        class="btn btn-icon"
        aria-label={t.wider}
        disabled={style.width >= WIDTH_MAX}
        onclick={() => subtitleSettings.update({ width: style.width + WIDTH_STEP })}
      >
        <Icon name="plus" />
      </button>
    </div>
  </div>

  <div class="row">
    <span class="label">{t.background}</span>
    <div class="segmented" role="group" aria-label={t.background}>
      {#each backgrounds as [value, label] (value)}
        <button
          type="button"
          class="chip"
          aria-pressed={style.background === value}
          onclick={() => subtitleSettings.update({ background: value })}>{label}</button
        >
      {/each}
    </div>
  </div>

  <div class="row">
    <span class="label">{t.color}</span>
    <div class="segmented" role="group" aria-label={t.color}>
      {#each colors as [value, label] (value)}
        <button type="button" class="chip" aria-pressed={style.color === value} onclick={() => subtitleSettings.update({ color: value })}>
          {label}
        </button>
      {/each}
    </div>
  </div>

  <div class="row">
    <span class="label">{t.weight}</span>
    <div class="segmented" role="group" aria-label={t.weight}>
      {#each weights as [value, label] (value)}
        <button type="button" class="chip" aria-pressed={style.weight === value} onclick={() => subtitleSettings.update({ weight: value })}>
          {label}
        </button>
      {/each}
    </div>
  </div>

  <button type="button" class="btn btn-ghost reset" onclick={() => subtitleSettings.reset()}>{t.reset}</button>
</div>

<style>
  .controls {
    display: grid;
    gap: var(--space-4);
    width: 100%;
  }

  .row {
    display: grid;
    gap: var(--space-2);
  }

  .label {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--color-text-muted);
  }

  .stepper {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .stepper .btn {
    background: var(--color-surface-3);
  }

  output {
    min-width: 5ch;
    text-align: center;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }

  .reset {
    justify-self: start;
  }
</style>
