import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { createQueryClientWrapper } from "@/test-utils/queryClientWrapper";
import {
  useIsNativePlatform, useNativeBiometricStatus, useEnableBiometricUnlock, useDisableBiometricUnlock,
} from "./useNativeBiometric";
import {
  isNativePlatform, isBiometricHardwareAvailable, isBiometricUnlockEnabled,
  enableBiometricUnlock, disableBiometricUnlock, isBiometryError,
} from "../utils/nativeBiometric";
import { toast } from "sonner";

vi.mock("../utils/nativeBiometric", () => ({
  BiometryErrorType: { userCancel: "userCancel", appCancel: "appCancel" },
  isNativePlatform: vi.fn(() => false),
  isBiometricHardwareAvailable: vi.fn(() => Promise.resolve(false)),
  isBiometricUnlockEnabled: vi.fn(() => Promise.resolve(false)),
  enableBiometricUnlock: vi.fn(),
  disableBiometricUnlock: vi.fn(),
  isBiometryError: vi.fn(() => false),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockedIsNativePlatform = vi.mocked(isNativePlatform);
const mockedIsBiometricHardwareAvailable = vi.mocked(isBiometricHardwareAvailable);
const mockedIsBiometricUnlockEnabled = vi.mocked(isBiometricUnlockEnabled);
const mockedEnableBiometricUnlock = vi.mocked(enableBiometricUnlock);
const mockedDisableBiometricUnlock = vi.mocked(disableBiometricUnlock);
const mockedIsBiometryError = vi.mocked(isBiometryError);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useIsNativePlatform", () => {
  it("starts false and resolves to the real platform after mount", async () => {
    mockedIsNativePlatform.mockReturnValue(true);
    const { result } = renderHook(() => useIsNativePlatform());
    await waitFor(() => expect(result.current).toBe(true));
  });
});

describe("useNativeBiometricStatus", () => {
  it("returns unavailable/disabled without checking anything on a non-native platform", async () => {
    mockedIsNativePlatform.mockReturnValue(false);
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useNativeBiometricStatus(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ available: false, enabled: false });
    expect(mockedIsBiometricHardwareAvailable).not.toHaveBeenCalled();
  });

  it("reflects hardware availability and the stored enabled flag on native", async () => {
    mockedIsNativePlatform.mockReturnValue(true);
    mockedIsBiometricHardwareAvailable.mockResolvedValue(true);
    mockedIsBiometricUnlockEnabled.mockResolvedValue(true);
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useNativeBiometricStatus(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ available: true, enabled: true });
  });
});

describe("useEnableBiometricUnlock", () => {
  it("invalidates the status query on success", async () => {
    mockedEnableBiometricUnlock.mockResolvedValue(undefined);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useEnableBiometricUnlock(), { wrapper: Wrapper });
    act(() => { result.current.mutate(); });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["auth", "nativeBiometric"] });
  });

  it("silently does nothing when the user cancels the biometric prompt", async () => {
    mockedEnableBiometricUnlock.mockRejectedValue(Object.assign(new Error("cancelled"), { code: "userCancel" }));
    mockedIsBiometryError.mockReturnValue(true);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useEnableBiometricUnlock(), { wrapper: Wrapper });
    act(() => { result.current.mutate(); });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("shows an error toast for any other failure", async () => {
    mockedEnableBiometricUnlock.mockRejectedValue(new Error("hardware error"));
    mockedIsBiometryError.mockReturnValue(false);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useEnableBiometricUnlock(), { wrapper: Wrapper });
    act(() => { result.current.mutate(); });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("Couldn't enable fingerprint unlock");
  });
});

describe("useDisableBiometricUnlock", () => {
  it("invalidates the status query on success", async () => {
    mockedDisableBiometricUnlock.mockResolvedValue(undefined);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDisableBiometricUnlock(), { wrapper: Wrapper });
    act(() => { result.current.mutate(); });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["auth", "nativeBiometric"] });
  });
});
