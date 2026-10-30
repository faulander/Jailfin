<script lang="ts">
  import type { SessionInfoDto } from "@jellyfin/sdk/lib/generated-client/models";
  import Img from "../Img.svelte";
  import ProgressBar from "../ProgressBar.svelte";
  import { episodeCode } from "../../lib/format";
  import { m } from "../../lib/i18n";
  import { posterUrl } from "../../lib/jellyfin/images";

  /** Laufende Wiedergaben aller Benutzer (Administratoren). */
  let { sessions }: { sessions: SessionInfoDto[] } = $props();

  const clock = (ticks: number) => {
    const total = Math.floor(ticks / 10_000_000);
    const h = Math.floor(total / 3600);
    const mm = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
    const ss = String(total % 60).padStart(2, "0");
    return h ? `${h}:${mm}:${ss}` : `${Math.floor(total / 60)}:${ss}`;
  };

  function method(s: SessionInfoDto) {
    const play = s.PlayState?.PlayMethod;
    if (play === "Transcode") {
      const info = s.TranscodingInfo;
      const parts = [
        info?.IsVideoDirect ? undefined : info?.VideoCodec?.toUpperCase(),
        info?.IsAudioDirect ? undefined : info?.AudioCodec?.toUpperCase(),
      ].filter(Boolean);
      return `${m.stats.methods.transcode}${parts.length ? ` (${parts.join(", ")})` : ""}`;
    }
    return play === "DirectStream" ? m.stats.methods.stream : m.stats.methods.direct;
  }
</script>

<ul class="sessions">
  {#each sessions as s (s.Id)}
    {@const item = s.NowPlayingItem!}
    {@const position = s.PlayState?.PositionTicks ?? 0}
    {@const runtime = item.RunTimeTicks ?? 0}
    <li class="session">
      <span class="thumb"><Img src={posterUrl(item, 120)} ratio="2 / 3" fallback={item.Name ?? ""} /></span>
      <span class="info">
        <a class="title" href={`/item/${encodeURIComponent(item.SeriesId ?? item.Id ?? "")}`}>
          {item.SeriesName ?? item.Name}
        </a>
        {#if item.SeriesName}
          <span class="muted small">{episodeCode(item) ?? ""} · {item.Name}</span>
        {/if}
        <span class="small">
          <strong>{s.UserName}</strong>
          <span class="muted">· {s.Client} · {s.DeviceName}</span>
        </span>
        <span class="small" class:transcode={s.PlayState?.PlayMethod === "Transcode"}>
          {s.PlayState?.IsPaused ? m.stats.paused : m.stats.playing} · {method(s)}
        </span>
        {#if runtime > 0}
          <span class="progress">
            <ProgressBar value={(position / runtime) * 100} />
            <span class="muted small time">{clock(position)} / {clock(runtime)}</span>
          </span>
        {/if}
      </span>
    </li>
  {/each}
</ul>

<style>
  .sessions {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
    gap: var(--space-4);
  }

  .session {
    display: grid;
    grid-template-columns: 64px 1fr;
    gap: var(--space-3);
    padding: var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface-2);
  }

  .thumb {
    border-radius: 4px;
    overflow: hidden;
  }

  .info {
    display: grid;
    gap: 4px;
    min-width: 0;
    align-content: start;
  }

  .title {
    font-weight: 700;
    color: inherit;
    text-decoration: none;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .small {
    font-size: var(--text-sm);
  }

  .transcode {
    color: #ffb74d;
  }

  .progress {
    display: grid;
    gap: 2px;
    margin-top: var(--space-1);
  }

  .time {
    font-variant-numeric: tabular-nums;
  }
</style>
