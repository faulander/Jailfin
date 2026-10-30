import { session } from "../jellyfin/session.svelte";
import { AppError } from "../jellyfin/errors";
import { formatServerDate, parseRows, type PlayRecord } from "./aggregate";

/**
 * Zugriff auf das Jellyfin-Plugin „Playback Reporting“ (zeichnet jede Wiedergabe auf).
 * Die Plugin-API ist nur für Administratoren freigegeben. Gelesen wird über die
 * Custom-Query-Schnittstelle des Plugins – ausschließlich mit SELECT.
 */

export type PluginState = "available" | "missing" | "forbidden";

interface QueryResponse {
  colums?: string[];
  results?: string[][];
  message?: string;
}

class PluginHttpError extends Error {
  constructor(readonly status: number) {
    super(`Playback Reporting: HTTP ${status}`);
  }
}

async function query(
  sql: string,
  signal?: AbortSignal,
): Promise<{ columns: string[]; rows: string[][] }> {
  const api = session.api;
  const response = await fetch(`${api.basePath}/user_usage_stats/submit_custom_query`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: api.authorizationHeader },
    body: JSON.stringify({ CustomQueryString: sql, ReplaceUserId: false }),
    signal,
  });
  if (!response.ok) throw new PluginHttpError(response.status);
  const data = (await response.json()) as QueryResponse;
  // Fehler im SQL meldet das Plugin mit HTTP 200 und einer Nachricht.
  if (data.message?.startsWith("Error"))
    throw new AppError(data.message.replace(/<[^>]+>.*$/s, ""));
  return { columns: data.colums ?? [], rows: data.results ?? [] };
}

/** Versatz der Serverzeit zu UTC (Sekunden); das Plugin speichert lokale Serverzeit. */
async function serverOffset(signal?: AbortSignal): Promise<number> {
  const { rows } = await query(
    "SELECT CAST(strftime('%s','now','localtime') AS INTEGER) - CAST(strftime('%s','now') AS INTEGER)",
    signal,
  );
  return Number(rows[0]?.[0]) || 0;
}

let offsetCache: { basePath: string; offset: number } | undefined;

/** Ist das Plugin installiert und darf der Benutzer es lesen? */
export async function pluginState(signal?: AbortSignal): Promise<PluginState> {
  try {
    const offset = await serverOffset(signal);
    offsetCache = { basePath: session.api.basePath, offset };
    return "available";
  } catch (error) {
    if (error instanceof PluginHttpError) {
      if (error.status === 401 || error.status === 403) return "forbidden";
      if (error.status === 404) return "missing";
    }
    throw error;
  }
}

const ID = /^[0-9a-f]{32}$/i;

/** Wiedergaben ab `from` (Epoch-ms), optional nur eines Benutzers. */
export async function loadPlays(
  options: { from?: number; userId?: string },
  signal?: AbortSignal,
): Promise<PlayRecord[]> {
  const basePath = session.api.basePath;
  const offset =
    offsetCache?.basePath === basePath ? offsetCache.offset : await serverOffset(signal);
  offsetCache = { basePath, offset };
  const where: string[] = [];
  if (options.from !== undefined)
    where.push(`DateCreated >= '${formatServerDate(options.from, offset)}'`);
  if (options.userId) {
    if (!ID.test(options.userId)) throw new AppError("Ungültige Benutzer-ID");
    where.push(`UserId = '${options.userId.toLowerCase()}'`);
  }
  const sql =
    "SELECT DateCreated, UserId, ItemId, ItemType, ItemName, PlaybackMethod, ClientName, DeviceName, PlayDuration " +
    "FROM PlaybackActivity" +
    (where.length ? ` WHERE ${where.join(" AND ")}` : "") +
    " ORDER BY DateCreated DESC";
  const { columns, rows } = await query(sql, signal);
  return parseRows(columns, rows, offset);
}
