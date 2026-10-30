<script lang="ts">
  import HiddenListSection from "../components/HiddenListSection.svelte";
  import Icon from "../components/Icon.svelte";
  import SubtitleOverlay from "../components/SubtitleOverlay.svelte";
  import SubtitleStyleControls from "../components/SubtitleStyleControls.svelte";
  import { showInNextUp, showInResume } from "../lib/actions";
  import { hiddenResume, hiddenSeries } from "../lib/hidden/state.svelte";
  import { m } from "../lib/i18n";
  import { session } from "../lib/jellyfin/session.svelte";
  import { subtitleSettings } from "../lib/player/subtitle-style.svelte";
  const info = $derived(session.current);
  const previewCues = ["Das ist ein Beispieluntertitel,", "<i>damit du die Darstellung prüfen kannst.</i>"];

  let localInput = $state(session.current?.localUrl ?? "");
  let checking = $state(false);

  async function saveLocal(event: SubmitEvent) {
    event.preventDefault();
    checking = true;
    try {
      await session.setLocalUrl(localInput);
      localInput = session.current?.localUrl ?? "";
    } finally {
      checking = false;
    }
  }

  async function recheck() {
    checking = true;
    try {
      await session.refreshConnection();
    } finally {
      checking = false;
    }
  }
</script>

<div class="page settings">
  <h1 class="page-title">{m.nav.settings}</h1>

  <section class="card">
    <h2>{m.settings.server}</h2>
    {#if info}
      <dl>
        <dt>{m.settings.serverName}</dt>
        <dd>{info.serverName}</dd>
        {#if info.serverVersion}
          <dt>{m.settings.serverVersion}</dt>
          <dd>{info.serverVersion}</dd>
        {/if}
        <dt>{m.settings.serverAddress}</dt>
        <dd class="mono">{info.serverUrl}</dd>
        <dt>{m.settings.user}</dt>
        <dd>{info.userName}</dd>
      </dl>
    {/if}
    <button class="btn btn-ghost" type="button" onclick={() => session.logout()}>
      <Icon name="logout" size={20} />
      {m.settings.logout}
    </button>
  </section>

  <section class="card">
    <h2>{m.settings.connection}</h2>
    {#if session.connection}
      <p class="status" class:local={session.connection.mode === "local"} role="status">
        <span class="dot" aria-hidden="true"></span>
        <span>
          {session.connection.mode === "local" ? m.settings.activeLocal : m.settings.activePublic}
          <span class="mono small">({session.connection.url})</span>
          {#if session.connection.reason && session.connection.reason !== "none"}
            <br /><span class="muted small">{m.settings.reasons[session.connection.reason]}</span>
          {/if}
        </span>
      </p>
    {/if}
    <form class="local-form" onsubmit={saveLocal}>
      <label class="muted small" for="local-url">{m.settings.localAddress}</label>
      <div class="row">
        <input
          id="local-url"
          class="input"
          type="text"
          inputmode="url"
          autocapitalize="off"
          spellcheck="false"
          placeholder={m.login.localServerPlaceholder}
          bind:value={localInput}
        />
        <button class="btn" type="submit" disabled={checking}>{m.settings.save}</button>
        <button class="btn btn-ghost" type="button" disabled={checking} onclick={recheck}>{m.settings.recheck}</button>
      </div>
      <p class="muted small">{m.settings.localAddressHint}</p>
    </form>
  </section>

  <section class="card">
    <h2>{m.subtitleStyle.title}</h2>
    <p class="muted small">{m.subtitleStyle.hint}</p>
    <div class="preview" aria-label={m.subtitleStyle.preview}>
      <SubtitleOverlay cues={previewCues} style={subtitleSettings.style} />
    </div>
    <SubtitleStyleControls />
  </section>

  <HiddenListSection
    list={hiddenSeries}
    title={m.settings.hiddenSeries}
    hint={m.settings.hiddenSeriesHint}
    emptyText={m.settings.hiddenSeriesEmpty}
    unhideLabel={m.settings.unhide}
    unavailableLabel={m.settings.unavailableSeries}
    onunhide={showInNextUp}
  />

  <HiddenListSection
    list={hiddenResume}
    title={m.settings.hiddenResume}
    hint={m.settings.hiddenResumeHint}
    emptyText={m.settings.hiddenResumeEmpty}
    unhideLabel={m.settings.unhideResume}
    unavailableLabel={m.settings.unavailableItem}
    onunhide={showInResume}
  />

  <p class="muted small version">Jailfin {__APP_VERSION__}</p>
</div>

<style>
  .settings {
    display: grid;
    gap: var(--space-5);
    max-width: 920px;
  }

  .settings :global(.card) {
    display: grid;
    gap: var(--space-4);
    padding: var(--space-5);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    justify-items: start;
  }

  h2 {
    font-size: var(--text-lg);
  }

  dl {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: var(--space-2) var(--space-5);
    margin: 0;
  }

  dt {
    color: var(--color-text-muted);
  }

  dd {
    margin: 0;
    overflow-wrap: anywhere;
  }

  .mono {
    font-family: ui-monospace, monospace;
    font-size: var(--text-sm);
  }

  .small {
    font-size: var(--text-sm);
  }

  .preview {
    position: relative;
    width: min(100%, 560px);
    aspect-ratio: 16 / 9;
    container-type: size;
    border-radius: var(--radius-md);
    overflow: hidden;
    background:
      linear-gradient(160deg, #3b4a5e 0%, #1d2530 55%, #6b5a3e 100%);
  }

  .status {
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
  }

  .dot {
    flex: none;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--color-focus);
  }

  .status.local .dot {
    background: var(--color-success);
  }

  .local-form {
    display: grid;
    gap: var(--space-2);
    width: 100%;
  }

  .local-form .row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .local-form .input {
    flex: 1 1 260px;
    width: auto;
  }

  .version {
    text-align: center;
  }
</style>
