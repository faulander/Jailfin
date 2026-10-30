import { m } from "./i18n";
import { toasts } from "./toast.svelte";

/**
 * Erkennt, dass auf dem Server eine neue Version liegt, während die App (Tab bzw.
 * installierte App) noch die alte ausführt – eine Single-Page-App lädt sich sonst nie neu.
 * Vergleich über den gehashten Dateinamen des Haupt-Bundles in der index.html.
 */
const BUNDLE = /\/assets\/index-[\w-]+\.js/;
const CHECK_EVERY_MS = 15 * 60 * 1000;

export function startUpdateCheck(): void {
  const current = document
    .querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]')
    ?.getAttribute("src")
    ?.match(BUNDLE)?.[0];
  if (!current) return; // Entwicklungsserver: kein gehashtes Bundle

  let notified = false;
  const check = async () => {
    if (notified || document.visibilityState !== "visible") return;
    try {
      const html = await (await fetch("/", { cache: "no-store" })).text();
      const latest = html.match(BUNDLE)?.[0];
      if (latest && latest !== current) {
        notified = true;
        toasts.show(m.common.updateAvailable, {
          action: { label: m.common.reload, run: () => location.reload() },
          duration: 10 * 60 * 1000,
        });
      }
    } catch {
      // offline – beim nächsten Mal erneut prüfen
    }
  };

  document.addEventListener("visibilitychange", () => void check());
  setInterval(() => void check(), CHECK_EVERY_MS);
  void check();
}
