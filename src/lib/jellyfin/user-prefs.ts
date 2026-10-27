import type { DisplayPreferencesDto } from "@jellyfin/sdk/lib/generated-client/models";
import { getDisplayPreferenceApi } from "@jellyfin/sdk/lib/utils/api";
import { session } from "./session.svelte";

/**
 * Serverseitige Einstellungen pro Benutzer in den Jellyfin-Anzeigeeinstellungen
 * (DisplayPreferences „jailfin“, Client „jailfin“). Gleich auf allen Geräten und
 * Browsern (auch http-LAN-Adresse vs. https-Domain, Browser vs. installierte App).
 */
const PREFS_ID = "jailfin";
const CLIENT = "jailfin";

export type CustomPrefs = Record<string, string | null | undefined>;

async function read(): Promise<DisplayPreferencesDto> {
  const { data } = await getDisplayPreferenceApi(session.api).getDisplayPreferences({
    displayPreferencesId: PREFS_ID,
    client: CLIENT,
    userId: session.userId,
  });
  return data;
}

export async function readCustomPrefs(): Promise<CustomPrefs> {
  return (await read()).CustomPrefs ?? {};
}

/** Schreibvorgänge nacheinander, damit sich Änderungen nicht gegenseitig überschreiben. */
let queue: Promise<unknown> = Promise.resolve();

/**
 * Lesen–ändern–schreiben einzelner Schlüssel. Der Rest der Einstellungen (auch Änderungen
 * anderer Geräte) bleibt erhalten. Liefert die vom Server gelesenen Werte nach der Änderung.
 */
export function updateCustomPrefs(
  change: (current: CustomPrefs) => Record<string, string>,
): Promise<CustomPrefs> {
  const run = queue.then(async () => {
    const prefs = await read();
    const current = prefs.CustomPrefs ?? {};
    const next = { ...current, ...change(current) };
    await getDisplayPreferenceApi(session.api).updateDisplayPreferences({
      displayPreferencesId: PREFS_ID,
      client: CLIENT,
      userId: session.userId,
      displayPreferencesDto: { ...prefs, CustomPrefs: next },
    });
    return next;
  });
  queue = run.catch(() => undefined);
  return run;
}
