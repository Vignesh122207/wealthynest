import { describe, it, expect, vi, beforeEach } from "vitest";
import { Capacitor } from "@capacitor/core";
import { BiometricAuth, BiometryError, BiometryErrorType } from "@aparajita/capacitor-biometric-auth";
import { SecureStoragePlugin } from "capacitor-secure-storage-plugin";
import {
  isNativePlatform, isBiometricHardwareAvailable, isBiometricUnlockEnabled,
  enableBiometricUnlock, disableBiometricUnlock, verifyBiometric, isBiometryError,
} from "./nativeBiometric";

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: vi.fn() },
}));
vi.mock("@aparajita/capacitor-biometric-auth", () => ({
  BiometricAuth: { checkBiometry: vi.fn(), authenticate: vi.fn() },
  BiometryError: class extends Error {},
  BiometryErrorType: { userCancel: "userCancel", appCancel: "appCancel" },
}));
vi.mock("capacitor-secure-storage-plugin", () => ({
  SecureStoragePlugin: { get: vi.fn(), set: vi.fn(), remove: vi.fn() },
}));

const mockedIsNativePlatform = vi.mocked(Capacitor.isNativePlatform);
const mockedCheckBiometry = vi.mocked(BiometricAuth.checkBiometry);
const mockedAuthenticate = vi.mocked(BiometricAuth.authenticate);
const mockedGet = vi.mocked(SecureStoragePlugin.get);
const mockedSet = vi.mocked(SecureStoragePlugin.set);
const mockedRemove = vi.mocked(SecureStoragePlugin.remove);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("isNativePlatform", () => {
  it("delegates to Capacitor.isNativePlatform", () => {
    mockedIsNativePlatform.mockReturnValue(true);
    expect(isNativePlatform()).toBe(true);
  });
});

describe("isBiometricHardwareAvailable", () => {
  it("returns false without checking hardware on a non-native platform", async () => {
    mockedIsNativePlatform.mockReturnValue(false);
    expect(await isBiometricHardwareAvailable()).toBe(false);
    expect(mockedCheckBiometry).not.toHaveBeenCalled();
  });

  it("reflects checkBiometry's isAvailable on native", async () => {
    mockedIsNativePlatform.mockReturnValue(true);
    mockedCheckBiometry.mockResolvedValue({ isAvailable: true } as never);
    expect(await isBiometricHardwareAvailable()).toBe(true);
  });
});

describe("isBiometricUnlockEnabled", () => {
  it("returns false without reading storage on a non-native platform", async () => {
    mockedIsNativePlatform.mockReturnValue(false);
    expect(await isBiometricUnlockEnabled()).toBe(false);
    expect(mockedGet).not.toHaveBeenCalled();
  });

  it("returns true when the enabled flag is stored", async () => {
    mockedIsNativePlatform.mockReturnValue(true);
    mockedGet.mockResolvedValue({ value: "true" } as never);
    expect(await isBiometricUnlockEnabled()).toBe(true);
  });

  it("returns false when nothing is stored (a rejected get)", async () => {
    mockedIsNativePlatform.mockReturnValue(true);
    mockedGet.mockRejectedValue(new Error("not found"));
    expect(await isBiometricUnlockEnabled()).toBe(false);
  });
});

describe("enableBiometricUnlock", () => {
  it("confirms a biometric check, then stores the enabled flag", async () => {
    mockedAuthenticate.mockResolvedValue(undefined as never);
    await enableBiometricUnlock();
    expect(mockedAuthenticate).toHaveBeenCalledWith({ reason: "Enable fingerprint unlock" });
    expect(mockedSet).toHaveBeenCalledWith({ key: "wealthynest.applock.biometricEnabled", value: "true" });
  });

  it("stores nothing when the biometric check fails", async () => {
    mockedAuthenticate.mockRejectedValue(new Error("failed"));
    await expect(enableBiometricUnlock()).rejects.toThrow();
    expect(mockedSet).not.toHaveBeenCalled();
  });
});

describe("disableBiometricUnlock", () => {
  it("removes the stored enabled flag", async () => {
    await disableBiometricUnlock();
    expect(mockedRemove).toHaveBeenCalledWith({ key: "wealthynest.applock.biometricEnabled" });
  });
});

describe("verifyBiometric", () => {
  it("runs a biometric check with an unlock-specific reason", async () => {
    mockedAuthenticate.mockResolvedValue(undefined as never);
    await verifyBiometric();
    expect(mockedAuthenticate).toHaveBeenCalledWith({ reason: "Unlock WealthyNest" });
  });
});

describe("isBiometryError", () => {
  it("identifies a BiometryError instance", () => {
    expect(isBiometryError(new BiometryError("nope", BiometryErrorType.userCancel))).toBe(true);
  });

  it("rejects a plain Error", () => {
    expect(isBiometryError(new Error("nope"))).toBe(false);
  });
});
