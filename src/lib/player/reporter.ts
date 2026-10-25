import type { PlaybackProgressInfo } from "@jellyfin/sdk/lib/generated-client/models";
import { getSessionApi } from "@jellyfin/sdk/lib/utils/api";
import { secondsToTicks } from "../format";
import { session } from "../jellyfin/session.svelte";
import { userDataVersion } from "../jellyfin/userdata.svelte";
import type { Playback } from "./playback";

export interface PlayerState {
  position: number;
  paused: boolean;
  muted: boolean;
  volume: number;
  /** Aktuell gewählte Spuren (können sich ohne neue PlaySessionId ändern). */
  audioStreamIndex?: number;
  subtitleStreamIndex: number;
}

const PROGRESS_INTERVAL_MS = 10_000;

/**
 * Meldet Start, Fortschritt und Ende einer Wiedergabesitzung an Jellyfin (NU-08).
 * Pro `Playback` (PlaySessionId) genau ein Start und ein Stopp.
 */
export class PlaybackReporter {
  #started = false;
  #stopped = false;
  #timer: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly playback: Playback,
    private readonly state: () => PlayerState,
  ) {}

  #info(): PlaybackProgressInfo {
    const s = this.state();
    return {
      ItemId: this.playback.item.Id ?? undefined,
      MediaSourceId: this.playback.source.Id,
      PlaySessionId: this.playback.playSessionId,
      LiveStreamId: this.playback.source.LiveStreamId,
      PlayMethod: this.playback.method,
      AudioStreamIndex: s.audioStreamIndex,
      SubtitleStreamIndex: s.subtitleStreamIndex,
      PositionTicks: secondsToTicks(s.position),
      IsPaused: s.paused,
      IsMuted: s.muted,
      VolumeLevel: Math.round(s.volume * 100),
      CanSeek: true,
    };
  }

  start(): void {
    if (this.#started || this.#stopped) return;
    this.#started = true;
    getSessionApi(session.api)
      .reportPlaybackStart({ playbackStartInfo: this.#info() })
      .catch(() => undefined);
    this.#timer = setInterval(() => this.progress(), PROGRESS_INTERVAL_MS);
  }

  /** Fortschritt; `event` z. B. "pause", "unpause", "timeupdate" (Seek). */
  progress(event?: string): void {
    if (!this.#started || this.#stopped) return;
    getSessionApi(session.api)
      .reportPlaybackProgress({
        playbackProgressInfo: { ...this.#info(), ...(event ? { EventName: event } : {}) },
      })
      .catch(() => undefined);
  }

  /**
   * Stopp per `fetch(keepalive)`, damit die Meldung auch beim Schließen des
   * Tabs oder Verlassen der PWA zuverlässig beim Server ankommt.
   */
  stop(): void {
    if (!this.#started || this.#stopped) return;
    this.#stopped = true;
    clearInterval(this.#timer);
    // Fortschritt/„gesehen“ ändern sich serverseitig – gecachte Listen neu laden.
    userDataVersion.bump();
    const api = session.api;
    const { ItemId, MediaSourceId, PlaySessionId, PositionTicks, LiveStreamId } = this.#info();
    void fetch(`${api.basePath}/Sessions/Playing/Stopped`, {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json", Authorization: api.authorizationHeader },
      body: JSON.stringify({ ItemId, MediaSourceId, PlaySessionId, PositionTicks, LiveStreamId }),
    }).catch(() => undefined);
  }
}
