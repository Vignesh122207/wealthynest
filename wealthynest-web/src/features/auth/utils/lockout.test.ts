import { describe, it, expect, vi, afterEach } from "vitest";
import { deriveLockoutState } from "./lockout";

describe("deriveLockoutState", () => {
  afterEach(() => vi.useRealTimers());

  it("returns null for an unrecognized error code", () => {
    const error = { response: { data: { error: "INVALID_CREDENTIALS", message: "Invalid email or password" } } };
    expect(deriveLockoutState(error)).toBeNull();
  });

  it("returns null for an error with no code at all", () => {
    expect(deriveLockoutState(new Error("network down"))).toBeNull();
  });

  it("maps ACCOUNT_LOCKED to {message, retryAt} from details.lockedUntil", () => {
    const error = {
      response: { data: { error: "ACCOUNT_LOCKED", message: "Too many failed attempts.", details: { lockedUntil: "2026-01-01T00:05:00Z" } } },
    };
    expect(deriveLockoutState(error)).toEqual({ message: "Too many failed attempts.", retryAt: "2026-01-01T00:05:00Z" });
  });

  it("maps PIN_LOCKED to {message, retryAt} from details.lockedUntil", () => {
    const error = {
      response: { data: { error: "PIN_LOCKED", message: "Too many incorrect PIN attempts.", details: { lockedUntil: "2026-01-01T00:05:00Z" } } },
    };
    expect(deriveLockoutState(error)).toEqual({ message: "Too many incorrect PIN attempts.", retryAt: "2026-01-01T00:05:00Z" });
  });

  it("maps RATE_LIMIT_EXCEEDED to {message, retryAt} computed from retryAfterSeconds", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const error = {
      response: { data: { error: "RATE_LIMIT_EXCEEDED", message: "Too many requests. Please try again later.", retryAfterSeconds: 30 } },
    };
    expect(deriveLockoutState(error)).toEqual({
      message: "Too many requests. Please try again later.",
      retryAt: "2026-01-01T00:00:30.000Z",
    });
  });

  it("maps RATE_LIMIT_EXCEEDED with no retryAfterSeconds to a message-only state", () => {
    const error = { response: { data: { error: "RATE_LIMIT_EXCEEDED", message: "Too many requests." } } };
    expect(deriveLockoutState(error)).toEqual({ message: "Too many requests.", retryAt: undefined });
  });
});
