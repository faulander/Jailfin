<script lang="ts">
  import { loadRuntimeConfig } from "../lib/config";
  import { m } from "../lib/i18n";
  import { describeError } from "../lib/jellyfin/errors";
  import { session } from "../lib/jellyfin/session.svelte";

  let server = $state(session.lastServerUrl);
  let username = $state("");
  let password = $state("");
  let busy = $state(false);
  let error = $state<string | null>(null);

  $effect(() => {
    if (server) return;
    loadRuntimeConfig().then((config) => {
      if (!server && config.defaultServerUrl) server = config.defaultServerUrl;
    });
  });

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    busy = true;
    error = null;
    try {
      await session.login(server, username, password);
    } catch (e) {
      error = describeError(e);
    } finally {
      password = "";
      busy = false;
    }
  }
</script>

<main class="login">
  <form class="panel" onsubmit={submit}>
    <div class="brand" aria-hidden="true">J</div>
    <h1 class="page-title">{m.login.title}</h1>

    {#if session.notice && !error}
      <p class="notice" role="status">{session.notice}</p>
    {/if}

    <div class="field">
      <label for="server">{m.login.server}</label>
      <input
        id="server"
        class="input"
        type="text"
        inputmode="url"
        autocomplete="url"
        autocapitalize="off"
        spellcheck="false"
        placeholder={m.login.serverPlaceholder}
        required
        bind:value={server}
      />
    </div>
    <div class="field">
      <label for="username">{m.login.username}</label>
      <input
        id="username"
        class="input"
        autocomplete="username"
        autocapitalize="off"
        spellcheck="false"
        required
        bind:value={username}
      />
    </div>
    <div class="field">
      <label for="password">{m.login.password}</label>
      <input id="password" class="input" type="password" autocomplete="current-password" bind:value={password} />
    </div>

    {#if error}
      <p class="error" role="alert">{error}</p>
    {/if}

    <button class="btn btn-primary submit" type="submit" disabled={busy}>
      {busy ? m.login.connecting : m.login.submit}
    </button>
    <p class="hint muted">{m.login.hint}</p>
  </form>
</main>

<style>
  .login {
    min-height: 100dvh;
    display: grid;
    place-items: center;
    padding: var(--space-5);
    background:
      radial-gradient(circle at 20% 10%, color-mix(in srgb, var(--color-accent) 18%, transparent), transparent 45%),
      var(--color-bg);
  }

  .panel {
    width: min(440px, 100%);
    display: grid;
    gap: var(--space-4);
    padding: var(--space-6);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    box-shadow: var(--shadow-card);
  }

  .brand {
    width: 52px;
    height: 52px;
    display: grid;
    place-items: center;
    border-radius: var(--radius-md);
    background: var(--color-accent);
    color: var(--color-on-accent);
    font-weight: 800;
    font-size: var(--text-xl);
  }

  .submit {
    margin-top: var(--space-2);
  }

  .error,
  .notice {
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
  }

  .error {
    background: color-mix(in srgb, var(--color-danger) 14%, transparent);
    color: var(--color-danger);
  }

  .notice {
    background: var(--color-surface-2);
  }

  .hint {
    font-size: var(--text-xs);
  }
</style>
