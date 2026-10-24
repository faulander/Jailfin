<script lang="ts">
  import { m } from "../lib/i18n";
  import { toasts } from "../lib/toast.svelte";
  import Icon from "./Icon.svelte";
</script>

<div class="toaster" aria-live="polite">
  {#each toasts.items as toast (toast.id)}
    <div class="toast" class:error={toast.tone === "error"} role={toast.tone === "error" ? "alert" : "status"}>
      <p>{toast.message}</p>
      {#if toast.action}
        <button
          class="btn btn-ghost"
          type="button"
          onclick={() => {
            toast.action?.run();
            toasts.dismiss(toast.id);
          }}>{toast.action.label}</button
        >
      {/if}
      <button class="btn btn-icon close" type="button" aria-label={m.common.close} onclick={() => toasts.dismiss(toast.id)}>
        <Icon name="close" size={20} />
      </button>
    </div>
  {/each}
</div>

<style>
  .toaster {
    position: fixed;
    z-index: 50;
    inset-inline: 0;
    bottom: calc(var(--nav-bar) + var(--space-4) + env(safe-area-inset-bottom));
    display: grid;
    justify-items: center;
    gap: var(--space-2);
    padding-inline: var(--space-4);
    pointer-events: none;
  }

  @media (min-width: 900px) {
    .toaster {
      bottom: var(--space-5);
      padding-left: calc(var(--nav-rail) + var(--space-4));
    }
  }

  .toast {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    max-width: min(640px, 100%);
    padding: var(--space-2) var(--space-2) var(--space-2) var(--space-5);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-surface-2);
    box-shadow: var(--shadow-card);
    animation: rise 180ms var(--ease);
  }

  .toast.error {
    border-color: color-mix(in srgb, var(--color-danger) 60%, transparent);
  }

  .toast p {
    flex: 1;
    font-size: var(--text-sm);
  }

  .close {
    background: transparent;
  }

  @keyframes rise {
    from {
      transform: translateY(8px);
      opacity: 0;
    }
  }
</style>
