<script lang="ts" module>
  import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";

  // Letzte Ergebnisse für sofortige Anzeige bei Rückkehr; aktualisiert wird trotzdem immer (NU-08).
  const cache: { nextUp?: BaseItemDto[]; resume?: BaseItemDto[]; latest?: BaseItemDto[]; key?: string } = {};
</script>

<script lang="ts">
  import { tick, untrack } from "svelte";
  import type { Action } from "../components/ActionSheet.svelte";
  import LandscapeCard from "../components/LandscapeCard.svelte";
  import PosterCard from "../components/PosterCard.svelte";
  import Shelf from "../components/Shelf.svelte";
  import StateView from "../components/StateView.svelte";
  import { hideFromNextUp, hideFromResume, play } from "../lib/actions";
  import { hasResumePosition } from "../lib/format";
  import { m } from "../lib/i18n";
  import { loadLatest, loadNextUp, loadResume } from "../lib/jellyfin/queries";
  import { session } from "../lib/jellyfin/session.svelte";
  import { selectNextUp, selectResume } from "../lib/hidden/filters";
  import { hiddenResume, hiddenSeries } from "../lib/hidden/state.svelte";
  import { router } from "../lib/router.svelte";

  type Section<T> = { data?: T; error?: unknown; loading: boolean };

  // Cache gehört zum angemeldeten Benutzer.
  const cacheKey = `${session.current?.serverId}/${session.userId}`;
  const cached = cache.key === cacheKey ? cache : {};

  let nextUpRaw = $state<Section<BaseItemDto[]>>({ data: cached.nextUp, loading: !cached.nextUp });
  let resume = $state<Section<BaseItemDto[]>>({ data: cached.resume, loading: !cached.resume });
  let latest = $state<Section<BaseItemDto[]>>({ data: cached.latest, loading: !cached.latest });

  let controller: AbortController | undefined;

  function track<T>(promise: Promise<T>, set: (s: Section<T>) => void, current: () => Section<T>, store: (v: T) => void) {
    set({ ...current(), loading: !current().data, error: undefined });
    promise.then(
      (data) => {
        store(data);
        set({ data, loading: false });
      },
      (error: unknown) => {
        if (controller?.signal.aborted) return;
        set({ data: current().data, loading: false, error });
      },
    );
    return promise;
  }

  function load() {
    controller?.abort();
    controller = new AbortController();
    const { signal } = controller;
    cache.key = cacheKey;
    const all = [
      track(loadNextUp(signal), (s) => (nextUpRaw = s), () => nextUpRaw, (v) => (cache.nextUp = v)),
      track(loadResume(signal), (s) => (resume = s), () => resume, (v) => (cache.resume = v)),
      track(loadLatest(signal), (s) => (latest = s), () => latest, (v) => (cache.latest = v)),
    ];
    Promise.allSettled(all).then(async () => {
      await tick();
      router.restoreScroll();
    });
  }

  $effect(() => {
    // untrack: load() liest die Abschnittszustände, die es selbst schreibt.
    untrack(load);
    return () => controller?.abort();
  });

  // Rückkehr in die App (Tab/PWA wieder sichtbar) lädt die Listen neu.
  function onVisibility() {
    if (document.visibilityState === "visible") load();
  }

  const hiddenReady = $derived(hiddenSeries.ready || !!hiddenSeries.error);
  const nextUp = $derived(
    nextUpRaw.data && hiddenReady ? selectNextUp(nextUpRaw.data, hiddenSeries.ids) : undefined,
  );
  // „Weiterschauen“ zeigt keine Folgen, die bereits unter „Als nächstes“ stehen (PRD 4.1),
  // und keine lokal ausgeblendeten Titel.
  const nextUpIds = $derived(new Set((nextUp ?? []).map((i) => i.Id)));
  const resumeReady = $derived(hiddenResume.ready || !!hiddenResume.error);
  const resumeItems = $derived(
    resume.data && resumeReady
      ? selectResume(resume.data, hiddenResume.entries).filter((i) => !nextUpIds.has(i.Id))
      : [],
  );

  function nextUpActions(item: BaseItemDto): Action[] {
    const actions: Action[] = [];
    if (item.SeriesId) {
      const seriesId = item.SeriesId;
      const name = item.SeriesName ?? item.Name ?? "";
      actions.push({ label: m.home.hideSeries, icon: "eyeOff", run: () => void hideFromNextUp(seriesId, name) });
      actions.push({ label: m.home.goToSeries, icon: "tv", run: () => router.navigate(`/item/${encodeURIComponent(seriesId)}`) });
    }
    if (hasResumePosition(item)) {
      actions.push({ label: m.common.playFromStart, icon: "replay10", run: () => play(item, { fromStart: true }) });
    }
    return actions;
  }

  function resumeActions(item: BaseItemDto): Action[] {
    const target = item.Type === "Episode" ? item.SeriesId : item.Id;
    const actions: Action[] = [
      { label: m.common.playFromStart, icon: "replay10", run: () => play(item, { fromStart: true }) },
      { label: m.home.hideResume, icon: "eyeOff", run: () => void hideFromResume(item) },
    ];
    if (target) {
      actions.push({
        label: item.Type === "Episode" ? m.home.goToSeries : m.home.details,
        icon: item.Type === "Episode" ? "tv" : "film",
        run: () => router.navigate(`/item/${encodeURIComponent(target)}`),
      });
    }
    return actions;
  }
</script>

<svelte:document onvisibilitychange={onVisibility} />

<div class="home">
  <Shelf title={m.home.nextUp} kind="landscape">
    {#if nextUp && nextUp.length > 0}
      {#each nextUp as item (item.Id)}
        <LandscapeCard {item} onplay={(i) => play(i)} actions={nextUpActions(item)} />
      {/each}
    {/if}
  </Shelf>
  <div class="state">
    {#if hiddenSeries.error}
      <p class="muted warn">{m.errors.storage}</p>
    {/if}
    <StateView
      compact
      loading={nextUpRaw.loading || (!!nextUpRaw.data && !hiddenReady)}
      error={nextUpRaw.error}
      onretry={load}
      empty={nextUp && nextUp.length === 0 ? m.home.nextUpEmpty : undefined}
    />
  </div>

  {#if resume.loading || resume.error || resumeItems.length > 0}
    <Shelf title={m.home.continueWatching} kind="landscape">
      {#each resumeItems as item (item.Id)}
        <LandscapeCard {item} onplay={(i) => play(i)} actions={resumeActions(item)} />
      {/each}
    </Shelf>
    <div class="state">
      <StateView compact loading={resume.loading} error={resume.error} onretry={load} />
    </div>
  {/if}

  <Shelf title={m.home.latest} kind="poster">
    {#each latest.data ?? [] as item (item.Id)}
      <PosterCard {item} />
    {/each}
  </Shelf>
  <div class="state">
    <StateView
      compact
      loading={latest.loading}
      error={latest.error}
      onretry={load}
      empty={latest.data && latest.data.length === 0 ? m.home.latestEmpty : undefined}
    />
  </div>
</div>

<style>
  .home {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-5) 0 var(--space-7);
  }

  .state {
    padding-inline: var(--page-pad);
    margin-bottom: var(--space-4);
  }

  .state:empty {
    display: none;
  }

  .warn {
    font-size: var(--text-sm);
  }
</style>
