import { describe, expect, it } from "vite-plus/test";
import { assToVtt } from "./ass-to-vtt";

const ass = (events: string) => `[Script Info]
Title: Test
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize
Style: Default,Arial,20

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${events}
`;

describe("assToVtt", () => {
  it("converts timing, line breaks and keeps commas inside the text", () => {
    const vtt = assToVtt(
      ass("Dialogue: 0,0:00:01.50,0:00:04.00,Default,,0,0,0,,Hallo, Welt!\\NZweite Zeile"),
    );
    expect(vtt).toBe("WEBVTT\n\n00:00:01.500 --> 00:00:04.000\nHallo, Welt!\nZweite Zeile\n");
  });

  it("drops positioning/colour tags but keeps italic and bold", () => {
    const vtt = assToVtt(
      ass(
        "Dialogue: 0,0:01:00.00,0:01:02.00,Default,,0,0,0,,{\\an8\\pos(10,20)\\c&H00FFFF&}Oben {\\i1}kursiv{\\i0} und {\\b1}fett",
      ),
    );
    expect(vtt).toContain("Oben <i>kursiv</i> und <b>fett</b>");
    expect(vtt).not.toContain("pos(");
  });

  it("escapes markup characters and sorts cues by start time", () => {
    const vtt = assToVtt(
      ass(
        [
          "Dialogue: 0,0:00:10.00,0:00:11.00,Default,,0,0,0,,später",
          "Dialogue: 0,0:00:02.00,0:00:03.00,Default,,0,0,0,,a < b & c",
        ].join("\n"),
      ),
    );
    expect(vtt.indexOf("a &lt; b &amp; c")).toBeLessThan(vtt.indexOf("später"));
  });

  it("skips comments, empty text and invalid times", () => {
    const vtt = assToVtt(
      ass(
        [
          "Comment: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,Kommentar",
          "Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,{\\an8}",
          "Dialogue: 0,kaputt,0:00:02.00,Default,,0,0,0,,x",
        ].join("\n"),
      ),
    );
    expect(vtt).toBe("WEBVTT\n\n\n");
  });
});
