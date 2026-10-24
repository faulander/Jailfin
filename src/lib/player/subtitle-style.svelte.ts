/** Darstellung von Textuntertiteln; pro Gerät gespeichert (localStorage). */
export interface SubtitleStyle {
  size: "s" | "m" | "l" | "xl";
  /** Abstand vom unteren Bildrand in Prozent der Videohöhe */
  position: number;
  background: "none" | "shadow" | "box" | "solid";
  color: "white" | "yellow" | "cyan";
  weight: "normal" | "bold";
}

export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  size: "m",
  position: 8,
  background: "shadow",
  color: "white",
  weight: "normal",
};

export const POSITION_MIN = 2;
export const POSITION_MAX = 45;

const STORAGE_KEY = "jailfin.subtitleStyle.v1";

/** Schriftgröße relativ zur Höhe des Videobereichs (Container-Query-Einheit). */
export const FONT_SIZE: Record<SubtitleStyle["size"], string> = {
  s: "clamp(0.9rem, 3.6cqh, 1.6rem)",
  m: "clamp(1.05rem, 4.6cqh, 2.1rem)",
  l: "clamp(1.25rem, 5.8cqh, 2.7rem)",
  xl: "clamp(1.5rem, 7.2cqh, 3.4rem)",
};

export const TEXT_COLOR: Record<SubtitleStyle["color"], string> = {
  white: "#ffffff",
  yellow: "#ffe14d",
  cyan: "#7ff3ff",
};

function sanitize(value: Partial<SubtitleStyle>): SubtitleStyle {
  const d = DEFAULT_SUBTITLE_STYLE;
  const pick = <K extends keyof SubtitleStyle>(key: K, allowed: readonly SubtitleStyle[K][]) =>
    allowed.includes(value[key] as SubtitleStyle[K]) ? (value[key] as SubtitleStyle[K]) : d[key];
  const position = Number(value.position);
  return {
    size: pick("size", ["s", "m", "l", "xl"]),
    background: pick("background", ["none", "shadow", "box", "solid"]),
    color: pick("color", ["white", "yellow", "cyan"]),
    weight: pick("weight", ["normal", "bold"]),
    position: Number.isFinite(position)
      ? Math.min(POSITION_MAX, Math.max(POSITION_MIN, Math.round(position)))
      : d.position,
  };
}

function load(): SubtitleStyle {
  try {
    return sanitize(
      JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<SubtitleStyle>,
    );
  } catch {
    return { ...DEFAULT_SUBTITLE_STYLE };
  }
}

class SubtitleSettings {
  style = $state<SubtitleStyle>(load());

  update(patch: Partial<SubtitleStyle>): void {
    this.style = sanitize({ ...this.style, ...patch });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.style));
    } catch {
      // Darstellung gilt dann nur für diese Sitzung.
    }
  }

  reset(): void {
    this.update(DEFAULT_SUBTITLE_STYLE);
  }
}

export const subtitleSettings = new SubtitleSettings();
