/**
 * Wandelt ASS/SSA-Untertitel in WebVTT um, damit Jailfin sie selbst darstellen kann.
 * Jellyfin konvertiert ASS serverseitig nicht nach WebVTT; ohne Client-Unterstützung
 * würde es die Untertitel ins Bild einbrennen (Video-Transcoding, auf schwacher Hardware
 * Ursache für Ruckeln). Übernommen werden Zeiten, Text, Zeilenumbrüche sowie kursiv/fett;
 * Positionierung, Farben und Effekte entfallen bewusst.
 */

/** "0:01:02.34" → Sekunden */
function parseAssTime(value: string): number | null {
  const match = /^(\d+):(\d{1,2}):(\d{1,2})(?:[.,](\d{1,3}))?$/.exec(value.trim());
  if (!match) return null;
  const [, h, m, s, frac = "0"] = match;
  return (
    Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(frac.padEnd(3, "0").slice(0, 3)) / 1000
  );
}

function vttTime(seconds: number): string {
  const ms = Math.round(seconds * 1000);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const rest = ms % 1000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(rest).padStart(3, "0")}`;
}

const escapeVtt = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** ASS-Text (mit Override-Tags) → WebVTT-Cue-Text */
function convertText(text: string): string {
  let italic = false;
  let bold = false;
  let out = "";
  // Text in Blöcke aus {Override-Tags} und Klartext zerlegen.
  for (const part of text.split(/(\{[^}]*\})/)) {
    if (part.startsWith("{") && part.endsWith("}")) {
      for (const tag of part.slice(1, -1).split("\\")) {
        const italicTag = /^i([01])$/.exec(tag);
        if (italicTag) {
          const on = italicTag[1] === "1";
          if (on !== italic) out += on ? "<i>" : "</i>";
          italic = on;
        }
        const boldTag = /^b(\d+)$/.exec(tag);
        if (boldTag) {
          const on = boldTag[1] !== "0";
          if (on !== bold) out += on ? "<b>" : "</b>";
          bold = on;
        }
      }
      continue;
    }
    out += escapeVtt(part.replace(/\\[Nn]/g, "\n").replace(/\\h/g, " "));
  }
  if (bold) out += "</b>";
  if (italic) out += "</i>";
  return out
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

export function assToVtt(ass: string): string {
  const cues: { start: number; end: number; text: string }[] = [];
  let format: string[] | null = null;
  let inEvents = false;

  for (const raw of ass.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("[")) {
      inEvents = line.toLowerCase() === "[events]";
      continue;
    }
    if (!inEvents) continue;
    if (line.toLowerCase().startsWith("format:")) {
      format = line
        .slice(7)
        .split(",")
        .map((f) => f.trim().toLowerCase());
      continue;
    }
    if (!line.toLowerCase().startsWith("dialogue:") || !format) continue;

    // Das Textfeld ist immer das letzte und darf Kommas enthalten.
    const fields = line.slice(9).split(",");
    const values = [
      ...fields.slice(0, format.length - 1),
      fields.slice(format.length - 1).join(","),
    ].map((v) => v.trim());
    const get = (name: string) => values[format!.indexOf(name)] ?? "";
    const start = parseAssTime(get("start"));
    const end = parseAssTime(get("end"));
    const text = convertText(get("text"));
    if (start == null || end == null || end <= start || !text) continue;
    cues.push({ start, end, text });
  }

  cues.sort((a, b) => a.start - b.start);
  return `WEBVTT\n\n${cues.map((c) => `${vttTime(c.start)} --> ${vttTime(c.end)}\n${c.text}`).join("\n\n")}\n`;
}
