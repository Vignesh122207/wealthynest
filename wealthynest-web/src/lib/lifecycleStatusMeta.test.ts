import { describe, it, expect } from "vitest";
import { getLifecycleStatusMeta } from "./lifecycleStatusMeta";

describe("getLifecycleStatusMeta", () => {
  it("returns null for ACTIVE — no badge for the default state", () => {
    expect(getLifecycleStatusMeta("ACTIVE")).toBeNull();
  });

  it("returns null for a missing status", () => {
    expect(getLifecycleStatusMeta(null)).toBeNull();
    expect(getLifecycleStatusMeta(undefined)).toBeNull();
  });

  it("returns a badge for CLOSED", () => {
    expect(getLifecycleStatusMeta("CLOSED")?.label).toBe("Closed");
  });

  it("returns a badge for ARCHIVED", () => {
    expect(getLifecycleStatusMeta("ARCHIVED")?.label).toBe("Archived");
  });
});
