<script lang="ts">
  import { m } from "../lib/i18n";
  import { describeError } from "../lib/jellyfin/errors";
  import Icon from "./Icon.svelte";

  let {
    loading = false,
    error = null,
    empty,
    onretry,
    compact = false,
  }: {
    loading?: boolean;
    error?: unknown;
    /** Text für den leeren Zustand; wird nur gezeigt, wenn weder geladen wird noch ein Fehler vorliegt */
    empty?: string;
    onretry?: () => void;
    compact?: boolean;
  } = $props();
</script>

{#if loading}
  <div class="state" class:compact role="status" aria-live="polite">
    <span class="spinner" aria-hidden="true"></span>
    <span class="visually-hidden">{m.common.loading}</span>
  </div>
{:else if error}
  <div class="state error" class:compact role="alert">
    <Icon name={navigator.onLine ? "alert" : "wifiOff"} size={28} />
    <p>{navigator.onLine ? describeError(error) : m.common.offline}</p>
    {#if onretry}
      <button class="btn btn-ghost" type="button" onclick={onretry}>{m.common.retry}</button>
    {/if}
  </div>
{:else if empty}
  <div class="state" class:compact>
    <p class="muted">{empty}</p>
  </div>
{/if}

<style>
  .state {
    display: grid;
    justify-items: center;
    gap: var(--space-3);
    padding: var(--space-7) var(--space-4);
    text-align: center;
  }

  .state.compact {
    justify-items: start;
    text-align: start;
    padding: var(--space-4) 0;
  }

  .error p {
    max-width: 48ch;
  }

  .error :global(svg) {
    color: var(--color-danger);
  }

  .spinner {
    width: 36px;
    height: 36px;
    border: 3px solid var(--color-surface-3);
    border-top-color: var(--color-accent);
    border-radius: 50%;
    animation: spin 0.9s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
