import { describe, expect, it, vi } from "vite-plus/test";
import { chooseServerUrl, normalizeServerUrl } from "./connection";

const base = {
  publicUrl: "https://jellyfin.example.de",
  localUrl: "http://192.168.1.5:8096",
  serverId: "abc",
  pageProtocol: "http:",
};

describe("chooseServerUrl", () => {
  it("uses the local address when it answers with the same server id", async () => {
    const probe = vi.fn(async () => "abc");
    expect(await chooseServerUrl({ ...base, probe })).toEqual({
      url: base.localUrl,
      mode: "local",
    });
    expect(probe).toHaveBeenCalledWith(base.localUrl);
  });

  it("falls back to the public address when the local one is unreachable", async () => {
    const choice = await chooseServerUrl({
      ...base,
      probe: async () => {
        throw new Error("timeout");
      },
    });
    expect(choice).toMatchObject({ url: base.publicUrl, mode: "public", reason: "unreachable" });
  });

  it("refuses a different server on the local address", async () => {
    const choice = await chooseServerUrl({ ...base, probe: async () => "other" });
    expect(choice).toMatchObject({ mode: "public", reason: "otherServer" });
  });

  it("does not try an http address from an https page (mixed content)", async () => {
    const probe = vi.fn(async () => "abc");
    const choice = await chooseServerUrl({ ...base, pageProtocol: "https:", probe });
    expect(choice).toMatchObject({ mode: "public", reason: "mixedContent" });
    expect(probe).not.toHaveBeenCalled();
  });

  it("uses the public address when no local one is configured", async () => {
    const probe = vi.fn(async () => "abc");
    expect(await chooseServerUrl({ ...base, localUrl: undefined, probe })).toMatchObject({
      url: base.publicUrl,
    });
    expect(probe).not.toHaveBeenCalled();
  });
});

describe("normalizeServerUrl", () => {
  it("adds http:// and strips trailing slashes", () => {
    expect(normalizeServerUrl(" 192.168.1.5:8096/ ")).toBe("http://192.168.1.5:8096");
    expect(normalizeServerUrl("https://x.de//")).toBe("https://x.de");
    expect(normalizeServerUrl("  ")).toBe("");
  });
});
