import type {
  DeviceProfile,
  DirectPlayProfile,
  SubtitleProfile,
  TranscodingProfile,
} from "@jellyfin/sdk/lib/generated-client/models";

/**
 * Beschreibt Jellyfin, was dieser Browser selbst abspielen kann. Grundlage sind
 * ausschließlich `canPlayType`/`MediaSource.isTypeSupported`; der Server entscheidet
 * daraus Direct Play bzw. Transcoding. (Das SDK liefert hierfür nur Untertitelprofile.)
 */

type Probe = (type: string) => boolean;

function createProbe(video: HTMLVideoElement): Probe {
  return (type) =>
    video.canPlayType(type).replace("no", "") !== "" ||
    (typeof MediaSource !== "undefined" && MediaSource.isTypeSupported(type));
}

const VIDEO_CODECS: [codec: string, mime: string][] = [
  ["h264", 'video/mp4; codecs="avc1.640029"'],
  ["hevc", 'video/mp4; codecs="hvc1.1.6.L120.90"'],
  ["av1", 'video/mp4; codecs="av01.0.08M.08"'],
  ["vp9", 'video/mp4; codecs="vp09.00.10.08"'],
];

const AUDIO_CODECS: [codec: string, mime: string][] = [
  ["aac", 'audio/mp4; codecs="mp4a.40.2"'],
  ["mp3", "audio/mpeg"],
  ["ac3", 'audio/mp4; codecs="ac-3"'],
  ["eac3", 'audio/mp4; codecs="ec-3"'],
  ["opus", 'audio/mp4; codecs="opus"'],
  ["flac", 'audio/mp4; codecs="flac"'],
  ["alac", 'audio/mp4; codecs="alac"'],
];

export function buildDeviceProfile(
  video: HTMLVideoElement = document.createElement("video"),
): DeviceProfile {
  const can = createProbe(video);
  const videoCodecs = VIDEO_CODECS.filter(([, mime]) => can(mime)).map(([c]) => c);
  const audioCodecs = AUDIO_CODECS.filter(([, mime]) => can(mime)).map(([c]) => c);
  const mkv =
    can("video/x-matroska") || can("video/mkv") || can('video/x-matroska; codecs="avc1.640029"');
  const webmVideo = ["vp8", "vp9", "av1"].filter((c) =>
    can(`video/webm; codecs="${c === "av1" ? "av01.0.08M.08" : c}"`),
  );
  const webmAudio = ["opus", "vorbis"].filter((c) => can(`audio/webm; codecs="${c}"`));
  const nativeHls = can("application/vnd.apple.mpegurl");
  const mse = typeof MediaSource !== "undefined";

  const directPlay: DirectPlayProfile[] = [];
  if (videoCodecs.length) {
    directPlay.push({
      Container: "mp4,m4v,mov",
      Type: "Video",
      VideoCodec: videoCodecs.join(","),
      AudioCodec: audioCodecs.join(","),
    });
  }
  if (mkv && videoCodecs.length) {
    directPlay.push({
      Container: "mkv",
      Type: "Video",
      VideoCodec: videoCodecs.join(","),
      AudioCodec: audioCodecs.join(","),
    });
  }
  if (webmVideo.length) {
    directPlay.push({
      Container: "webm",
      Type: "Video",
      VideoCodec: webmVideo.join(","),
      AudioCodec: webmAudio.join(","),
    });
  }

  // HLS-Transcoding: Safari/iPadOS nativ, sonst über hls.js (MSE). H.264 + AAC ist überall abspielbar;
  // HEVC wird nur angeboten, wenn der Browser es im fMP4-Container beherrscht.
  const hlsVideo = ["h264", ...(videoCodecs.includes("hevc") ? ["hevc"] : [])];
  const hlsAudio = [
    "aac",
    ...(audioCodecs.includes("ac3") ? ["ac3"] : []),
    ...(audioCodecs.includes("eac3") ? ["eac3"] : []),
  ];
  const transcoding: TranscodingProfile[] =
    nativeHls || mse
      ? [
          {
            Container: "mp4",
            Type: "Video",
            Protocol: "hls",
            Context: "Streaming",
            VideoCodec: hlsVideo.join(","),
            AudioCodec: hlsAudio.join(","),
            MaxAudioChannels: "6",
            MinSegments: 1,
            BreakOnNonKeyFrames: true,
          },
        ]
      : [
          {
            Container: "mp4",
            Type: "Video",
            Protocol: "http",
            Context: "Streaming",
            VideoCodec: "h264",
            AudioCodec: "aac",
            MaxAudioChannels: "2",
          },
        ];

  // Textuntertitel liefert der Server als WebVTT aus; ASS/SSA und Bilduntertitel werden eingebrannt.
  const subtitles: SubtitleProfile[] = [
    { Format: "vtt", Method: "External" },
    { Format: "ass", Method: "Encode" },
    { Format: "ssa", Method: "Encode" },
  ];

  return {
    Name: "Jailfin Browser",
    MaxStreamingBitrate: 120_000_000,
    MaxStaticBitrate: 120_000_000,
    MusicStreamingTranscodingBitrate: 384_000,
    DirectPlayProfiles: directPlay,
    TranscodingProfiles: transcoding,
    ContainerProfiles: [],
    CodecProfiles: [],
    SubtitleProfiles: subtitles,
  };
}
