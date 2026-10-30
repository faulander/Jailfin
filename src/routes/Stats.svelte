<script lang="ts">
  import type { BaseItemDto, SessionInfoDto } from "@jellyfin/sdk/lib/generated-client/models";
  import { untrack } from "svelte";
  import StateView from "../components/StateView.svelte";
  import Heatmap from "../components/stats/Heatmap.svelte";
  import NowPlaying from "../components/stats/NowPlaying.svelte";
  import RankList, { type RankRow } from "../components/stats/RankList.svelte";
  import TimelineChart from "../components/stats/TimelineChart.svelte";
  import { m } from "../lib/i18n";
  import { posterUrl } from "../lib/jellyfin/images";
  import { loadItemsByIds } from "../lib/jellyfin/queries";
  import {
    bucketFor,
    byClient,
    byDevice,
    byMethod,
    byUser,
    heatmap,
    summarize,
    timeline,
    topMovies,
    topSeries,
    type PlayRecord,
    type Ranked,
  } from "../lib/stats/aggregate";
  import { formatDateTime, formatDuration, formatNumber } from "../lib/stats/format";
  import { loadPlays, pluginState, type PluginState } from "../lib/stats/playback-reporting";
  import {
    loadIsAdmin,
    loadLibraryCounts,
    loadNowPlaying,
    loadOwnHistory,
    loadUsers,
    type LibraryCounts,
  } from "../lib/stats/server";

  type PeriodKey = keyof typeof m.stats.periods;
  const PERIOD_DAYS: Record<PeriodKey, number | undefined> = { "7": 7, "30": 30, "90": 90, "365": 365, all: undefined };
  const PERIOD_KEY = "jailfin.stats.period";
  const DAY = 86_400_000;

  let period = $state<PeriodKey>(
    (Object.keys(PERIOD_DAYS) as PeriodKey[]).find((k) => k === localStorage.getItem(PERIOD_KEY)) ?? "30",
  );
  let userFilter = $state("");

  let isAdmin = $state(false);
  let plugin = $state<PluginState>();
  let users = $state<{ id: string; name: string }[]>([]);
  let counts = $state<LibraryCounts>();
  let nowPlaying = $state<SessionInfoDto[]>([]);

  let records = $state<PlayRecord[]>([]);
  let ownHistory: PlayRecord[] | undefined;
  let loading = $state(true);
  let error = $state<unknown>(null);
  let items = $state<Record<string, BaseItemDto>>({});
  let historyLimit = $state(25);

  const usePlugin = $derived(plugin === "available");
  const from = $derived.by(() => {
    const days = PERIOD_DAYS[period];
    if (days === undefined) return undefined;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.getTime() - (days - 1) * DAY;
  });

  async function init() {
    loading = true;
    error = null;
    try {
      isAdmin = await loadIsAdmin();
      plugin = isAdmin ? await pluginState() : "forbidden";
      if (isAdmin) users = await loadUsers().catch(() => []);
    } catch (e) {
      error = e;
      loading = false;
    }
    counts = await loadLibraryCounts().catch(() => undefined);
  }

  $effect(() => {
    untrack(() => void init());
  });

  let controller: AbortController | undefined;

  async function load() {
    controller?.abort();
    const current = new AbortController();
    controller = current;
    loading = true;
    error = null;
    try {
      let result: PlayRecord[];
      if (usePlugin) {
        result = await loadPlays({ from, userId: userFilter || undefined }, current.signal);
      } else {
        ownHistory ??= (await loadOwnHistory(current.signal)).sort((a, b) => b.at - a.at);
        result = from === undefined ? ownHistory : ownHistory.filter((r) => r.at >= from);
      }
      if (current.signal.aborted) return;
      records = result;
      historyLimit = 25;
    } catch (e) {
      if (!current.signal.aborted) error = e;
    } finally {
      if (!current.signal.aborted) loading = false;
    }
  }

  $effect(() => {
    if (plugin === undefined) return;
    void from;
    void userFilter;
    void usePlugin;
    untrack(() => void load());
    return () => controller?.abort();
  });

  $effect(() => {
    localStorage.setItem(PERIOD_KEY, period);
  });

  // Laufende Wiedergaben (nur Administratoren) alle 10 s aktualisieren, solange sichtbar.
  $effect(() => {
    if (!isAdmin) return;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      loadNowPlaying()
        .then((s) => (nowPlaying = s))
        .catch(() => undefined);
    };
    refresh();
    const timer = setInterval(refresh, 10_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  });

  const range = $derived.by(() => {
    const to = Date.now();
    // Datensätze sind absteigend sortiert: der letzte ist der älteste.
    const start = from ?? records.at(-1)?.at ?? to;
    return { from: start, to };
  });
  const bucket = $derived(bucketFor(range.from, range.to));
  const chart = $derived(timeline(records, range.from, range.to, bucket));
  const heat = $derived(heatmap(records));
  const summary = $derived(summarize(records));
  const series = $derived(topSeries(records).slice(0, 10));
  const movies = $derived(topMovies(records).slice(0, 10));
  const userNames = $derived(new Map(users.map((u) => [u.id, u.name])));
  const userName = (id: string) => userNames.get(id.replaceAll("-", "").toLowerCase()) ?? "?";

  // Poster und Links der Ranglisten nachladen (Folgen verweisen auf ihre Serie).
  $effect(() => {
    const ids = [...new Set([...series, ...movies].map((r) => r.itemId).filter((id) => !items[id]))];
    if (ids.length === 0) return;
    untrack(() => {
      loadItemsByIds(ids)
        .then((loaded) => {
          items = { ...items, ...Object.fromEntries(loaded.flatMap((i) => (i.Id ? [[i.Id, i]] : []))) };
        })
        .catch(() => undefined);
    });
  });

  function mediaRows(ranked: Ranked[], sub: (r: Ranked) => string): RankRow[] {
    return ranked.map((r) => {
      const item = items[r.itemId];
      const target = item?.Type === "Episode" ? item.SeriesId : item?.Id;
      return {
        key: r.key,
        label: r.label,
        sub: sub(r),
        seconds: r.seconds,
        ...(target ? { href: `/item/${encodeURIComponent(target)}` } : {}),
        ...(item ? { image: posterUrl(item, 80) } : {}),
      };
    });
  }

  const plain = (ranked: Ranked[], label: (key: string) => string = (k) => k): RankRow[] =>
    ranked.map((r) => ({
      key: r.key,
      label: label(r.key),
      sub: m.stats.playsCount(formatNumber(r.plays)),
      seconds: r.seconds,
    }));

  const seriesRows = $derived(
    mediaRows(series, (r) =>
      usePlugin ? m.stats.playsCount(formatNumber(r.plays)) : m.stats.episodesCount(formatNumber(r.plays)),
    ),
  );
  const movieRows = $derived(mediaRows(movies, (r) => m.stats.playsCount(formatNumber(r.plays))));
  const userRows = $derived(usePlugin && !userFilter ? plain(byUser(records), userName) : []);
  const clientRows = $derived(usePlugin ? plain(byClient(records).slice(0, 8)) : []);
  const deviceRows = $derived(usePlugin ? plain(byDevice(records).slice(0, 8)) : []);
  const methodRows = $derived(
    usePlugin ? plain(byMethod(records), (k) => m.stats.methods[k as keyof typeof m.stats.methods] ?? k) : [],
  );
  const history = $derived(records.slice(0, historyLimit));
