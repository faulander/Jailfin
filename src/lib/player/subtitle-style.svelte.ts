import { readCustomPrefs, updateCustomPrefs } from "../jellyfin/user-prefs";

/** Darstellung von Textuntertiteln; pro Gerät gespeichert (localStorage). */
export interface SubtitleStyle {
  size: "s" | "m" | "l" | "xl" | "xxl" | "xxxl";
  /** Abstand vom unteren Bildrand in Prozent der Videohöhe */
  position: number;
  /** Maximale Zeilenbreite in Prozent der Bildbreite; längerer Text wird umbrochen */
  width: number;
  background: "none" | "shadow" | "box" | "solid";
  color: "white" | "yellow" | "cyan";
  weight: "normal" | "bold";
}

export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  size: "m",
  position: 8,
  width: 88,
  background: "shadow",
  color: "white",
  weight: "normal",
};

export const POSITION_MIN = 2;
export const POSITION_MAX = 45;
export const WIDTH_MIN = 30;
export const WIDTH_MAX = 100;
export const WIDTH_STEP = 5;

const STORAGE_KEY = "jailfin.subtitleStyle.v1";

/**
 * Schriftgröße relativ zur Höhe des Videobereichs (Container-Query-Einheit). Die Obergrenzen
 * liegen bewusst hoch, damit die Stufen auch auf großen Displays sichtbar wachsen.
 */
export const FONT_SIZE: Record<SubtitleStyle["size"], string> = {
  s: "clamp(0.9rem, 3.6cqh, 2.3rem)",
  m: "clamp(1.05rem, 4.6cqh, 2.9rem)",
  l: "clamp(1.25rem, 5.8cqh, 3.6rem)",
  xl: "clamp(1.5rem, 7.2cqh, 4.6rem)",
  xxl: "clamp(1.8rem, 9cqh, 6rem)",
  xxxl: "clamp(2.1rem, 11.5cqh, 8rem)",
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
  const clampInt = (raw: unknown, min: number, max: number, fallback: number) => {
    const n = Number(raw);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
  };
  return {
    size: pick("size", ["s", "m", "l", "xl", "xxl", "xxxl"]),
    background: pick("background", ["none", "shadow", "box", "solid"]),
    color: pick("color", ["white", "yellow", "cyan"]),
    weight: pick("weight", ["normal", "bold"]),
    position: clampInt(value.position, POSITION_MIN, POSITION_MAX, d.position),
    width: clampInt(value.width, WIDTH_MIN, WIDTH_MAX, d.width),
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

const OFFSETS_STORAGE_KEY = "jailfin.subtitleOffsets.v1";
const SERVER_STYLE_KEY = "subtitleStyle";
const SERVER_OFFSETS_KEY = "subtitleOffsets";
/** Begrenzung der gemerkten Versätze (älteste fallen heraus). */
const MAX_OFFSETS = 300;

function parseOffsets(raw: string | null | undefined): Record<string, number> {
  try {
    const value = JSON.parse(raw ?? "{}") as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(value).filter(
        (entry): entry is [string, number] =>
          typeof entry[1] === "number" && Number.isFinite(entry[1]),
      ),
    );
  } catch {
    return {};
  }
}

/**
 * Untertitel-Darstellung und gemerkte Versätze. Lokal (sofort verfügbar) und zusätzlich in den
 * Jellyfin-Benutzereinstellungen, damit sie auf allen Geräten und Adressen gleich sind.
 */
class SubtitleSettings {
  style = $state<SubtitleStyle>(load());
  #offsets: Record<string, number> = parseOffsets(localStorage.getItem(OFFSETS_STORAGE_KEY));
  #saveTimer: ReturnType<typeof setTimeout> | undefined;

  update(patch: Partial<SubtitleStyle>): void {
    this.style = sanitize({ ...this.style, ...patch });
    this.#saveLocal();
    this.#scheduleServerSave();
  }

  reset(): void {
    this.update(DEFAULT_SUBTITLE_STYLE);
  }

  /**
   * Gemerkter Versatz für eine Serie (alle Folgen) bzw. einen Film. Folgen einer Serie stammen
   * meist aus derselben Quelle und haben denselben Versatz.
   */
  offsetFor(key: string | null | undefined): number {
    return key ? (this.#offsets[key] ?? 0) : 0;
  }

  setOffset(key: string | null | undefined, seconds: number): void {
    if (!key || this.offsetFor(key) === seconds) return;
    delete this.#offsets[key];
    if (seconds !== 0) this.#offsets[key] = seconds;
    const keys = Object.keys(this.#offsets);
    for (const old of keys.slice(0, Math.max(0, keys.length - MAX_OFFSETS)))
      delete this.#offsets[old];
    this.#saveLocal();
    this.#scheduleServerSave();
  }

  /** Nach dem Login: Stand vom Server übernehmen; gibt es dort noch nichts, den lokalen hochladen. */
  async syncFromServer(): Promise<void> {
    try {
      const prefs = await readCustomPrefs();
      const serverStyle = prefs[SERVER_STYLE_KEY];
      if (serverStyle) {
        this.style = sanitize(JSON.parse(serverStyle) as Partial<SubtitleStyle>);
        this.#offsets = { ...this.#offsets, ...parseOffsets(prefs[SERVER_OFFSETS_KEY]) };
        this.#saveLocal();
      } else {
        this.#scheduleServerSave(0);
      }
    } catch {
      // Offline o. Ä.: lokale Einstellungen gelten weiter.
    }
  }

  #saveLocal(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.style));
      localStorage.setItem(OFFSETS_STORAGE_KEY, JSON.stringify(this.#offsets));
    } catch {
      // Darstellung gilt dann nur für diese Sitzung.
    }
  }

  #scheduleServerSave(delay = 800): void {
    clearTimeout(this.#saveTimer);
    this.#saveTimer = setTimeout(() => {
      void updateCustomPrefs(() => ({
        [SERVER_STYLE_KEY]: JSON.stringify(this.style),
        [SERVER_OFFSETS_KEY]: JSON.stringify(this.#offsets),
      })).catch(() => undefined);
    }, delay);
  }
}

export const subtitleSettings = new SubtitleSettings();
