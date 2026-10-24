<script lang="ts" module>
  const paths = {
    home: "M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z",
    film: "M4 4h16v16H4zM8 4v16M16 4v16M4 8h4M4 12h4M4 16h4M16 8h4M16 12h4M16 16h4",
    tv: "M3 6h18v12H3zM8 21h8M12 18v3",
    search: "M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zM15.5 15.5 20 20",
    settings:
      "M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM19.4 13.5l1.6 1.2-2 3.4-1.9-.7a7 7 0 0 1-1.7 1l-.3 2H11l-.3-2a7 7 0 0 1-1.7-1l-1.9.7-2-3.4 1.6-1.2a7 7 0 0 1 0-2L5 10.3l2-3.4 1.9.7a7 7 0 0 1 1.7-1l.3-2h4l.3 2a7 7 0 0 1 1.7 1l1.9-.7 2 3.4-1.6 1.2a7 7 0 0 1 0 2z",
    play: "M7 4.5v15l13-7.5z",
    pause: "M6 4h4v16H6zM14 4h4v16h-4z",
    more: "M12 5.5a1.5 1.5 0 1 1 0 .01M12 12a1.5 1.5 0 1 1 0 .01M12 18.5a1.5 1.5 0 1 1 0 .01",
    back: "M15 5l-7 7 7 7",
    chevronRight: "M9 5l7 7-7 7",
    minus: "M5 12h14",
    plus: "M12 5v14M5 12h14",
    close: "M6 6l12 12M18 6 6 18",
    check: "M5 12.5l4.5 4.5L19 7.5",
    eyeOff: "M3 3l18 18M10.6 6.1A10 10 0 0 1 12 6c5 0 9 6 9 6a17 17 0 0 1-2.6 3.2M6.5 7.6C4.3 9.2 3 12 3 12s4 6 9 6a9 9 0 0 0 4.3-1.1M9.9 10a3 3 0 0 0 4.1 4.1",
    eye: "M3 12s4-6 9-6 9 6 9 6-4 6-9 6-9-6-9-6zM12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z",
    replay10: "M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4M10 10v5M13 10h2v5h-2z",
    forward30: "M20 12a8 8 0 1 1-2.3-5.7M20 4v4h-4M9 10h2l-1 2a1.5 1.5 0 1 1-1 2.5M14 10h2v5h-2z",
    volume: "M4 9h4l5-4v14l-5-4H4zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12",
    mute: "M4 9h4l5-4v14l-5-4H4zM16 9l5 6M21 9l-5 6",
    fullscreen: "M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5",
    fullscreenExit: "M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5",
    subtitles: "M3 5h18v14H3zM7 12h4M13 12h4M7 15h7M16 15h1",
    audio: "M9 18V6l11-2v12M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3zM20 16a3 3 0 1 1-3-3 3 3 0 0 1 3 3z",
    next: "M5 5l10 7-10 7zM18 5v14",
    alert: "M12 3l10 18H2zM12 10v5M12 18v.01",
    wifiOff: "M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5-2.7M14.5 10.4A10 10 0 0 1 19 13M2 9.5a15 15 0 0 1 4.4-2.8M11 6a15 15 0 0 1 11 3.5M12 20v.01",
    logout: "M10 4H5v16h5M15 8l4 4-4 4M19 12H9",
  } as const;

  export type IconName = keyof typeof paths;
</script>

<script lang="ts">
  let { name, size = 24, label }: { name: IconName; size?: number; label?: string } = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  role={label ? "img" : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : "true"}
>
  <path
    d={paths[name]}
    fill={name === "play" || name === "pause" || name === "next" ? "currentColor" : "none"}
  />
</svg>

<style>
  svg {
    flex: none;
  }
</style>
