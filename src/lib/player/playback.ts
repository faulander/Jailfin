import type {
  BaseItemDto,
  DeviceProfile,
  MediaSourceInfo,
  MediaStream,
  PlayMethod,
} from "@jellyfin/sdk/lib/generated-client/models";
import { getMediaInfoApi } from "@jellyfin/sdk/lib/utils/api";
import { buildDeviceProfile } from "./device-profile";
import { m } from "../i18n";
import { getDeviceId } from "../jellyfin/client";
import { AppError } from "../jellyfin/errors";
import { session } from "../jellyfin/session.svelte";

export interface PlaybackRequest {
  audioStreamIndex?: number;
  subtitleStreamIndex?: number;
  /** Direct Play verbieten (Fallback bei Abspielfehlern oder für Spurwechsel). */
  disableDirectPlay?: boolean;
  mediaSourceId?: string;
}

export interface Playback {
  item: BaseItemDto;
  source: MediaSourceInfo;
  playSessionId: string;
  url: string;
  method: PlayMethod;
  isHls: boolean;
  audioStreamIndex?: number;
  subtitleStreamIndex?: number;
}

let profile: DeviceProfile | undefined;

/** Geräteprofil aus den tatsächlichen Codec-Fähigkeiten dieses Browsers (einmal pro Sitzung). */
function deviceProfile(): DeviceProfile {
  profile ??= buildDeviceProfile();
  return profile;
}

const failureReasons: Record<string, string> = {
  NotAllowed: m.errors.forbidden,
  NoCompatibleStream: m.player.noSource,
  RateLimitExceeded: m.errors.server(429),
};

/**
 * Handelt die Wiedergabe mit Jellyfin aus (PlaybackInfo). Reihenfolge wie in den
 * offiziellen Web-Clients: Direct Play → Direct Stream → serverseitiges Transcoding.
 */
export async function requestPlayback(
  item: BaseItemDto,
  request: PlaybackRequest = {},
): Promise<Playback> {
  const api = session.api;
  if (!item.Id) throw new AppError(m.errors.notFound, 404);
  const { data } = await getMediaInfoApi(api).getPostedPlaybackInfo({
    itemId: item.Id,
    playbackInfoDto: {
      UserId: session.userId,
      DeviceProfile: deviceProfile(),
      MaxStreamingBitrate: 120_000_000,
      MediaSourceId: request.mediaSourceId,
      AudioStreamIndex: request.audioStreamIndex,
      SubtitleStreamIndex: request.subtitleStreamIndex,
      EnableDirectPlay: !request.disableDirectPlay,
      EnableDirectStream: true,
      EnableTranscoding: true,
      AllowVideoStreamCopy: true,
      AllowAudioStreamCopy: true,
      AutoOpenLiveStream: true,
    },
  });

  if (data.ErrorCode) throw new AppError(failureReasons[data.ErrorCode] ?? m.player.noSource);
  const source =
    data.MediaSources?.find((s) => s.Id === request.mediaSourceId) ?? data.MediaSources?.[0];
  if (!source?.Id || !data.PlaySessionId) throw new AppError(m.player.noSource);

  const base = api.basePath;
  const common = {
    mediaSourceId: source.Id,
    deviceId: getDeviceId(),
    PlaySessionId: data.PlaySessionId,
    // <video> kann keine Header senden; Jellyfin akzeptiert das Token als Parameter.
    api_key: api.accessToken,
  };

  let url: string;
  let method: PlayMethod;
  if (source.SupportsDirectPlay && !request.disableDirectPlay) {
    method = "DirectPlay";
    url = `${base}/Videos/${item.Id}/stream.${source.Container ?? "mp4"}?${new URLSearchParams({
      Static: "true",
      ...common,
      ...(source.ETag ? { Tag: source.ETag } : {}),
    })}`;
  } else if (source.SupportsTranscoding && source.TranscodingUrl) {
    // Enthält auch reine Remux-Fälle (Container-Wechsel, Codec-Kopie); der Server entscheidet.
    method = "Transcode";
    url = `${base}${source.TranscodingUrl}`;
  } else if (source.SupportsDirectStream) {
    method = "DirectStream";
    url = `${base}/Videos/${item.Id}/stream.${source.Container ?? "mp4"}?${new URLSearchParams({
      Static: "true",
      ...common,
    })}`;
  } else {
    throw new AppError(m.player.noSource);
  }

  return {
    item,
    source,
    playSessionId: data.PlaySessionId,
    url,
    method,
    isHls:
      method === "Transcode" && (source.TranscodingSubProtocol === "hls" || url.includes(".m3u8")),
    audioStreamIndex: request.audioStreamIndex ?? source.DefaultAudioStreamIndex ?? undefined,
    subtitleStreamIndex:
      request.subtitleStreamIndex ?? source.DefaultSubtitleStreamIndex ?? undefined,
  };
}

export const audioStreams = (source: MediaSourceInfo): MediaStream[] =>
  source.MediaStreams?.filter((s) => s.Type === "Audio") ?? [];

export const subtitleStreams = (source: MediaSourceInfo): MediaStream[] =>
  source.MediaStreams?.filter((s) => s.Type === "Subtitle") ?? [];

export function trackLabel(stream: MediaStream, fallbackIndex: number): string {
  const base =
    stream.DisplayTitle ?? stream.Title ?? stream.Language ?? m.player.unknownTrack(fallbackIndex);
  const flags = [stream.IsForced ? m.player.forced : undefined].filter(Boolean);
  return flags.length ? `${base} (${flags.join(", ")})` : base;
}

/**
 * Textuntertitel, die der Browser selbst darstellen kann (WebVTT über DeliveryUrl).
 * Alles andere (Bild-Untertitel, eingebettete Spuren) muss der Server einbrennen.
 */
export const isClientRenderable = (stream: MediaStream): boolean =>
  stream.DeliveryMethod === "External" && !!stream.DeliveryUrl;

/** Lädt einen externen Untertitel authentifiziert und liefert eine Blob-URL für `<track>`. */
export async function fetchSubtitle(stream: MediaStream): Promise<string> {
  const api = session.api;
  const path = stream.DeliveryUrl ?? "";
  const url = /^https?:/i.test(path) ? path : `${api.basePath}${path}`;
  const res = await fetch(url, { headers: { Authorization: api.authorizationHeader } });
  if (!res.ok) throw new AppError(m.errors.server(res.status), res.status);
  const text = await res.text();
  return URL.createObjectURL(new Blob([text], { type: "text/vtt" }));
}
