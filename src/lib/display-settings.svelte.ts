import { readCustomPrefs, updateCustomPrefs } from "./jellyfin/user-prefs";

/**
 * Anzeigeoptionen der Übersichten. Lokal (sofort verfügbar) und in den Jellyfin-
 * Benutzereinstellungen gespeichert, damit sie auf allen Geräten gleich sind.
 */
export type PosterRating = "off" | "community" | "critic";

export interface DisplaySettingsValue {
  /** Bewertung unten rechts auf Postern: Community (IMDb bzw. TMDb), Kritiker (Rotten Tomatoes) oder aus */
  posterRating: PosterRating;
}

export const DEFAULT_DISPLAY_SETTINGS: DisplaySettingsValue = { posterRating: "community" };

const STORAGE_KEY = "jailfin.display.v1";
const SERVER_KEY = "display";
const RATINGS: PosterRating[] = ["off", "community", "critic"];

function sanitize(value: Partial<DisplaySettingsValue>): DisplaySettingsValue {
  return {
    posterRating: RATINGS.includes(value.posterRating as PosterRating)
      ? (value.posterRating as PosterRating)
      : DEFAULT_DISPLAY_SETTINGS.posterRating,
  };
}

function parse(raw: string | null | undefined): DisplaySettingsValue {
  try {
    return sanitize(JSON.parse(raw ?? "{}") as Partial<DisplaySettingsValue>);
  } catch {
    return { ...DEFAULT_DISPLAY_SETTINGS };
  }
}

class DisplaySettings {
  value = $state<DisplaySettingsValue>(parse(localStorage.getItem(STORAGE_KEY)));
  #saveTimer: ReturnType<typeof setTimeout> | undefined;

  update(patch: Partial<DisplaySettingsValue>): void {
    this.value = sanitize({ ...this.value, ...patch });
    this.#saveLocal();
    clearTimeout(this.#saveTimer);
    this.#saveTimer = setTimeout(() => {
      void updateCustomPrefs(() => ({ [SERVER_KEY]: JSON.stringify(this.value) })).catch(
        () => undefined,
      );
    }, 500);
  }

  /** Nach dem Login: Stand vom Server übernehmen (falls vorhanden). */
  async syncFromServer(): Promise<void> {
    try {
      const raw = (await readCustomPrefs())[SERVER_KEY];
      if (!raw) return;
      this.value = parse(raw);
      this.#saveLocal();
    } catch {
      // Offline o. Ä.: lokale Einstellungen gelten weiter.
    }
  }

  #saveLocal(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.value));
    } catch {
      // nur für diese Sitzung
    }
  }
}

export const displaySettings = new DisplaySettings();
