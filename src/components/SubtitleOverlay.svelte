<script lang="ts">
  import { FONT_SIZE, TEXT_COLOR, type SubtitleStyle } from "../lib/player/subtitle-style.svelte";

  /**
   * Eigene Untertiteldarstellung statt `::cue`: erlaubt Position, Größe, Stil und
   * Versatz einheitlich in allen Browsern. Benötigt einen Elterncontainer mit
   * `container-type: size`, damit sich die Schrift an der Videohöhe orientiert.
   */
  let {
    cues,
    style,
    lift = "0px",
  }: {
    /** HTML der aktiven Cues aus dem WebVTT-Parser des Browsers (nur Cue-Markup) */
    cues: string[];
    style: SubtitleStyle;
    /** Mindestabstand vom unteren Rand, z. B. wenn die Steuerleiste sichtbar ist */
    lift?: string;
  } = $props();
</script>

{#if cues.length > 0}
  <div
    class={["subtitles", `bg-${style.background}`]}
    style:--sub-bottom={`max(${style.position}%, ${lift})`}
    style:--sub-size={FONT_SIZE[style.size]}
    style:--sub-color={TEXT_COLOR[style.color]}
    style:--sub-weight={style.weight === "bold" ? 700 : 500}
    aria-live="off"
  >
    {#each cues as cue, i (i)}
      <!-- Markup stammt aus dem WebVTT-Parser des Browsers (getCueAsHTML), nicht aus Rohtext -->
      <p><span>{@html cue}</span></p>
    {/each}
  </div>
{/if}

<style>
  .subtitles {
    position: absolute;
    /* über dem Abdunkelungsverlauf der Steuerung; Klicks gehen durch (pointer-events: none) */
    z-index: 1;
    inset-inline: 6%;
    bottom: var(--sub-bottom);
    display: grid;
    justify-items: center;
    gap: 0.15em;
    pointer-events: none;
    text-align: center;
    font-size: var(--sub-size);
    font-weight: var(--sub-weight);
    line-height: 1.3;
    color: var(--sub-color);
    transition: bottom 200ms var(--ease);
  }

  p {
    margin: 0;
    white-space: pre-line;
  }

  span {
    padding: 0.05em 0.35em;
    border-radius: 0.2em;
    -webkit-box-decoration-break: clone;
    box-decoration-break: clone;
  }

  .bg-shadow span {
    text-shadow:
      0 0 3px black,
      0 0 3px black,
      0.06em 0.06em 0.1em black;
  }

  .bg-box span {
    background: rgb(0 0 0 / 62%);
  }

  .bg-solid span {
    background: black;
  }
</style>
