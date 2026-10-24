<script lang="ts">
  import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
  import Icon from "../components/Icon.svelte";
  import Img from "../components/Img.svelte";
  import StateView from "../components/StateView.svelte";
  import { showInNextUp } from "../lib/actions";
  import { formatDate } from "../lib/format";
  import { m } from "../lib/i18n";
  import { posterUrl } from "../lib/jellyfin/images";
  import { loadItemsByIds } from "../lib/jellyfin/queries";
  import { session } from "../lib/jellyfin/session.svelte";
  import { hiddenSeries } from "../lib/nextup/hidden.svelte";

  const info = $derived(session.current);

  // Serverdaten (Bild, aktueller Name) zu den ausgeblendeten SeriesIds nachladen.
  let details = $state<Map<string, BaseItemDto>>(new Map());
  let detailsLoaded = $state(false);
  const requested = new Set<string>();
  const hiddenList = $derived(
    [...hiddenSeries.entries.values()].sort((a, b) => b.hiddenAt.localeCompare(a.hiddenAt)),
  );

  $effect(() => {
    if (!hiddenSeries.ready) return;
    const ids = [...hiddenSeries.entries.keys()].filter((id) => !requested.has(id));
    for (const id of ids) requested.add(id);
    if (ids.length === 0) {
      detailsLoaded = true;
      return;
    }
    loadItemsByIds(ids)
      .then((items) => {
        const next = new Map(details);
        for (const item of items) if (item.Id) next.set(item.Id, item);
        details = next;
      })
      .catch(() => undefined)
      .finally(() => (detailsLoaded = true));
  });
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
    <h2>{m.settings.hiddenSeries}</h2>
    <p class="muted hint">{m.settings.hiddenSeriesHint}</p>
    <StateView
      compact
      loading={!hiddenSeries.ready && !hiddenSeries.error}
      error={hiddenSeries.error ? new Error(m.errors.storage) : null}
      empty={hiddenSeries.ready && hiddenList.length === 0 ? m.settings.hiddenSeriesEmpty : undefined}
    />
    {#if hiddenList.length > 0}
      <ul class="hidden-list">
        {#each hiddenList as entry (entry.seriesId)}
          {@const item = details.get(entry.seriesId)}
          {@const name = item?.Name ?? entry.seriesName ?? entry.seriesId}
          <li>
            <a class="thumb" href={`/item/${encodeURIComponent(entry.seriesId)}`} aria-hidden="true" tabindex="-1">
              <Img src={item ? posterUrl(item, 120) : undefined} ratio="2 / 3" fallback={name.slice(0, 1)} />
            </a>
            <div class="text">
              <a href={`/item/${encodeURIComponent(entry.seriesId)}`} class="name">{name}</a>
              <p class="muted small">
                {m.settings.hiddenSince(formatDate(entry.hiddenAt) ?? "")}
                {#if detailsLoaded && !item}· {m.settings.unavailableSeries}{/if}
              </p>
            </div>
            <button class="btn" type="button" onclick={() => showInNextUp(entry.seriesId)}>
              <Icon name="eye" size={20} />
              <span class="label">{m.settings.unhide}</span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <p class="muted small version">Jailfin {__APP_VERSION__}</p>
</div>

<style>
  .settings {
    display: grid;
    gap: var(--space-5);
    max-width: 920px;
  }

  .card {
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

  .hint,
  .small {
    font-size: var(--text-sm);
  }

  .hidden-list {
    list-style: none;
    margin: 0;
    padding: 0;
    width: 100%;
    display: grid;
    gap: var(--space-3);
  }

  .hidden-list li {
    display: grid;
    grid-template-columns: 56px 1fr auto;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-2);
    border-radius: var(--radius-md);
    background: var(--color-surface-2);
  }

  .thumb {
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .text {
    min-width: 0;
  }

  .name {
    font-weight: 700;
  }

  @media (max-width: 640px) {
    .label {
      display: none;
    }

    .hidden-list .btn {
      width: var(--touch);
      padding: 0;
    }
  }

  .version {
    text-align: center;
  }
</style>
