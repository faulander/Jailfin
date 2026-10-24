<script lang="ts">
  import type { BaseItemDto, MediaStream } from "@jellyfin/sdk/lib/generated-client/models";
  import type Hls from "hls.js/light";
  import { onDestroy, untrack } from "svelte";
  import ActionSheet, { type Action } from "../components/ActionSheet.svelte";
  import Icon from "../components/Icon.svelte";
  import StateView from "../components/StateView.svelte";
  import { episodeCode, formatClock, ticksToSeconds } from "../lib/format";
  import { m } from "../lib/i18n";
  import { backdropUrl } from "../lib/jellyfin/images";
  import { describeError } from "../lib/jellyfin/errors";
  import { loadFollowingEpisode, loadItem } from "../lib/jellyfin/queries";
  import {
    audioStreams,
    fetchSubtitle,
    isClientRenderable,
    requestPlayback,
    subtitleStreams,
    trackLabel,
    type Playback,
    type PlaybackRequest,
  } from "../lib/player/playback";
  import { PlaybackReporter } from "../lib/player/reporter";
  import { router } from "../lib/router.svelte";
  import { toasts } from "../lib/toast.svelte";

  let { id }: { id: string } = $props();

  const NEXT_EPISODE_WINDOW_S = 30;
  const HIDE_CONTROLS_MS = 3500;

  let video: HTMLVideoElement | undefined = $state();
  let container: HTMLDivElement | undefined = $state();
  let item = $state<BaseItemDto | null>(null);
  let playback = $state<Playback | null>(null);
  let phase = $state<"loading" | "playing" | "ended" | "error">("loading");
  let error = $state<unknown>(null);
  let following = $state<BaseItemDto | undefined>();

  let currentTime = $state(0);
  let duration = $state(0);
  let paused = $state(true);
  let muted = $state(false);
  let volume = $state(1);
  let buffering = $state(true);
  let scrubbing = $state<number | null>(null);
  let fullscreen = $state(false);
  let controlsVisible = $state(true);
  let audioMenu = $state(false);
  let subtitleMenu = $state(false);
  let subtitleUrl = $state<string | null>(null);
  let activeSubtitle = $state(-1);

  let request: PlaybackRequest = {};
  let reporter: PlaybackReporter | null = null;
  let hls: Hls | null = null;
  let pendingSeek: number | null = null;
  let triedFallback = false;
  let hideTimer: ReturnType<typeof setTimeout> | undefined;
  let destroyed = false;

  const volumeAdjustable = (() => {
    const probe = document.createElement("video");
    probe.volume = 0.5;
    return probe.volume === 0.5;
  })();

  const title = $derived(
    item?.Type === "Episode" ? (item.SeriesName ?? item.Name ?? "") : (item?.Name ?? ""),
  );
  const subtitleText = $derived(
    item?.Type === "Episode" ? [episodeCode(item), item.Name].filter(Boolean).join(" · ") : "",
  );
  const audios = $derived(playback ? audioStreams(playback.source) : []);
  const subtitles = $derived(playback ? subtitleStreams(playback.source) : []);
  const shownTime = $derived(scrubbing ?? currentTime);
  const nearEnd = $derived(duration > 0 && duration - currentTime < NEXT_EPISODE_WINDOW_S);

  // ---- Laden & Quellen --------------------------------------------------

  async function start() {
    phase = "loading";
    error = null;
    try {
      const loaded = await loadItem(id);
      if (destroyed) return;
      item = loaded;
      const startParam = router.query.get("start");
      const startAt = startParam != null ? Number(startParam) || 0 : ticksToSeconds(loaded.UserData?.PlaybackPositionTicks);
      if (loaded.Type === "Episode" && loaded.SeriesId && loaded.Id) {
        loadFollowingEpisode(loaded.SeriesId, loaded.Id)
          .then((next) => (following = next))
          .catch(() => undefined);
      }
      setMediaSession(loaded);
      await begin({}, startAt);
    } catch (e) {
      fail(e);
    }
  }

  /**
   * (Neu-)Aushandeln der Wiedergabe, z. B. initial, nach Spurwechsel oder als Fallback.
   * Ohne `subtitleStreamIndex` gilt die Untertitel-Vorgabe des Servers (Benutzereinstellung).
   */
  async function begin(next: PlaybackRequest, startAt: number) {
    if (!item || !video) return;
    teardownSource();
    phase = "loading";
    buffering = true;
    request = next;
    const pb = await requestPlayback(item, next);
    if (destroyed) return;
    playback = pb;
    const el = video;
    reporter = new PlaybackReporter(pb, () => ({
      position: el.currentTime,
      paused: el.paused,
      muted: el.muted,
      volume: el.volume,
      audioStreamIndex: playback?.audioStreamIndex,
      subtitleStreamIndex: activeSubtitle,
    }));

    if (pb.isHls && !el.canPlayType("application/vnd.apple.mpegurl")) {
      // Light-Build genügt: Untertitel und Spurwahl übernimmt der Server bzw. <track>.
      const { default: HlsJs } = await import("hls.js/light");
      if (destroyed) return;
      if (!HlsJs.isSupported()) throw new Error(m.player.unplayable);
      const instance = new HlsJs({ startPosition: startAt, maxBufferLength: 30 });
      instance.on(HlsJs.Events.ERROR, (_event, data) => {
        if (data.fatal) fail(new Error(`${m.player.unplayable} (${data.details})`));
      });
      instance.loadSource(pb.url);
      instance.attachMedia(el);
      hls = instance;
      pendingSeek = null;
    } else {
      pendingSeek = startAt > 0 ? startAt : null;
      el.src = pb.url;
    }

    await applySubtitle(pb, next.subtitleStreamIndex ?? pb.subtitleStreamIndex ?? -1);
    el.play().catch(() => {
      // Autoplay blockiert: großer Play-Button bleibt sichtbar.
      buffering = false;
    });
  }

  /** Textuntertitel stellt der Browser dar; alle anderen hat der Server bereits eingebrannt. */
  async function applySubtitle(pb: Playback, index: number) {
    activeSubtitle = index;
    const stream = subtitleStreams(pb.source).find((s) => s.Index === index);
    if (stream && isClientRenderable(stream)) await showSubtitle(stream).catch(() => undefined);
  }

  function teardownSource() {
    reporter?.stop();
    reporter = null;
    hls?.destroy();
    hls = null;
    clearSubtitle();
    if (video) {
      video.removeAttribute("src");
      video.load();
    }
  }

  function fail(e: unknown) {
    if (destroyed) return;
    error = e;
    phase = "error";
    buffering = false;
    reporter?.stop();
  }

  // ---- Medienereignisse ---------------------------------------------------

  function onLoadedMetadata() {
    if (video && pendingSeek != null) {
      video.currentTime = Math.min(pendingSeek, Math.max(0, video.duration - 5));
      pendingSeek = null;
    }
  }

  function onPlaying() {
    phase = "playing";
    buffering = false;
    reporter?.start();
    scheduleHide();
  }

  function onError() {
    if (!video?.error || !playback) return;
    // Direct Play scheitert im Browser → einmalig auf serverseitiges Transcoding ausweichen.
    if (playback.method === "DirectPlay" && !triedFallback) {
      triedFallback = true;
      begin(
        { ...request, disableDirectPlay: true, subtitleStreamIndex: activeSubtitle },
        video.currentTime || pendingSeek || 0,
      ).catch(fail);
      return;
    }
    fail(new Error(m.player.unplayableDetail(video.error.message || `Code ${video.error.code}`)));
  }

  function onEnded() {
    reporter?.stop();
    phase = "ended";
    controlsVisible = true;
  }

  // ---- Steuerung -----------------------------------------------------------

  function togglePlay() {
    if (!video) return;
    if (video.paused) video.play().catch(() => undefined);
    else video.pause();
  }

  function seekBy(delta: number) {
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(duration || Infinity, video.currentTime + delta));
    reveal();
  }

  function commitSeek(value: number) {
    if (video) video.currentTime = value;
    scrubbing = null;
  }

  async function toggleFullscreen() {
    const el = container as (HTMLDivElement & { webkitRequestFullscreen?: () => void }) | undefined;
    const doc = document as Document & { webkitExitFullscreen?: () => void; webkitFullscreenElement?: Element };
    if (doc.fullscreenElement || doc.webkitFullscreenElement) {
      await (doc.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
      return;
    }
    if (el?.requestFullscreen) await el.requestFullscreen().catch(() => undefined);
    else if (el?.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else (video as HTMLVideoElement & { webkitEnterFullscreen?: () => void })?.webkitEnterFullscreen?.();
  }

  function onFullscreenChange() {
    const doc = document as Document & { webkitFullscreenElement?: Element };
    fullscreen = !!(doc.fullscreenElement ?? doc.webkitFullscreenElement);
  }

  $effect(() => {
    // Safari (iPad) meldet Vollbildwechsel nur mit Präfix.
    document.addEventListener("webkitfullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
  });

  function reveal() {
    controlsVisible = true;
    scheduleHide();
  }

  function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (video && !video.paused && !audioMenu && !subtitleMenu && scrubbing == null) controlsVisible = false;
    }, HIDE_CONTROLS_MS);
  }

  /** Tippen auf die freie Fläche blendet die Steuerung ein bzw. aus. */
  function onSurfaceClick(event: MouseEvent) {
    if (event.target !== event.currentTarget) return;
    if (controlsVisible && phase === "playing") {
      controlsVisible = false;
      clearTimeout(hideTimer);
    } else reveal();
  }

  function onKeydown(event: KeyboardEvent) {
    if (audioMenu || subtitleMenu || event.ctrlKey || event.metaKey || event.altKey) return;
    if ((event.target as HTMLElement | null)?.closest?.("input[type=range]") && event.key.startsWith("Arrow")) return;
    const handlers: Record<string, () => void> = {
      " ": togglePlay,
      k: togglePlay,
      ArrowLeft: () => seekBy(-10),
      ArrowRight: () => seekBy(30),
      f: () => void toggleFullscreen(),
      m: () => video && (video.muted = !video.muted),
    };
    const handler = handlers[event.key];
    if (!handler) return;
    if ((event.target as HTMLElement | null)?.tagName === "BUTTON" && event.key === " ") return;
    event.preventDefault();
    handler();
    reveal();
  }

  function exit() {
    router.back(item?.Type === "Episode" && item.SeriesId ? `/item/${item.SeriesId}` : `/item/${id}`);
  }

  function playNext() {
    if (following?.Id) router.navigate(`/play/${encodeURIComponent(following.Id)}`, { replace: true });
  }

  // ---- Spuren --------------------------------------------------------------

  function selectAudio(stream: MediaStream) {
    if (!playback || !video || stream.Index == null) return;
    const index = stream.Index;
    if (index === playback.audioStreamIndex) return;
    const native = (video as HTMLVideoElement & { audioTracks?: { length: number; [i: number]: { enabled: boolean } } })
      .audioTracks;
    const ordinal = audios.findIndex((a) => a.Index === index);
    if (playback.method === "DirectPlay" && native && native.length === audios.length && ordinal >= 0) {
      for (let i = 0; i < native.length; i++) native[i]!.enabled = i === ordinal;
      playback = { ...playback, audioStreamIndex: index };
      reporter?.progress("AudioTrackChange");
      return;
    }
    // Ohne native Spurwahl wählt der Server die Spur (Remux/Transcoding).
    const isDefault = index === playback.source.DefaultAudioStreamIndex;
    begin(
      {
        ...request,
        audioStreamIndex: index,
        subtitleStreamIndex: activeSubtitle,
        disableDirectPlay: isDefault ? request.disableDirectPlay : true,
      },
      video.currentTime,
    ).catch(fail);
  }

  async function selectSubtitle(index: number) {
    if (!playback || !video || index === activeSubtitle) return;
    const current = subtitles.find((s) => s.Index === activeSubtitle);
    const burnedIn = !!current && !isClientRenderable(current);
    const target = subtitles.find((s) => s.Index === index);
    if (index >= 0 && !target) return;
    const clientSide = !target || isClientRenderable(target);

    if (clientSide && !burnedIn) {
      try {
        if (target) await showSubtitle(target);
        else clearSubtitle();
        activeSubtitle = index;
        reporter?.progress("SubtitleTrackChange");
      } catch (e) {
        toasts.show(describeError(e), { tone: "error" });
      }
      return;
    }
    // Bild-/eingebettete Untertitel einbrennen bzw. eingebrannte entfernen: Server neu fragen.
    clearSubtitle();
    await begin(
      { ...request, subtitleStreamIndex: index, disableDirectPlay: !clientSide || request.disableDirectPlay },
      video.currentTime,
    ).catch(fail);
  }

  async function showSubtitle(stream: MediaStream) {
    const url = await fetchSubtitle(stream);
    clearSubtitle();
    subtitleUrl = url;
  }

  function clearSubtitle() {
    if (subtitleUrl) URL.revokeObjectURL(subtitleUrl);
    subtitleUrl = null;
  }

  function onTrackLoad(event: Event) {
    const track = (event.currentTarget as HTMLTrackElement).track;
    track.mode = "showing";
  }

  const audioActions = $derived<Action[]>(
    audios.map((stream, i) => ({
      label: `${stream.Index === playback?.audioStreamIndex ? "✓ " : ""}${trackLabel(stream, i + 1)}`,
      run: () => selectAudio(stream),
    })),
  );

  const subtitleActions = $derived<Action[]>([
    { label: `${activeSubtitle === -1 ? "✓ " : ""}${m.player.subtitlesOff}`, run: () => void selectSubtitle(-1) },
    ...subtitles.map((stream, i) => ({
      label: `${stream.Index === activeSubtitle ? "✓ " : ""}${trackLabel(stream, i + 1)}${stream.IsExternal ? ` · ${m.player.external}` : ""}`,
      run: () => void selectSubtitle(stream.Index ?? -1),
    })),
  ]);

  function setMediaSession(target: BaseItemDto) {
    if (!("mediaSession" in navigator)) return;
    const art = backdropUrl(target, 512);
    navigator.mediaSession.metadata = new MediaMetadata({
      title: target.Name ?? "",
      artist: target.SeriesName ?? "",
      artwork: art ? [{ src: art, sizes: "512x288" }] : [],
    });
  }

  $effect(() => {
    if (!video) return;
    untrack(() => void start());
  });

  onDestroy(() => {
    destroyed = true;
    clearTimeout(hideTimer);
    teardownSource();
    if ("mediaSession" in navigator) navigator.mediaSession.metadata = null;
    const doc = document as Document & { webkitFullscreenElement?: Element };
    if (doc.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  });
</script>

<svelte:window onkeydown={onKeydown} onpagehide={() => reporter?.stop()} />
<svelte:document onfullscreenchange={onFullscreenChange} />

<div
  class="player"
  class:hide-cursor={!controlsVisible}
  bind:this={container}
  onpointermove={(e) => {
    if (e.pointerType === "mouse") reveal();
  }}
  role="application"
  aria-label={title}
>
  <video
    bind:this={video}
    bind:currentTime
    bind:duration
    bind:paused
    bind:muted
    bind:volume
    playsinline
    preload="auto"
    onloadedmetadata={onLoadedMetadata}
    onplaying={onPlaying}
    onwaiting={() => (buffering = true)}
    oncanplay={() => (buffering = false)}
    onpause={() => {
      reporter?.progress("pause");
      reveal();
    }}
    onplay={() => reporter?.progress("unpause")}
    onseeked={() => reporter?.progress("timeupdate")}
    onended={onEnded}
    onerror={onError}
    ondblclick={() => void toggleFullscreen()}
  >
    {#if subtitleUrl}
      {#key subtitleUrl}
        <track kind="subtitles" src={subtitleUrl} default label="Untertitel" onload={onTrackLoad} />
      {/key}
    {/if}
  </video>

  <!-- Bedienoberfläche -->
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="surface" class:visible={controlsVisible || phase !== "playing"} onclick={onSurfaceClick}>
    <header class="top">
      <button class="btn btn-icon round" type="button" aria-label={m.common.back} onclick={exit}>
        <Icon name="back" />
      </button>
      <div class="titles">
        <p class="title">{title}</p>
        {#if subtitleText}<p class="subtitle">{subtitleText}</p>{/if}
      </div>
      {#if playback}
        <span class="method">{m.player.method[playback.method]}</span>
      {/if}
    </header>

    {#if phase === "error"}
      <div class="center message" role="alert">
        <StateView error={error} />
        <div class="row">
          <button
            class="btn btn-primary"
            type="button"
            onclick={() => {
              triedFallback = false;
              void start();
            }}
          >
            {m.common.retry}
          </button>
          <button class="btn" type="button" onclick={exit}>{m.common.back}</button>
        </div>
        {#if error}<p class="visually-hidden">{describeError(error)}</p>{/if}
      </div>
    {:else if phase === "ended"}
      <div class="center message">
        <p class="ended">{m.player.finished}</p>
        <div class="row">
          {#if following}
            <button class="btn btn-primary" type="button" onclick={playNext}>
              <Icon name="next" size={20} />
              {m.player.nextEpisode}: {episodeCode(following) ?? ""} {following.Name}
            </button>
          {/if}
          <button class="btn" type="button" onclick={exit}>{m.common.back}</button>
        </div>
      </div>
    {:else}
      <div class="center transport">
        <button class="btn btn-icon round big-side" type="button" aria-label={m.player.rewind} onclick={() => seekBy(-10)}>
          <Icon name="replay10" size={30} />
        </button>
        {#if buffering && phase === "loading"}
          <span class="spinner" role="status" aria-label={m.common.loading}></span>
        {:else}
          <button class="btn btn-icon round big" type="button" aria-label={paused ? m.player.play : m.player.pause} onclick={togglePlay}>
            <Icon name={paused ? "play" : "pause"} size={40} />
          </button>
        {/if}
        <button class="btn btn-icon round big-side" type="button" aria-label={m.player.forward} onclick={() => seekBy(30)}>
          <Icon name="forward30" size={30} />
        </button>
      </div>

      <footer class="bottom">
        {#if following && nearEnd}
          <button class="btn btn-primary next" type="button" onclick={playNext}>
            <Icon name="next" size={20} />
            {m.player.nextEpisode}
          </button>
        {/if}
        <div class="timeline">
          <span class="time">{formatClock(shownTime)}</span>
          <input
            type="range"
            class="seek"
            min="0"
            max={duration || 0}
            step="1"
            value={shownTime}
            aria-label={m.player.seek}
            aria-valuetext={`${formatClock(shownTime)} / ${formatClock(duration)}`}
            style:--pct={`${duration ? (shownTime / duration) * 100 : 0}%`}
            oninput={(e) => {
              scrubbing = Number(e.currentTarget.value);
              reveal();
            }}
            onchange={(e) => commitSeek(Number(e.currentTarget.value))}
          />
          <span class="time">−{formatClock(Math.max(0, duration - shownTime))}</span>
        </div>
        <div class="tools">
          <button class="btn btn-icon" type="button" aria-label={muted ? m.player.unmute : m.player.mute} onclick={() => (muted = !muted)}>
            <Icon name={muted ? "mute" : "volume"} />
          </button>
          {#if volumeAdjustable}
            <input
              class="volume"
              type="range"
              min="0"
              max="1"
              step="0.05"
              bind:value={volume}
              aria-label={m.player.volume}
              style:--pct={`${volume * 100}%`}
            />
          {/if}
          <span class="spacer"></span>
          {#if audios.length > 1}
            <button class="btn btn-icon" type="button" aria-label={m.player.audio} onclick={() => (audioMenu = true)}>
              <Icon name="audio" />
            </button>
          {/if}
          {#if subtitles.length > 0}
            <button
              class="btn btn-icon"
              class:active={activeSubtitle >= 0}
              type="button"
              aria-label={m.player.subtitles}
              onclick={() => (subtitleMenu = true)}
            >
              <Icon name="subtitles" />
            </button>
          {/if}
          <button
            class="btn btn-icon"
            type="button"
            aria-label={fullscreen ? m.player.exitFullscreen : m.player.fullscreen}
            onclick={() => void toggleFullscreen()}
          >
            <Icon name={fullscreen ? "fullscreenExit" : "fullscreen"} />
          </button>
        </div>
      </footer>
    {/if}
  </div>

  <ActionSheet bind:open={audioMenu} title={m.player.audio} actions={audioActions} />
  <ActionSheet bind:open={subtitleMenu} title={m.player.subtitles} actions={subtitleActions} />
</div>

<style>
  .player {
    position: fixed;
    inset: 0;
    background: black;
    color: white;
    user-select: none;
    -webkit-user-select: none;
  }

  .player.hide-cursor {
    cursor: none;
  }

  video {
    width: 100%;
    height: 100%;
    object-fit: contain;
    background: black;
  }

  video::cue {
    font-size: clamp(1.1rem, 2.6vw, 2rem);
    background: rgb(0 0 0 / 60%);
  }

  .surface {
    position: absolute;
    inset: 0;
    display: grid;
    grid-template-rows: auto 1fr auto;
    opacity: 0;
    transition: opacity 200ms var(--ease);
    background: linear-gradient(
      to bottom,
      rgb(0 0 0 / 65%) 0%,
      transparent 22%,
      transparent 68%,
      rgb(0 0 0 / 75%) 100%
    );
  }

  .surface.visible {
    opacity: 1;
  }

  .surface:not(.visible) > :global(*) {
    pointer-events: none;
  }

  .top {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding: max(var(--space-4), env(safe-area-inset-top)) var(--page-pad) 0;
  }

  .titles {
    flex: 1;
    min-width: 0;
  }

  .title {
    font-weight: 700;
    font-size: var(--text-lg);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .subtitle {
    color: rgb(255 255 255 / 75%);
    font-size: var(--text-sm);
  }

  .method {
    font-size: var(--text-xs);
    padding: 4px 10px;
    border-radius: var(--radius-pill);
    background: rgb(255 255 255 / 14%);
    color: rgb(255 255 255 / 80%);
  }

  .round {
    background: rgb(0 0 0 / 40%);
    color: white;
  }

  .center {
    place-self: center;
  }

  .transport {
    display: flex;
    align-items: center;
    gap: clamp(1.5rem, 6vw, 4rem);
  }

  .big {
    width: 88px;
    height: 88px;
    padding-left: 4px;
    background: rgb(255 255 255 / 16%);
    backdrop-filter: blur(6px);
  }

  .big-side {
    width: 64px;
    height: 64px;
  }

  .spinner {
    width: 64px;
    height: 64px;
    border: 4px solid rgb(255 255 255 / 25%);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.9s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .message {
    display: grid;
    justify-items: center;
    gap: var(--space-4);
    padding: var(--space-5);
    max-width: 640px;
    text-align: center;
  }

  .ended {
    font-size: var(--text-xl);
    font-weight: 700;
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--space-3);
  }

  .bottom {
    display: grid;
    gap: var(--space-2);
    padding: 0 var(--page-pad) max(var(--space-4), env(safe-area-inset-bottom));
  }

  .next {
    justify-self: end;
  }

  .timeline {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: var(--space-4);
  }

  .time {
    font-variant-numeric: tabular-nums;
    font-size: var(--text-sm);
    min-width: 5ch;
    text-align: center;
  }

  input[type="range"] {
    --pct: 0%;
    appearance: none;
    -webkit-appearance: none;
    height: var(--touch);
    background: transparent;
    cursor: pointer;
    margin: 0;
  }

  input[type="range"]::-webkit-slider-runnable-track {
    height: 6px;
    border-radius: var(--radius-pill);
    background: linear-gradient(to right, var(--color-accent) var(--pct), rgb(255 255 255 / 30%) var(--pct));
  }

  input[type="range"]::-moz-range-track {
    height: 6px;
    border-radius: var(--radius-pill);
    background: linear-gradient(to right, var(--color-accent) var(--pct), rgb(255 255 255 / 30%) var(--pct));
  }

  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 20px;
    height: 20px;
    margin-top: -7px;
    border-radius: 50%;
    background: white;
    border: 0;
  }

  input[type="range"]::-moz-range-thumb {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: white;
    border: 0;
  }

  .seek {
    width: 100%;
  }

  .volume {
    width: 120px;
  }

  .tools {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .tools .btn {
    background: transparent;
    color: white;
  }

  .tools .btn.active {
    color: var(--color-accent);
  }

  .spacer {
    flex: 1;
  }
</style>
