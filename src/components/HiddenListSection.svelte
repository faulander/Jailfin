<script lang="ts">
  import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
  import { formatDate } from "../lib/format";
  import type { HiddenItems } from "../lib/hidden/state.svelte";
  import { m } from "../lib/i18n";
  import { posterUrl } from "../lib/jellyfin/images";
  import { loadItemsByIds } from "../lib/jellyfin/queries";
  import Icon from "./Icon.svelte";
  import Img from "./Img.svelte";
  import StateView from "./StateView.svelte";

  /** Liste lokaler Ausblendungen mit Serverdaten (Bild, aktueller Name) und Wiederherstellen-Aktion. */
  let {
    list,
    title,
    hint,
    emptyText,
    unhideLabel,
    unavailableLabel,
    onunhide,
  }: {
    list: HiddenItems;
    title: string;
    hint: string;
    emptyText: string;
    unhideLabel: string;
    unavailableLabel: string;
    onunhide: (id: string) => void;
  } = $props();

  let details = $state<Map<string, BaseItemDto>>(new Map());
  let detailsLoaded = $state(false);
  const requested = new Set<string>();
  const entries = $derived([...list.entries.values()].sort((a, b) => b.hiddenAt.localeCompare(a.hiddenAt)));

  $effect(() => {
    if (!list.ready) return;
    const ids = [...list.entries.keys()].filter((id) => !requested.has(id));
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

  function href(item: BaseItemDto | undefined, id: string) {
    const target = item?.Type === "Episode" ? (item.SeriesId ?? id) : id;
    return `/item/${encodeURIComponent(target)}`;
  }
</script>

<section class="card">
  <h2>{title}</h2>
  <p class="muted small">{hint}</p>
  <StateView
    compact
    loading={!list.ready && !list.error}
    error={list.error ? new Error(m.errors.storage) : null}
    empty={list.ready && entries.length === 0 ? emptyText : undefined}
  />
  {#if entries.length > 0}
    <ul class="hidden-list">
      {#each entries as entry (entry.id)}
        {@const item = details.get(entry.id)}
        {@const name = item?.Type === "Episode" ? `${item.SeriesName} – ${item.Name}` : (item?.Name ?? entry.name ?? entry.id)}
        <li>
          <a class="thumb" href={href(item, entry.id)} aria-hidden="true" tabindex="-1">
            <Img src={item ? posterUrl(item, 120) : undefined} ratio="2 / 3" fallback={name.slice(0, 1)} />
          </a>
          <div class="text">
            <a href={href(item, entry.id)} class="name">{name}</a>
            <p class="muted small">
              {m.settings.hiddenSince(formatDate(entry.hiddenAt) ?? "")}
              {#if detailsLoaded && !item}· {unavailableLabel}{/if}
            </p>
          </div>
          <button class="btn" type="button" aria-label={`${unhideLabel}: ${name}`} onclick={() => onunhide(entry.id)}>
            <Icon name="eye" size={20} />
            <span class="label">{unhideLabel}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  h2 {
    font-size: var(--text-lg);
  }

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
</style>
