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
import { isWebAuthnSupported } from "../utils/webauthn";
import { markBiometricPromptEnded, markBiometricPromptStarting } from "../store/appLock.store";
import { usePasskeys, useRegisterPasskey } from "./useAuth";
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
vi.mock("../utils/webauthn", () => ({
  isWebAuthnSupported: vi.fn(() => Promise.resolve(false)),
}));
vi.mock("./useAuth", () => ({
  usePasskeys: vi.fn(() => ({ data: [] })),
  useRegisterPasskey: vi.fn(() => ({ mutateAsync: vi.fn() })),
}));
vi.mock("../store/appLock.store", () => ({
  markBiometricPromptStarting: vi.fn(),
  markBiometricPromptEnded: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockedIsNativePlatform = vi.mocked(isNativePlatform);
const mockedIsBiometricHardwareAvailable = vi.mocked(isBiometricHardwareAvailable);
const mockedIsBiometricUnlockEnabled = vi.mocked(isBiometricUnlockEnabled);
const mockedEnableBiometricUnlock = vi.mocked(enableBiometricUnlock);
const mockedDisableBiometricUnlock = vi.mocked(disableBiometricUnlock);
const mockedIsBiometryError = vi.mocked(isBiometryError);
const mockedIsWebAuthnSupported = vi.mocked(isWebAuthnSupported);
const mockedUsePasskeys = vi.mocked(usePasskeys);
const mockedUseRegisterPasskey = vi.mocked(useRegisterPasskey);
const mockedMarkBiometricPromptStarting = vi.mocked(markBiometricPromptStarting);
const mockedMarkBiometricPromptEnded = vi.mocked(markBiometricPromptEnded);

beforeEach(() => {
  vi.clearAllMocks();
  mockedIsWebAuthnSupported.mockResolvedValue(false);
  mockedUsePasskeys.mockReturnValue({ data: [] } as unknown as ReturnType<typeof usePasskeys>);
  mockedUseRegisterPasskey.mockReturnValue({ mutateAsync: vi.fn() } as unknown as ReturnType<typeof useRegisterPasskey>);
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

  it("also registers a passkey when this device supports one and the account has none yet", async () => {
    mockedEnableBiometricUnlock.mockResolvedValue(undefined);
    mockedIsWebAuthnSupported.mockResolvedValue(true);
    mockedUsePasskeys.mockReturnValue({ data: [] } as unknown as ReturnType<typeof usePasskeys>);
    const registerPasskey = vi.fn().mockResolvedValue(undefined);
    mockedUseRegisterPasskey.mockReturnValue({ mutateAsync: registerPasskey } as unknown as ReturnType<typeof useRegisterPasskey>);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useEnableBiometricUnlock(), { wrapper: Wrapper });
    act(() => { result.current.mutate(); });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(registerPasskey).toHaveBeenCalledWith("This device");
  });

  it("skips passkey registration when a passkey is already registered", async () => {
    mockedEnableBiometricUnlock.mockResolvedValue(undefined);
    mockedIsWebAuthnSupported.mockResolvedValue(true);
    mockedUsePasskeys.mockReturnValue({ data: [{ id: "1" }] } as unknown as ReturnType<typeof usePasskeys>);
    const registerPasskey = vi.fn().mockResolvedValue(undefined);
    mockedUseRegisterPasskey.mockReturnValue({ mutateAsync: registerPasskey } as unknown as ReturnType<typeof useRegisterPasskey>);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useEnableBiometricUnlock(), { wrapper: Wrapper });
    act(() => { result.current.mutate(); });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(registerPasskey).not.toHaveBeenCalled();
  });

  it("skips passkey registration when this device can't run a passkey ceremony", async () => {
    mockedEnableBiometricUnlock.mockResolvedValue(undefined);
    mockedIsWebAuthnSupported.mockResolvedValue(false);
    mockedUsePasskeys.mockReturnValue({ data: [] } as unknown as ReturnType<typeof usePasskeys>);
    const registerPasskey = vi.fn().mockResolvedValue(undefined);
    mockedUseRegisterPasskey.mockReturnValue({ mutateAsync: registerPasskey } as unknown as ReturnType<typeof useRegisterPasskey>);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useEnableBiometricUnlock(), { wrapper: Wrapper });
    act(() => { result.current.mutate(); });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(registerPasskey).not.toHaveBeenCalled();
  });

  it("still succeeds locally when the auto-provisioned passkey registration fails", async () => {
    mockedEnableBiometricUnlock.mockResolvedValue(undefined);
    mockedIsWebAuthnSupported.mockResolvedValue(true);
    mockedUsePasskeys.mockReturnValue({ data: [] } as unknown as ReturnType<typeof usePasskeys>);
    const registerPasskey = vi.fn().mockRejectedValue(new Error("declined"));
    mockedUseRegisterPasskey.mockReturnValue({ mutateAsync: registerPasskey } as unknown as ReturnType<typeof useRegisterPasskey>);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useEnableBiometricUnlock(), { wrapper: Wrapper });
    act(() => { result.current.mutate(); });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.error).not.toHaveBeenCalledWith("Couldn't enable fingerprint unlock");
  });

  // Regression: Android's Credential Manager sheet pauses the hosting Activity exactly like
  // BiometricPrompt does, and the status query (which flips `armed` in useAppLockTrigger for a
  // user with no PIN/passkey yet) is only invalidated after this whole mutation resolves — i.e.
  // after BOTH ceremonies. Without re-marking the ceremony active around the passkey step too,
  // enableBiometricUnlock's own grace tail would already have expired by the time the lock
  // trigger's zero-grace mount-time check runs, popping the lock screen mid-setup.
  it("brackets the chained passkey ceremony with markBiometricPromptStarting/Ended", async () => {
    mockedEnableBiometricUnlock.mockResolvedValue(undefined);
    mockedIsWebAuthnSupported.mockResolvedValue(true);
    mockedUsePasskeys.mockReturnValue({ data: [] } as unknown as ReturnType<typeof usePasskeys>);
    let activeWhileRegistering = false;
    const registerPasskey = vi.fn().mockImplementation(async () => {
      activeWhileRegistering =
        mockedMarkBiometricPromptStarting.mock.calls.length > 0 &&
        mockedMarkBiometricPromptEnded.mock.calls.length === 0;
    });
    mockedUseRegisterPasskey.mockReturnValue({ mutateAsync: registerPasskey } as unknown as ReturnType<typeof useRegisterPasskey>);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useEnableBiometricUnlock(), { wrapper: Wrapper });
    act(() => { result.current.mutate(); });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(activeWhileRegistering).toBe(true);
    expect(mockedMarkBiometricPromptEnded).toHaveBeenCalled();
  });

  it("still ends the bracket when the chained passkey registration fails", async () => {
    mockedEnableBiometricUnlock.mockResolvedValue(undefined);
    mockedIsWebAuthnSupported.mockResolvedValue(true);
    mockedUsePasskeys.mockReturnValue({ data: [] } as unknown as ReturnType<typeof usePasskeys>);
    const registerPasskey = vi.fn().mockRejectedValue(new Error("declined"));
    mockedUseRegisterPasskey.mockReturnValue({ mutateAsync: registerPasskey } as unknown as ReturnType<typeof useRegisterPasskey>);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useEnableBiometricUnlock(), { wrapper: Wrapper });
    act(() => { result.current.mutate(); });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedMarkBiometricPromptStarting).toHaveBeenCalled();
    expect(mockedMarkBiometricPromptEnded).toHaveBeenCalled();
  });

  it("doesn't touch the bracket at all when passkey registration is skipped", async () => {
    mockedEnableBiometricUnlock.mockResolvedValue(undefined);
    mockedIsWebAuthnSupported.mockResolvedValue(false);
    mockedUsePasskeys.mockReturnValue({ data: [] } as unknown as ReturnType<typeof usePasskeys>);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useEnableBiometricUnlock(), { wrapper: Wrapper });
    act(() => { result.current.mutate(); });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedMarkBiometricPromptStarting).not.toHaveBeenCalled();
    expect(mockedMarkBiometricPromptEnded).not.toHaveBeenCalled();
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

  it("shows an error toast on failure — regression: this used to be completely silent", async () => {
    mockedDisableBiometricUnlock.mockRejectedValue(new Error("hardware error"));
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useDisableBiometricUnlock(), { wrapper: Wrapper });
    act(() => { result.current.mutate(); });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("Couldn't disable fingerprint unlock");
  });
});
