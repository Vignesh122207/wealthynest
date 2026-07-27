import { describe, it, expect } from "vitest";
import { parseUserAgent, isMobileUserAgent } from "./parseUserAgent";

describe("parseUserAgent", () => {
  it("returns 'Unknown device' when there's no user-agent string", () => {
    expect(parseUserAgent(undefined)).toBe("Unknown device");
    expect(parseUserAgent(null)).toBe("Unknown device");
    expect(parseUserAgent("")).toBe("Unknown device");
  });

  it("identifies Chrome on macOS", () => {
    const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    expect(parseUserAgent(ua)).toBe("Chrome on macOS");
  });

  it("identifies Safari on iOS", () => {
    const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    expect(parseUserAgent(ua)).toBe("Safari on iOS");
  });

  it("identifies Edge on Windows", () => {
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0";
    expect(parseUserAgent(ua)).toBe("Edge on Windows");
  });

  it("identifies the Capacitor Android WebView as the WealthyNest app", () => {
    const ua = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36; wv)";
    expect(parseUserAgent(ua)).toBe("WealthyNest app on Android");
  });

  it("falls back gracefully for an unrecognized user-agent", () => {
    expect(parseUserAgent("SomeBot/1.0")).toBe("a browser on an unknown OS");
  });
});

describe("isMobileUserAgent", () => {
  it("returns false when there's no user-agent string", () => {
    expect(isMobileUserAgent(undefined)).toBe(false);
    expect(isMobileUserAgent(null)).toBe(false);
    expect(isMobileUserAgent("")).toBe(false);
  });

  it("identifies Android as mobile", () => {
    expect(isMobileUserAgent("Mozilla/5.0 (Linux; Android 14; Pixel 8)")).toBe(true);
  });

  it("identifies iPhone/iPad as mobile", () => {
    expect(isMobileUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe(true);
    expect(isMobileUserAgent("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)")).toBe(true);
  });

  it("treats desktop OSes as not mobile", () => {
    expect(isMobileUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe(false);
    expect(isMobileUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe(false);
  });
});
