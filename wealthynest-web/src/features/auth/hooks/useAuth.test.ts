import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createQueryClientWrapper } from "@/test-utils/queryClientWrapper";
import {
  useLogin, useRegister, useLogout, useVerifyEmail, useResendVerification, useUpdateProfile,
  useChangePassword, useChangeEmail, useForgotPassword, useResetPassword, useEnablePin,
  useDisablePin, usePinLogin, usePasskeys, useRegisterPasskey, useDeletePasskey,
  useGoogleLogin, useGoogleLoginPopup, useCloseAccount, useUnlockWithPin, useUnlockWithPasskey,
  useSessions, useRevokeSession, useRevokeOtherSessions,
} from "./useAuth";
import { authApi } from "../api/auth.api";
import { useAuthStore } from "../store/auth.store";
import { readPersistedHiddenAt, writePersistedHiddenAt, writePasskeyDismissedOnDevice, useAppLockStore } from "../store/appLock.store";
import { createPasskey, getPasskeyAssertion } from "../utils/webauthn";
import { toast } from "sonner";
import type { User, AuthResponse } from "../types/auth.types";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));
vi.mock("../api/auth.api", () => ({
  authApi: {
    login: vi.fn(), register: vi.fn(), logout: vi.fn(), verifyEmail: vi.fn(),
    resendVerification: vi.fn(), updateProfile: vi.fn(), changePassword: vi.fn(),
    changeEmail: vi.fn(), forgotPassword: vi.fn(), resetPassword: vi.fn(),
    enablePin: vi.fn(), disablePin: vi.fn(), pinLogin: vi.fn(),
    listPasskeys: vi.fn(), getPasskeyRegistrationOptions: vi.fn(), verifyPasskeyRegistration: vi.fn(),
    deletePasskey: vi.fn(), getPasskeyLoginOptions: vi.fn(), passkeyLogin: vi.fn(),
    googleLogin: vi.fn(), googleLoginNative: vi.fn(), googleLoginPopup: vi.fn(), closeAccount: vi.fn(),
    listSessions: vi.fn(), revokeSession: vi.fn(), revokeOtherSessions: vi.fn(),
  },
}));
vi.mock("../utils/webauthn", () => ({ createPasskey: vi.fn(), getPasskeyAssertion: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockedApi = vi.mocked(authApi);
const mockedCreatePasskey = vi.mocked(createPasskey);
const mockedGetPasskeyAssertion = vi.mocked(getPasskeyAssertion);

const baseUser: User = {
  id: "u1", fullName: "Alice Smith", email: "a@x.com", role: "MEMBER",
  active: true, createdAt: "2026-01-01", pinEnabled: false,
};
const authResponse: AuthResponse = {
  accessToken: "at", user: baseUser,
} as AuthResponse;

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false, userVersion: 0 });
  useAppLockStore.setState({ isLocked: false });
  localStorage.clear();
});

