import { describe, it, expect, vi, afterEach } from "vitest";
import { registerServiceWorker } from "./serviceWorker";

describe("registerServiceWorker", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("registers /sw.js when the browser supports service workers", async () => {
    const register = vi.fn().mockResolvedValue({ scope: "/" });
    vi.stubGlobal("navigator", { serviceWorker: { register } });

    const result = await registerServiceWorker();

    expect(register).toHaveBeenCalledWith("/sw.js");
    expect(result).toEqual({ scope: "/" });
  });

  it("returns null without registering when serviceWorker isn't supported", async () => {
    vi.stubGlobal("navigator", {});

    const result = await registerServiceWorker();

    expect(result).toBeNull();
  });

  it("returns null instead of throwing when registration fails", async () => {
    const register = vi.fn().mockRejectedValue(new Error("registration failed"));
    vi.stubGlobal("navigator", { serviceWorker: { register } });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await registerServiceWorker();

    expect(result).toBeNull();
  });
});
