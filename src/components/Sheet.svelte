<script lang="ts">
  import type { Snippet } from "svelte";
  import { m } from "../lib/i18n";

  /** Modales Sheet (natives <dialog>): Fokusfalle, Esc und Tippen auf den Hintergrund schließen. */
  let {
    open = $bindable(false),
    title,
    subtitle,
    wide = false,
    children,
  }: { open?: boolean; title: string; subtitle?: string; wide?: boolean; children: Snippet } = $props();

  let dialog: HTMLDialogElement | undefined = $state();

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  });
</script>

<dialog
  bind:this={dialog}
  class:wide
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
    {@render children()}
    <button class="btn btn-ghost cancel" type="button" onclick={() => (open = false)}>{m.common.close}</button>
  </div>
</dialog>

<style>
  dialog {
    width: min(480px, calc(100% - 2 * var(--space-4)));
    max-height: calc(100dvh - 2 * var(--space-4));
    margin: auto auto var(--space-5);
    padding: 0;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-surface-2);
    color: var(--color-text);
    box-shadow: var(--shadow-card);
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  dialog.wide {
    width: min(640px, calc(100% - 2 * var(--space-4)));
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
