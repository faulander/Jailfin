/**
 * Wahl der Server-Adresse: die lokale (LAN-)Adresse, wenn sie erreichbar ist und zum
 * selben Jellyfin-Server gehört, sonst die öffentliche. So laufen Streams zu Hause direkt
 * im Netz statt über Tunnel/Proxy.
 */

export type ConnectionMode = "local" | "public";

export interface ConnectionChoice {
  url: string;
  mode: ConnectionMode;
  /** Grund, warum die lokale Adresse nicht genutzt wird (nur zur Anzeige) */
  reason?: "none" | "mixedContent" | "unreachable" | "otherServer";
}

/** Liefert die Server-ID unter `url` oder wirft (Timeout, Netzfehler, kein Jellyfin). */
export type ServerIdProbe = (url: string) => Promise<string | undefined>;

export async function chooseServerUrl(options: {
  publicUrl: string;
  localUrl?: string;
  serverId: string;
  pageProtocol: string;
  probe: ServerIdProbe;
}): Promise<ConnectionChoice> {
  const { publicUrl, localUrl, serverId, pageProtocol, probe } = options;
  if (!localUrl) return { url: publicUrl, mode: "public", reason: "none" };
  // Browser blockieren HTTP-Anfragen aus HTTPS-Seiten (Mixed Content) – gar nicht erst versuchen.
  if (pageProtocol === "https:" && /^http:/i.test(localUrl)) {
    return { url: publicUrl, mode: "public", reason: "mixedContent" };
  }
  try {
    const id = await probe(localUrl);
    if (id && id === serverId) return { url: localUrl, mode: "local" };
    return { url: publicUrl, mode: "public", reason: "otherServer" };
  } catch {
    return { url: publicUrl, mode: "public", reason: "unreachable" };
  }
}

/** Kurzer Erreichbarkeitstest über den öffentlichen Info-Endpunkt (ohne Anmeldung). */
export const probeServerId: ServerIdProbe = async (url) => {
  const res = await fetch(`${url}/System/Info/Public`, {
    cache: "no-store",
    signal: AbortSignal.timeout(1500),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const info = (await res.json()) as { Id?: string };
  return info.Id;
};

/** "192.168.1.5:8096" → "http://192.168.1.5:8096"; abschließende Slashes entfernen. */
export function normalizeServerUrl(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}
