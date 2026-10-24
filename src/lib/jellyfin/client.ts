import { Jellyfin } from "@jellyfin/sdk";
import { randomId } from "../random-id";

const DEVICE_ID_KEY = "jailfin.deviceId";

/** Stabile, zufällige Geräte-ID pro Browserinstallation (Jellyfin ordnet Sitzungen darüber zu). */
export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = randomId();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function deviceName(): string {
  const ua = navigator.userAgent;
  if (/iPad|Macintosh.*Mobile/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) {
    return "Jailfin (iPad)";
  }
  if (/Android/.test(ua)) return "Jailfin (Android)";
  if (/Mac OS X/.test(ua)) return "Jailfin (macOS)";
  if (/Linux/.test(ua)) return "Jailfin (Linux)";
  return "Jailfin (Web)";
}

let instance: Jellyfin | undefined;

export function getJellyfin(): Jellyfin {
  instance ??= new Jellyfin({
    clientInfo: { name: "Jailfin", version: __APP_VERSION__ },
    deviceInfo: { name: deviceName(), id: getDeviceId() },
  });
  return instance;
}
