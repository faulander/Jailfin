<script lang="ts" module>
  import type { IconName } from "./Icon.svelte";

  export interface Action {
    label: string;
    icon?: IconName;
    /** Markiert die aktuell gewählte Option (z. B. Audiospur). */
    selected?: boolean;
    run: () => void;
  }
</script>

<script lang="ts">
  import Icon from "./Icon.svelte";
  import Sheet from "./Sheet.svelte";

  /** Kontextmenü als modales Sheet: per Touch, Maus und Tastatur gleich gut erreichbar. */
  let {
    open = $bindable(false),
    title,
    subtitle,
    actions,
  }: { open?: boolean; title: string; subtitle?: string; actions: Action[] } = $props();

  function choose(action: Action) {
    open = false;
    action.run();
  }
</script>

<Sheet bind:open {title} {subtitle}>
  <ul class="option-list">
    {#each actions as action (action.label)}
      <li>
        <button type="button" aria-pressed={action.selected} onclick={() => choose(action)}>
          {#if action.icon}<Icon name={action.icon} />{/if}
          <span>{action.label}</span>
          {#if action.selected}<Icon name="check" size={20} />{/if}
        </button>
      </li>
    {/each}
  </ul>
</Sheet>
