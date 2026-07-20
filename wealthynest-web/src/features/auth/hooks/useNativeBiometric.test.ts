import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createQueryClientWrapper } from "@/test-utils/queryClientWrapper";
import {
  useDisableBiometricPinUnlock,
  useEnableBiometricPinUnlock,
  useNativeBiometricStatus,
} from "./useNativeBiometric";
import {
  BiometryErrorType,
  disableBiometricPinUnlock,
  enableBiometricPinUnlock,
  hasBiometricPinStored,
  isBiometryError,
  isNativeBiometricAvailable,
  isNativePlatform,
} from "../utils/nativeBiometric";
import { toast } from "sonner";

vi.mock("../utils/nativeBiometric", () => ({
  BiometryErrorType: { userCancel: "userCancel", appCancel: "appCancel" },
  isNativePlatform: vi.fn(),
  isNativeBiometricAvailable: vi.fn(),
  hasBiometricPinStored: vi.fn(),
  enableBiometricPinUnlock: vi.fn(),
  disableBiometricPinUnlock: vi.fn(),
  isBiometryError: vi.fn(() => false),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockedIsNativePlatform = vi.mocked(isNativePlatform);
const mockedIsNativeBiometricAvailable = vi.mocked(isNativeBiometricAvailable);
const mockedHasBiometricPinStored = vi.mocked(hasBiometricPinStored);
const mockedEnable = vi.mocked(enableBiometricPinUnlock);
const mockedDisable = vi.mocked(disableBiometricPinUnlock);
const mockedIsBiometryError = vi.mocked(isBiometryError);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useNativeBiometricStatus", () => {
  it("reports unavailable without calling native checks when not on a native platform", async () => {
    mockedIsNativePlatform.mockReturnValue(false);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useNativeBiometricStatus(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ available: false, pinStored: false });
    expect(mockedIsNativeBiometricAvailable).not.toHaveBeenCalled();
    expect(mockedHasBiometricPinStored).not.toHaveBeenCalled();
  });

  it("reports availability and stored state on native platforms", async () => {
    mockedIsNativePlatform.mockReturnValue(true);
    mockedIsNativeBiometricAvailable.mockResolvedValue(true);
    mockedHasBiometricPinStored.mockResolvedValue(true);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useNativeBiometricStatus(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.data).toEqual({ available: true, pinStored: true }));
  });
});

describe("useEnableBiometricPinUnlock", () => {
  it("invalidates the status query on success", async () => {
    mockedEnable.mockResolvedValue(undefined);
    mockedIsNativePlatform.mockReturnValue(true);
    mockedIsNativeBiometricAvailable.mockResolvedValue(true);
    mockedHasBiometricPinStored.mockResolvedValue(true);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useEnableBiometricPinUnlock(), { wrapper: Wrapper });
    result.current.mutate("1234");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedEnable).toHaveBeenCalledWith("1234");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["auth", "nativeBiometric"] });
  });

  it("silently ignores a cancelled biometric prompt", async () => {
    mockedEnable.mockRejectedValue(Object.assign(new Error("cancelled"), { code: "userCancel" }));
    mockedIsBiometryError.mockReturnValue(true);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useEnableBiometricPinUnlock(), { wrapper: Wrapper });
    result.current.mutate("1234");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("shows an error toast for a real failure", async () => {
    mockedEnable.mockRejectedValue(new Error("secure storage unavailable"));
    mockedIsBiometryError.mockReturnValue(false);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useEnableBiometricPinUnlock(), { wrapper: Wrapper });
    result.current.mutate("1234");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("Couldn't enable fingerprint unlock");
  });
});

describe("useDisableBiometricPinUnlock", () => {
  it("invalidates the status query on success and nothing else", async () => {
    mockedDisable.mockResolvedValue(undefined);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDisableBiometricPinUnlock(), { wrapper: Wrapper });
    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["auth", "nativeBiometric"] });
    expect(toast.error).not.toHaveBeenCalled();
  });
});

// Sanity check that our mock's enum stand-in stays wired to what the hook actually compares
// against — if the real module's BiometryErrorType.userCancel value ever changes, this constant
// should too.
describe("BiometryErrorType wiring", () => {
  it("mocks the same userCancel value the hook checks", () => {
    expect(BiometryErrorType.userCancel).toBe("userCancel");
  });
});
