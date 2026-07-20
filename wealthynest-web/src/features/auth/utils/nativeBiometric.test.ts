import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  isNativePlatformMock, checkBiometryMock, authenticateMock,
  storageGetMock, storageSetMock, storageRemoveMock,
} = vi.hoisted(() => ({
  isNativePlatformMock: vi.fn(),
  checkBiometryMock: vi.fn(),
  authenticateMock: vi.fn(),
  storageGetMock: vi.fn(),
  storageSetMock: vi.fn(),
  storageRemoveMock: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: isNativePlatformMock },
}));
vi.mock("@aparajita/capacitor-biometric-auth", () => ({
  BiometricAuth: { checkBiometry: checkBiometryMock, authenticate: authenticateMock },
  BiometryError: class BiometryError extends Error {
    code: string;
    constructor(message: string, code: string) { super(message); this.code = code; }
  },
  BiometryErrorType: { userCancel: "userCancel", appCancel: "appCancel" },
}));
vi.mock("capacitor-secure-storage-plugin", () => ({
  SecureStoragePlugin: { get: storageGetMock, set: storageSetMock, remove: storageRemoveMock },
}));

import {
  BiometryErrorType,
  disableBiometricPinUnlock,
  enableBiometricPinUnlock,
  hasBiometricPinStored,
  isBiometryError,
  isNativeBiometricAvailable,
  isNativePlatform,
  retrievePinViaBiometric,
} from "./nativeBiometric";
import { BiometryError } from "@aparajita/capacitor-biometric-auth";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("isNativePlatform", () => {
  it("delegates to Capacitor.isNativePlatform", () => {
    isNativePlatformMock.mockReturnValue(true);
    expect(isNativePlatform()).toBe(true);
  });
});

describe("isNativeBiometricAvailable", () => {
  it("returns false without checking biometry when not on a native platform", async () => {
    isNativePlatformMock.mockReturnValue(false);
    await expect(isNativeBiometricAvailable()).resolves.toBe(false);
    expect(checkBiometryMock).not.toHaveBeenCalled();
  });

  it("returns the device's availability when native", async () => {
    isNativePlatformMock.mockReturnValue(true);
    checkBiometryMock.mockResolvedValue({ isAvailable: true });
    await expect(isNativeBiometricAvailable()).resolves.toBe(true);
  });
});

describe("hasBiometricPinStored", () => {
  it("returns false when not native", async () => {
    isNativePlatformMock.mockReturnValue(false);
    await expect(hasBiometricPinStored()).resolves.toBe(false);
    expect(storageGetMock).not.toHaveBeenCalled();
  });

  it("returns true when a PIN is stored", async () => {
    isNativePlatformMock.mockReturnValue(true);
    storageGetMock.mockResolvedValue({ value: "1234" });
    await expect(hasBiometricPinStored()).resolves.toBe(true);
  });

  it("returns false when secure storage has nothing under the key", async () => {
    isNativePlatformMock.mockReturnValue(true);
    storageGetMock.mockRejectedValue(new Error("not found"));
    await expect(hasBiometricPinStored()).resolves.toBe(false);
  });
});

describe("enableBiometricPinUnlock", () => {
  it("authenticates before storing the PIN", async () => {
    authenticateMock.mockResolvedValue(undefined);
    storageSetMock.mockResolvedValue({ value: true });

    await enableBiometricPinUnlock("1234");

    expect(authenticateMock).toHaveBeenCalled();
    expect(storageSetMock).toHaveBeenCalledWith({ key: expect.any(String), value: "1234" });
    expect(authenticateMock.mock.invocationCallOrder[0]).toBeLessThan(storageSetMock.mock.invocationCallOrder[0]);
  });

  it("never stores the PIN when authentication fails", async () => {
    authenticateMock.mockRejectedValue(new BiometryError("cancelled", BiometryErrorType.userCancel));

    await expect(enableBiometricPinUnlock("1234")).rejects.toThrow();
    expect(storageSetMock).not.toHaveBeenCalled();
  });
});

describe("disableBiometricPinUnlock", () => {
  it("removes the stored PIN", async () => {
    storageRemoveMock.mockResolvedValue({ value: true });
    await disableBiometricPinUnlock();
    expect(storageRemoveMock).toHaveBeenCalledWith({ key: expect.any(String) });
  });
});

describe("retrievePinViaBiometric", () => {
  it("authenticates then returns the stored PIN", async () => {
    authenticateMock.mockResolvedValue(undefined);
    storageGetMock.mockResolvedValue({ value: "5678" });

    await expect(retrievePinViaBiometric()).resolves.toBe("5678");
    expect(authenticateMock).toHaveBeenCalled();
  });

  it("never reads storage when authentication fails", async () => {
    authenticateMock.mockRejectedValue(new BiometryError("cancelled", BiometryErrorType.userCancel));

    await expect(retrievePinViaBiometric()).rejects.toThrow();
    expect(storageGetMock).not.toHaveBeenCalled();
  });
});

describe("isBiometryError", () => {
  it("identifies real BiometryError instances", () => {
    expect(isBiometryError(new BiometryError("nope", BiometryErrorType.userCancel))).toBe(true);
  });

  it("rejects plain errors and non-errors", () => {
    expect(isBiometryError(new Error("plain"))).toBe(false);
    expect(isBiometryError("nope")).toBe(false);
    expect(isBiometryError(undefined)).toBe(false);
  });
});
