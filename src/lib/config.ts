/**
 * Laufzeitkonfiguration aus `/config.json`. Im Docker-Image wird die Datei beim
 * Containerstart aus Umgebungsvariablen erzeugt; sie enthält niemals Geheimnisse.
 */
export interface RuntimeConfig {
  /** Vorbelegung des Server-Felds im Login, z. B. "https://jellyfin.example.de". */
  defaultServerUrl?: string;
}

let cached: Promise<RuntimeConfig> | undefined;

export function loadRuntimeConfig(): Promise<RuntimeConfig> {
  cached ??= fetch("/config.json", { cache: "no-store" })
    .then((res) => (res.ok ? (res.json() as Promise<RuntimeConfig>) : {}))
    .catch(() => ({}));
  return cached;
}
