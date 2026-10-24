<script lang="ts" module>
  import type { IconName } from "./Icon.svelte";

  export interface Action {
    label: string;
    icon?: IconName;
    run: () => void;
  }
</script>

<script lang="ts">
  import { m } from "../lib/i18n";
  import Icon from "./Icon.svelte";

  /** Kontextmenü als modales Sheet: per Touch, Maus und Tastatur gleich gut erreichbar. */
  let {
    open = $bindable(false),
    title,
    subtitle,
    actions,
  }: { open?: boolean; title: string; subtitle?: string; actions: Action[] } = $props();

  let dialog: HTMLDialogElement | undefined = $state();

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  });

  function choose(action: Action) {
    open = false;
    action.run();
  }
</script>

<dialog
  bind:this={dialog}
  onclose={() => (open = false)}
  onclick={(e) => {
    if (e.target === dialog) open = false;
  }}
  aria-label={title}
>
  <div class="sheet">
    <header>
      <p class="title">{title}</p>
      {#if subtitle}<p class="muted subtitle">{subtitle}</p>{/if}
    </header>
    <ul>
      {#each actions as action (action.label)}
        <li>
          <button type="button" onclick={() => choose(action)}>
            {#if action.icon}<Icon name={action.icon} />{/if}
            <span>{action.label}</span>
          </button>
        </li>
      {/each}
    </ul>
    <button class="btn btn-ghost cancel" type="button" onclick={() => (open = false)}>{m.common.close}</button>
  </div>
</dialog>

<style>
  dialog {
    width: min(480px, calc(100% - 2 * var(--space-4)));
    margin: auto auto var(--space-5);
    padding: 0;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-surface-2);
    color: var(--color-text);
    box-shadow: var(--shadow-card);
  }

  @media (min-width: 700px) {
    dialog {
      margin: auto;
    }
  }

  dialog::backdrop {
    background: var(--color-scrim);
  }

  dialog[open] {
    animation: rise 160ms var(--ease);
  }

  .sheet {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-4);
  }

  header {
    padding: var(--space-2) var(--space-2) var(--space-3);
  }

  .title {
    font-weight: 700;
  }

  .subtitle {
    font-size: var(--text-sm);
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-1);
  }

  li button {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    min-height: 56px;
    padding: 0 var(--space-4);
    border: 0;
    border-radius: var(--radius-md);
    background: transparent;
    text-align: start;
    font-size: var(--text-md);
  }

  li button:hover,
  li button:focus-visible {
    background: var(--color-surface-3);
  }

  .cancel {
    margin-top: var(--space-2);
  }

  @keyframes rise {
    from {
      transform: translateY(12px);
      opacity: 0;
    }
  }
</style>