describe("useLogin", () => {
  it("clears the query cache, sets auth, and navigates to /home", async () => {
    mockedApi.login.mockResolvedValue(authResponse);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const clearSpy = vi.spyOn(queryClient, "clear");

    const { result } = renderHook(() => useLogin(), { wrapper: Wrapper });
    result.current.mutate({ email: "a@x.com", password: "Pass1234" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(clearSpy).toHaveBeenCalled();
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(pushMock).toHaveBeenCalledWith("/home");
  });

  // A fresh, successful login must never immediately re-trigger the app-lock screen because of a
  // "went hidden at" marker left over from an earlier, unrelated session (e.g. one that ended via
  // axios.ts's forced logout on a failed token refresh, which can't go through useLogout()) — or
  // because `isLocked` itself is still stale-true from before this login (plain in-memory Zustand
  // state, so it survives an in-app router.push()). The real bug the isLocked half guards against:
  // sign out from the lock screen via "Use password instead", log back in with that password, and
  // the session you just proved re-shows the very lock screen you signed out to get past.
  it("clears both the stale 'went hidden at' marker and a stale isLocked flag on success", async () => {
    writePersistedHiddenAt(Date.now() - 10 * 60_000);
    useAppLockStore.setState({ isLocked: true });
    mockedApi.login.mockResolvedValue(authResponse);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useLogin(), { wrapper: Wrapper });
    result.current.mutate({ email: "a@x.com", password: "Pass1234" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(readPersistedHiddenAt()).toBeNull();
    expect(useAppLockStore.getState().isLocked).toBe(false);
  });

  // No success toast on login — see useLogin's own comment: landing on /home (which greets you by
  // name itself) is already the confirmation.
  it("does not show a success toast on login", async () => {
    mockedApi.login.mockResolvedValue(authResponse);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useLogin(), { wrapper: Wrapper });
    result.current.mutate({ email: "a@x.com", password: "Pass1234" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).not.toHaveBeenCalled();
  });

  // No "remember me" checkbox — the PIN/fingerprint/passkey lock screen is what actually gates a
  // returning device, so every login always requests the long-lived session.
  it("always requests the long-lived session, with no user choice involved", async () => {
    mockedApi.login.mockResolvedValue(authResponse);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useLogin(), { wrapper: Wrapper });
    result.current.mutate({ email: "a@x.com", password: "Pass1234" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.login).toHaveBeenCalledWith({ email: "a@x.com", password: "Pass1234", rememberMe: true });
  });

  it("shows the backend's real error message on failure", async () => {
    mockedApi.login.mockRejectedValue({ response: { data: { message: "Invalid email or password" } } });
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useLogin(), { wrapper: Wrapper });
    result.current.mutate({ email: "a@x.com", password: "wrong" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("Invalid email or password");
  });

  // ACCOUNT_LOCKED is rendered as a LockoutBanner at the call site (LoginForm) instead — the toast
  // would just duplicate the same "too many attempts" message.
  it("skips the toast for an ACCOUNT_LOCKED error, leaving it to the caller's LockoutBanner", async () => {
    mockedApi.login.mockRejectedValue({
      response: { data: { error: "ACCOUNT_LOCKED", message: "Too many failed attempts." } },
    });
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useLogin(), { wrapper: Wrapper });
    result.current.mutate({ email: "a@x.com", password: "wrong" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe("useRegister", () => {
  it("navigates to /verify-email with the encoded email on success", async () => {
    mockedApi.register.mockResolvedValue({} as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useRegister(), { wrapper: Wrapper });
    result.current.mutate({ fullName: "Bob", email: "bob+test@x.com", password: "Pass1234", confirmPassword: "Pass1234" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(pushMock).toHaveBeenCalledWith("/verify-email?email=bob%2Btest%40x.com");
  });
});

describe("useLogout", () => {
  // No refreshToken to check anymore — it lives only in the httpOnly cookie the browser attaches
  // automatically, so the mutation always calls the API and lets the server no-op if there's no
  // cookie, rather than pre-checking client-side.
  it("calls the api, clears state, and navigates to /login", async () => {
    mockedApi.logout.mockResolvedValue(undefined as never);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const clearSpy = vi.spyOn(queryClient, "clear");

    const { result } = renderHook(() => useLogout(), { wrapper: Wrapper });
    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.logout).toHaveBeenCalledWith();
    expect(clearSpy).toHaveBeenCalled();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(pushMock).toHaveBeenCalledWith("/login");
  });

  it("still clears state and navigates even when the api call itself fails (onSettled, not onSuccess)", async () => {
    mockedApi.logout.mockRejectedValue(new Error("network error"));
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const clearSpy = vi.spyOn(queryClient, "clear");

    const { result } = renderHook(() => useLogout(), { wrapper: Wrapper });
    result.current.mutate();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(clearSpy).toHaveBeenCalled();
    expect(pushMock).toHaveBeenCalledWith("/login");
  });

  // Real bug this guards against: sign out from the lock screen (e.g. "Use password instead")
  // while isLocked is still true, then log back in — without this, the stale flag survives the
  // in-app navigation and DashboardLayout re-shows the very lock screen just escaped.
  it("clears a stale isLocked flag on sign-out, not just on the next login", async () => {
    useAppLockStore.setState({ isLocked: true });
    mockedApi.logout.mockResolvedValue(undefined as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useLogout(), { wrapper: Wrapper });
    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(useAppLockStore.getState().isLocked).toBe(false);
  });
});

describe("useVerifyEmail", () => {
  it("shows the expired-link message when the backend gives no message", async () => {
    mockedApi.verifyEmail.mockRejectedValue({});
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useVerifyEmail(), { wrapper: Wrapper });
    result.current.mutate("token123");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("Verification failed. Link may have expired.");
  });
});

describe("useResendVerification", () => {
  it("toasts a confirmation on success", async () => {
    mockedApi.resendVerification.mockResolvedValue(undefined as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useResendVerification(), { wrapper: Wrapper });
    result.current.mutate("a@x.com");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith("Verification email sent. Check your inbox.");
  });
});

describe("useUpdateProfile", () => {
  it("writes the updated user into the auth store and toasts", async () => {
    const updated = { ...baseUser, fullName: "Alice Updated" };
    mockedApi.updateProfile.mockResolvedValue(updated);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useUpdateProfile(), { wrapper: Wrapper });
    result.current.mutate({ fullName: "Alice Updated" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(useAuthStore.getState().user).toEqual(updated);
    expect(toast.success).toHaveBeenCalledWith("Profile updated");
  });
});

describe("useChangePassword", () => {
  it("toasts a confirmation on success", async () => {
    mockedApi.changePassword.mockResolvedValue(undefined as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useChangePassword(), { wrapper: Wrapper });
    result.current.mutate({ currentPassword: "Old1234", newPassword: "New1234" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith("Password changed successfully");
  });
});

describe("useChangeEmail", () => {
  it("sets pendingEmail on the current user (real email unchanged until link click)", async () => {
    useAuthStore.setState({ user: baseUser });
    mockedApi.changeEmail.mockResolvedValue(undefined as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useChangeEmail(), { wrapper: Wrapper });
    result.current.mutate({ newEmail: "new@x.com", currentPassword: "Pass1234" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(useAuthStore.getState().user).toEqual({ ...baseUser, pendingEmail: "new@x.com" });
    expect(useAuthStore.getState().user?.email).toBe("a@x.com"); // real email untouched
    expect(toast.success).toHaveBeenCalledWith("Verification link sent to new@x.com");
  });
});

describe("useForgotPassword", () => {
  it("has no onSuccess/onError side effects — just calls the api", async () => {
    mockedApi.forgotPassword.mockResolvedValue(undefined as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useForgotPassword(), { wrapper: Wrapper });
    result.current.mutate("a@x.com");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe("useResetPassword", () => {
  it("toasts and navigates to /login on success", async () => {
    mockedApi.resetPassword.mockResolvedValue(undefined as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useResetPassword(), { wrapper: Wrapper });
    result.current.mutate({ token: "tok", newPassword: "New1234" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(pushMock).toHaveBeenCalledWith("/login");
  });
});

describe("useEnablePin / useDisablePin", () => {
  it("useEnablePin sets pinEnabled=true on the user", async () => {
    useAuthStore.setState({ user: baseUser });
    mockedApi.enablePin.mockResolvedValue(undefined as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useEnablePin(), { wrapper: Wrapper });
    result.current.mutate("1234");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(useAuthStore.getState().user?.pinEnabled).toBe(true);
    expect(mockedApi.enablePin).toHaveBeenCalledWith("1234");
  });

  it("useDisablePin sets pinEnabled=false on the user, passing the confirmed PIN through", async () => {
    useAuthStore.setState({ user: { ...baseUser, pinEnabled: true } });
    mockedApi.disablePin.mockResolvedValue(undefined as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useDisablePin(), { wrapper: Wrapper });
    result.current.mutate("1234");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(useAuthStore.getState().user?.pinEnabled).toBe(false);
    expect(mockedApi.disablePin).toHaveBeenCalledWith("1234");
  });

  it("useDisablePin stays silent (no toast) on an INVALID_PIN failure — the call site shakes the cells inline instead", async () => {
    mockedApi.disablePin.mockRejectedValue({ response: { data: { error: "INVALID_PIN", message: "Incorrect PIN" } } });
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useDisablePin(), { wrapper: Wrapper });
    result.current.mutate("0000");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("useDisablePin still toasts a fallback message for an unexpected failure", async () => {
    mockedApi.disablePin.mockRejectedValue({});
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useDisablePin(), { wrapper: Wrapper });
    result.current.mutate("1234");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("Failed to disable PIN");
  });
});

describe("usePinLogin", () => {
  it("clears cache, sets auth, and navigates on success", async () => {
    mockedApi.pinLogin.mockResolvedValue(authResponse);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => usePinLogin(), { wrapper: Wrapper });
    result.current.mutate("1234");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(pushMock).toHaveBeenCalledWith("/home");
  });

  it("clears both the stale 'went hidden at' marker and a stale isLocked flag on success", async () => {
    writePersistedHiddenAt(Date.now() - 10 * 60_000);
    useAppLockStore.setState({ isLocked: true });
    mockedApi.pinLogin.mockResolvedValue(authResponse);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => usePinLogin(), { wrapper: Wrapper });
    result.current.mutate("1234");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(readPersistedHiddenAt()).toBeNull();
    expect(useAppLockStore.getState().isLocked).toBe(false);
  });

  it("shows 'Incorrect PIN' fallback on failure", async () => {
    mockedApi.pinLogin.mockRejectedValue({});
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => usePinLogin(), { wrapper: Wrapper });
    result.current.mutate("0000");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("Incorrect PIN");
  });

  it("skips the toast for a PIN_LOCKED error, leaving it to the caller's LockoutBanner", async () => {
    mockedApi.pinLogin.mockRejectedValue({
      response: { data: { error: "PIN_LOCKED", message: "Too many incorrect PIN attempts." } },
    });
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => usePinLogin(), { wrapper: Wrapper });
    result.current.mutate("0000");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe("useUnlockWithPin", () => {
  it("sets auth from the rotated tokens WITHOUT clearing the query cache or navigating", async () => {
    mockedApi.pinLogin.mockResolvedValue(authResponse);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const clearSpy = vi.spyOn(queryClient, "clear");

    const { result } = renderHook(() => useUnlockWithPin(), { wrapper: Wrapper });
    result.current.mutate("1234");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(clearSpy).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("shows 'Incorrect PIN' fallback on failure", async () => {
    mockedApi.pinLogin.mockRejectedValue({});
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useUnlockWithPin(), { wrapper: Wrapper });
    result.current.mutate("0000");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("Incorrect PIN");
  });
});

describe("useUnlockWithPasskey", () => {
  it("uses the current user's email, sets auth, and does not clear cache or navigate", async () => {
    useAuthStore.setState({ user: baseUser });
    mockedApi.getPasskeyLoginOptions.mockResolvedValue({} as never);
    mockedGetPasskeyAssertion.mockResolvedValue({ id: "cred1" } as never);
    mockedApi.passkeyLogin.mockResolvedValue(authResponse);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const clearSpy = vi.spyOn(queryClient, "clear");

    const { result } = renderHook(() => useUnlockWithPasskey(), { wrapper: Wrapper });
    result.current.mutate(false);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.getPasskeyLoginOptions).toHaveBeenCalledWith("a@x.com");
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(clearSpy).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("silently does nothing when the user cancels the browser prompt", async () => {
    useAuthStore.setState({ user: baseUser });
    mockedApi.getPasskeyLoginOptions.mockResolvedValue({} as never);
    mockedGetPasskeyAssertion.mockRejectedValue(new DOMException("cancelled", "NotAllowedError"));
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useUnlockWithPasskey(), { wrapper: Wrapper });
    result.current.mutate(false);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("errors without calling the API when there is no active user", async () => {
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useUnlockWithPasskey(), { wrapper: Wrapper });
    result.current.mutate(false);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockedApi.getPasskeyLoginOptions).not.toHaveBeenCalled();
  });
});

describe("usePasskeys", () => {
  it("fetches the passkey list when authenticated", async () => {
    useAuthStore.setState({ isAuthenticated: true });
    mockedApi.listPasskeys.mockResolvedValue([] as never);
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => usePasskeys(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  // Regression coverage for a real bug: DashboardLayout's useAppLockTrigger calls this
  // unconditionally on every cold launch (capacitor.config.ts's server.url always loads /home
  // first), logged in or not. An unguarded fetch here 401s from a non-"/auth/**" endpoint, which
  // the axios interceptor doesn't exempt — so it fell into the token-refresh flow, found no
  // refresh token, and forced a hard `window.location.href = "/login"` reload.
  it("does not fetch when not authenticated", () => {
    useAuthStore.setState({ isAuthenticated: false });
    const { Wrapper } = createQueryClientWrapper();
    renderHook(() => usePasskeys(), { wrapper: Wrapper });
    expect(mockedApi.listPasskeys).not.toHaveBeenCalled();
  });
});

describe("useRegisterPasskey", () => {
  it("gets options, creates the passkey, verifies it, then invalidates and toasts", async () => {
    mockedApi.getPasskeyRegistrationOptions.mockResolvedValue({ challenge: "c" } as never);
    mockedCreatePasskey.mockResolvedValue({ id: "cred1" } as never);
    mockedApi.verifyPasskeyRegistration.mockResolvedValue(undefined as never);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useRegisterPasskey(), { wrapper: Wrapper });
    result.current.mutate("My Laptop");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.verifyPasskeyRegistration).toHaveBeenCalledWith({ id: "cred1" }, "My Laptop");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["auth", "passkeys"] });
    expect(toast.success).toHaveBeenCalledWith("Passkey added");
  });

  it("silently does nothing when the user cancels the browser prompt (NotAllowedError)", async () => {
    mockedApi.getPasskeyRegistrationOptions.mockResolvedValue({} as never);
    mockedCreatePasskey.mockRejectedValue(new DOMException("cancelled", "NotAllowedError"));
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useRegisterPasskey(), { wrapper: Wrapper });
    result.current.mutate("My Laptop");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).not.toHaveBeenCalled();
  });

  // A successful registration on this device proves it has a working credential store — an
  // earlier "don't show the fingerprint button on this device" from AppLockScreen (see its own
  // dismiss link) would otherwise be stuck stale with no way back except clearing site data.
  it("clears a stale 'don't show fingerprint on this device' flag on success", async () => {
    writePasskeyDismissedOnDevice();
    mockedApi.getPasskeyRegistrationOptions.mockResolvedValue({ challenge: "c" } as never);
    mockedCreatePasskey.mockResolvedValue({ id: "cred1" } as never);
    mockedApi.verifyPasskeyRegistration.mockResolvedValue(undefined as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useRegisterPasskey(), { wrapper: Wrapper });
    result.current.mutate("My Laptop");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(window.localStorage.getItem("wealthynest:applock:passkeyDismissed")).toBeNull();
  });

  it("leaves the dismiss flag untouched when registration fails", async () => {
    writePasskeyDismissedOnDevice();
    mockedApi.getPasskeyRegistrationOptions.mockResolvedValue({} as never);
    mockedCreatePasskey.mockRejectedValue(new Error("registration failed"));
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useRegisterPasskey(), { wrapper: Wrapper });
    result.current.mutate("My Laptop");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(window.localStorage.getItem("wealthynest:applock:passkeyDismissed")).toBe("true");
  });

  it("shows a generic error toast for any other failure", async () => {
    mockedApi.getPasskeyRegistrationOptions.mockResolvedValue({} as never);
    mockedCreatePasskey.mockRejectedValue(new Error("some other failure"));
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useRegisterPasskey(), { wrapper: Wrapper });
    result.current.mutate("My Laptop");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("Failed to add passkey");
  });
});

describe("useDeletePasskey", () => {
  it("invalidates the passkey list and toasts on success", async () => {
    mockedApi.deletePasskey.mockResolvedValue(undefined as never);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeletePasskey(), { wrapper: Wrapper });
    result.current.mutate("cred1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["auth", "passkeys"] });
    expect(toast.success).toHaveBeenCalledWith("Passkey removed");
  });
});

describe("useGoogleLogin", () => {
  it("clears cache, sets auth, and navigates on success", async () => {
    mockedApi.googleLogin.mockResolvedValue(authResponse);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useGoogleLogin(), { wrapper: Wrapper });
    result.current.mutate({ idToken: "google-id-token", rememberMe: true });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("clears both the stale 'went hidden at' marker and a stale isLocked flag on success", async () => {
    writePersistedHiddenAt(Date.now() - 10 * 60_000);
    useAppLockStore.setState({ isLocked: true });
    mockedApi.googleLogin.mockResolvedValue(authResponse);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useGoogleLogin(), { wrapper: Wrapper });
    result.current.mutate({ idToken: "google-id-token", rememberMe: true });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(readPersistedHiddenAt()).toBeNull();
    expect(useAppLockStore.getState().isLocked).toBe(false);
  });
});

describe("useGoogleLoginPopup", () => {
  it("clears cache, sets auth, and navigates on success", async () => {
    mockedApi.googleLoginPopup.mockResolvedValue(authResponse);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useGoogleLoginPopup(), { wrapper: Wrapper });
    result.current.mutate({ code: "auth-code", redirectUri: "postmessage", rememberMe: true });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("shows the backend's error message on failure", async () => {
    mockedApi.googleLoginPopup.mockRejectedValue({ response: { data: { message: "Google sign-in failed" } } });
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useGoogleLoginPopup(), { wrapper: Wrapper });
    result.current.mutate({ code: "auth-code", redirectUri: "postmessage", rememberMe: true });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("Google sign-in failed");
  });
});

describe("useSessions", () => {
  // No client-side refreshToken to pass anymore — the backend flags "current" by reading the
  // httpOnly cookie already riding along on the request itself (see UserController#listSessions).
  it("fetches the session list", async () => {
    mockedApi.listSessions.mockResolvedValue([] as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useSessions(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.listSessions).toHaveBeenCalledWith();
  });
});

describe("useRevokeSession", () => {
  it("revokes by id, invalidates the sessions query, and toasts on success", async () => {
    mockedApi.revokeSession.mockResolvedValue(undefined as never);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useRevokeSession(), { wrapper: Wrapper });
    result.current.mutate("session-1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.revokeSession).toHaveBeenCalledWith("session-1");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["auth", "sessions"] });
    expect(toast.success).toHaveBeenCalledWith("Device signed out");
  });

  it("shows an error toast on failure", async () => {
    mockedApi.revokeSession.mockRejectedValue({});
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useRevokeSession(), { wrapper: Wrapper });
    result.current.mutate("session-1");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("Failed to sign out that device");
  });
});

describe("useRevokeOtherSessions", () => {
  // No client-side refreshToken to pass or pre-check anymore — the backend identifies "this
  // device" from the httpOnly cookie already riding along on the request, and 401s cleanly if
  // it's missing (see UserController#revokeOtherSessions) rather than this hook guessing first.
  it("revokes, invalidates the sessions query, and toasts", async () => {
    mockedApi.revokeOtherSessions.mockResolvedValue(undefined as never);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useRevokeOtherSessions(), { wrapper: Wrapper });
    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.revokeOtherSessions).toHaveBeenCalledWith();
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["auth", "sessions"] });
    expect(toast.success).toHaveBeenCalledWith("Signed out of all other devices");
  });

  it("shows an error toast on failure", async () => {
    mockedApi.revokeOtherSessions.mockRejectedValue({});
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useRevokeOtherSessions(), { wrapper: Wrapper });
    result.current.mutate();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("Failed to sign out other devices");
  });
});

describe("useCloseAccount", () => {
  it("clears cache, logs out, navigates to /login, and toasts on success", async () => {
    useAuthStore.setState({ user: baseUser, isAuthenticated: true });
    mockedApi.closeAccount.mockResolvedValue(undefined as never);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const clearSpy = vi.spyOn(queryClient, "clear");

    const { result } = renderHook(() => useCloseAccount(), { wrapper: Wrapper });
    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(clearSpy).toHaveBeenCalled();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(pushMock).toHaveBeenCalledWith("/login");
    expect(toast.success).toHaveBeenCalledWith("Account closed. Sorry to see you go.");
  });
});
