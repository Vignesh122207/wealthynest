import { describe, it, expect } from "vitest";
import { vaultItemSchema, revealSchema } from "./vault.schema";

describe("vaultItemSchema", () => {
  const base = {
    itemType: "LOGIN" as const,
    title: "GitHub",
  };

  it("requireSecret=true: rejects a missing secret", () => {
    expect(vaultItemSchema(true).safeParse(base).success).toBe(false);
  });

  it("requireSecret=true: accepts when a secret is provided", () => {
    expect(vaultItemSchema(true).safeParse({ ...base, secret: "hunter2" }).success).toBe(true);
  });

  it("requireSecret=false: accepts a missing secret (editing keeps the existing encrypted value)", () => {
    expect(vaultItemSchema(false).safeParse(base).success).toBe(true);
  });

  it("rejects a blank title", () => {
    expect(vaultItemSchema(false).safeParse({ ...base, title: "" }).success).toBe(false);
  });

  it("rejects an unrecognized itemType", () => {
    expect(vaultItemSchema(false).safeParse({ ...base, itemType: "CREDIT_CARD" }).success).toBe(false);
  });

  it("username/url/category/icon/totpSecret are optional", () => {
    expect(vaultItemSchema(false).safeParse(base).success).toBe(true);
  });
});

describe("revealSchema", () => {
  it("password method: rejects a blank currentPassword", () => {
    expect(revealSchema.safeParse({ method: "password", currentPassword: "" }).success).toBe(false);
  });

  it("password method: accepts a non-blank currentPassword", () => {
    expect(revealSchema.safeParse({ method: "password", currentPassword: "MyPassword1" }).success).toBe(true);
  });

  it("pin method: rejects a PIN that isn't exactly 4 digits", () => {
    expect(revealSchema.safeParse({ method: "pin", pin: "123" }).success).toBe(false);
    expect(revealSchema.safeParse({ method: "pin", pin: "12345" }).success).toBe(false);
    expect(revealSchema.safeParse({ method: "pin", pin: "12a4" }).success).toBe(false);
  });

  it("pin method: accepts a 4-digit PIN", () => {
    expect(revealSchema.safeParse({ method: "pin", pin: "1234" }).success).toBe(true);
  });

  it("rejects a currentPassword value when method is \"pin\" (wrong shape for the chosen method)", () => {
    expect(revealSchema.safeParse({ method: "pin", currentPassword: "MyPassword1" }).success).toBe(false);
  });

  it("rejects an unrecognized method", () => {
    expect(revealSchema.safeParse({ method: "biometric", currentPassword: "MyPassword1" }).success).toBe(false);
  });
});