</script>

<div class="page stats">
  <header class="head">
    <h1 class="page-title">{m.stats.title}</h1>
    <div class="controls">
      <div class="segmented" role="group" aria-label={m.stats.period}>
        {#each Object.entries(m.stats.periods) as [key, label] (key)}
          <button class="chip" type="button" aria-pressed={period === key} onclick={() => (period = key as PeriodKey)}>
            {label}
          </button>
        {/each}
      </div>
      {#if usePlugin && users.length > 1}
        <label class="user">
          <span class="muted small">{m.stats.user}</span>
          <select class="input" bind:value={userFilter}>
            <option value="">{m.stats.allUsers}</option>
            {#each users as user (user.id)}
              <option value={user.id}>{user.name}</option>
            {/each}
          </select>
        </label>
      {/if}
    </div>
  </header>

  {#if plugin !== undefined && !usePlugin}
    <p class="note muted small">
      {m.stats.ownSource}
      {#if isAdmin && plugin === "missing"}<br />{m.stats.pluginMissing}{/if}
    </p>
  {/if}

  {#if isAdmin}
    <section class="card">
      <h2>{m.stats.nowPlaying}</h2>
      {#if nowPlaying.length > 0}
        <NowPlaying sessions={nowPlaying} />
      {:else}
        <p class="muted small">{m.stats.nothingPlaying}</p>
      {/if}
    </section>
  {/if}

  <StateView loading={loading && records.length === 0} {error} onretry={plugin === undefined ? init : load} />

  {#if !error && (!loading || records.length > 0)}
    <section class="tiles" aria-busy={loading}>
      <div class="tile">
        <span class="muted small">{m.stats.watchTime}</span>
        <strong>{formatDuration(summary.seconds)}</strong>
      </div>
      <div class="tile">
        <span class="muted small">{usePlugin ? m.stats.plays : m.stats.watchedItems}</span>
        <strong>{formatNumber(summary.plays)}</strong>
      </div>
      <div class="tile">
        <span class="muted small">{m.stats.titles}</span>
        <strong>{formatNumber(summary.titles)}</strong>
      </div>
      <div class="tile">
        <span class="muted small">{m.stats.activeDays}</span>
        <strong>{formatNumber(summary.activeDays)}</strong>
      </div>
      {#if counts}
        <div class="tile wide">
          <span class="muted small">{m.stats.library}</span>
          <strong class="counts">
            {m.stats.libraryCounts(formatNumber(counts.movies), formatNumber(counts.series), formatNumber(counts.episodes))}
          </strong>
        </div>
      {/if}
    </section>

    {#if records.length === 0}
      <p class="muted">{m.stats.nothing}</p>
    {:else}
      <section class="card">
        <h2>{m.stats.timeline}</h2>
        <TimelineChart
          data={chart}
          {bucket}
          labels={{ title: m.stats.timeline, movies: m.stats.movies, episodes: m.stats.episodes }}
        />
      </section>

      <div class="grid">
        <section class="card">
          <h2>{m.stats.topSeries}</h2>
          <RankList rows={seriesRows} images empty={m.stats.nothing} />
        </section>
        <section class="card">
          <h2>{m.stats.topMovies}</h2>
          <RankList rows={movieRows} images empty={m.stats.nothing} />
        </section>
        {#if usePlugin}
          <section class="card">
            <h2>{m.stats.heatmap}</h2>
            <Heatmap grid={heat} title={m.stats.heatmap} />
          </section>
          {#if userRows.length > 0}
            <section class="card">
              <h2>{m.stats.topUsers}</h2>
              <RankList rows={userRows} empty={m.stats.nothing} />
            </section>
          {/if}
          <section class="card">
            <h2>{m.stats.playback}</h2>
            <RankList rows={methodRows} empty={m.stats.nothing} />
          </section>
          <section class="card">
            <h2>{m.stats.clients}</h2>
            <RankList rows={clientRows} empty={m.stats.nothing} />
          </section>
          <section class="card">
            <h2>{m.stats.devices}</h2>
            <RankList rows={deviceRows} empty={m.stats.nothing} />
          </section>
        {/if}
      </div>

      <section class="card">
        <h2>{m.stats.history}</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{m.stats.columns.when}</th>
                {#if usePlugin && !userFilter}<th>{m.stats.columns.user}</th>{/if}
                <th>{m.stats.columns.title}</th>
                <th class="num">{m.stats.columns.duration}</th>
                {#if usePlugin}
                  <th>{m.stats.columns.client}</th>
                  <th>{m.stats.columns.method}</th>
                {/if}
              </tr>
            </thead>
            <tbody>
              {#each history as r, i (`${r.at}-${r.itemId}-${i}`)}
                <tr>
                  <td class="nowrap">{formatDateTime(r.at)}</td>
                  {#if usePlugin && !userFilter}<td>{userName(r.userId)}</td>{/if}
                  <td>
                    {#if r.series}<strong>{r.series}</strong> <span class="muted">{r.title}</span>
                    {:else}<strong>{r.title}</strong>{/if}
                  </td>
                  <td class="num nowrap">{formatDuration(r.seconds)}</td>
                  {#if usePlugin}
                    <td><span>{r.client}</span> <span class="muted">· {r.device}</span></td>
                    <td class:transcode={r.method === "transcode"} title={r.methodDetail}>{m.stats.methods[r.method]}</td>
                  {/if}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        {#if records.length > historyLimit}
          <button class="btn btn-ghost" type="button" onclick={() => (historyLimit += 50)}>{m.stats.showMore}</button>
        {/if}
      </section>

      {#if usePlugin}<p class="muted small">{m.stats.pluginSource}</p>{/if}
    {/if}
  {/if}
</div>

<style>
  .stats {
    display: grid;
    gap: var(--space-5);
  }

  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
  }

  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-4);
  }

  .user {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .user .input {
    width: auto;
    min-width: 12rem;
  }

  .note {
    margin: 0;
    max-width: 90ch;
  }

  .card {
    display: grid;
    gap: var(--space-4);
    align-content: start;
    min-width: 0;
    padding: var(--space-5);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
  }

  h2 {
    font-size: var(--text-lg);
  }

  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
    gap: var(--space-4);
  }

  .tile {
    display: grid;
    gap: var(--space-1);
    padding: var(--space-4) var(--space-5);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
  }

  .tile strong {
    font-size: var(--text-xl);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .tile.wide {
    grid-column: span 2;
  }

  .tile .counts {
    font-size: var(--text-md, 1rem);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 380px), 1fr));
    gap: var(--space-5);
  }

  .table-wrap {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--text-sm);
  }

  th,
  td {
    padding: var(--space-2) var(--space-3);
    text-align: left;
    border-bottom: 1px solid var(--color-border);
    vertical-align: top;
  }

  th {
    color: var(--color-text-muted);
    font-weight: 600;
  }

  .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .nowrap {
    white-space: nowrap;
  }

  .transcode {
    color: #ffb74d;
  }

  .small {
    font-size: var(--text-sm);
  }

  @media (max-width: 520px) {
    .tile.wide {
      grid-column: auto;
    }
  }
</style>
