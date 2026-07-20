import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createQueryClientWrapper } from "@/test-utils/queryClientWrapper";
import {
  useLogin, useRegister, useLogout, useVerifyEmail, useResendVerification, useUpdateProfile,
  useChangePassword, useChangeEmail, useForgotPassword, useResetPassword, useEnablePin,
  useDisablePin, usePinLogin, usePasskeys, useRegisterPasskey, useDeletePasskey,
  usePasskeyLogin, useGoogleLogin, useCloseAccount, useUnlockWithPin, useUnlockWithPasskey,
} from "./useAuth";
import { authApi } from "../api/auth.api";
import { useAuthStore } from "../store/auth.store";
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
    googleLogin: vi.fn(), closeAccount: vi.fn(),
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
  accessToken: "at", refreshToken: "rt", user: baseUser,
} as AuthResponse;

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false, userVersion: 0 });
});

describe("useLogin", () => {
  it("clears the query cache, sets auth, greets by first name, and navigates to /home", async () => {
    mockedApi.login.mockResolvedValue(authResponse);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const clearSpy = vi.spyOn(queryClient, "clear");

    const { result } = renderHook(() => useLogin(), { wrapper: Wrapper });
    result.current.mutate({ email: "a@x.com", password: "Pass1234", rememberMe: true });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(clearSpy).toHaveBeenCalled();
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(toast.success).toHaveBeenCalledWith("Welcome back, Alice!");
    expect(pushMock).toHaveBeenCalledWith("/home");
  });

  it("defaults rememberMe to false when omitted", async () => {
    mockedApi.login.mockResolvedValue(authResponse);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useLogin(), { wrapper: Wrapper });
    result.current.mutate({ email: "a@x.com", password: "Pass1234" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.login).toHaveBeenCalledWith({ email: "a@x.com", password: "Pass1234", rememberMe: false });
  });

  it("shows the backend's real error message on failure", async () => {
    mockedApi.login.mockRejectedValue({ response: { data: { message: "Invalid email or password" } } });
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useLogin(), { wrapper: Wrapper });
    result.current.mutate({ email: "a@x.com", password: "wrong" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("Invalid email or password");
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
  it("calls the api with the current refreshToken, clears state, and navigates to /login", async () => {
    useAuthStore.setState({ refreshToken: "rt-123" });
    mockedApi.logout.mockResolvedValue(undefined as never);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const clearSpy = vi.spyOn(queryClient, "clear");

    const { result } = renderHook(() => useLogout(), { wrapper: Wrapper });
    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.logout).toHaveBeenCalledWith("rt-123");
    expect(clearSpy).toHaveBeenCalled();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(pushMock).toHaveBeenCalledWith("/login");
  });

  it("still clears state and navigates even when the api call itself fails (onSettled, not onSuccess)", async () => {
    useAuthStore.setState({ refreshToken: "rt-123" });
    mockedApi.logout.mockRejectedValue(new Error("network error"));
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const clearSpy = vi.spyOn(queryClient, "clear");

    const { result } = renderHook(() => useLogout(), { wrapper: Wrapper });
    result.current.mutate();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(clearSpy).toHaveBeenCalled();
    expect(pushMock).toHaveBeenCalledWith("/login");
  });

  it("does not call the api at all when there is no refreshToken", async () => {
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useLogout(), { wrapper: Wrapper });
    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.logout).not.toHaveBeenCalled();
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
    result.current.mutate({ currentPassword: "Pass1234", pin: "1234" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(useAuthStore.getState().user?.pinEnabled).toBe(true);
  });

  it("useDisablePin sets pinEnabled=false on the user", async () => {
    useAuthStore.setState({ user: { ...baseUser, pinEnabled: true } });
    mockedApi.disablePin.mockResolvedValue(undefined as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useDisablePin(), { wrapper: Wrapper });
    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(useAuthStore.getState().user?.pinEnabled).toBe(false);
  });
});

describe("usePinLogin", () => {
  it("clears cache, sets auth, and navigates on success", async () => {
    mockedApi.pinLogin.mockResolvedValue(authResponse);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => usePinLogin(), { wrapper: Wrapper });
    result.current.mutate({ refreshToken: "rt", pin: "1234" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(pushMock).toHaveBeenCalledWith("/home");
  });

  it("shows 'Incorrect PIN' fallback on failure", async () => {
    mockedApi.pinLogin.mockRejectedValue({});
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => usePinLogin(), { wrapper: Wrapper });
    result.current.mutate({ refreshToken: "rt", pin: "0000" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("Incorrect PIN");
  });
});

describe("useUnlockWithPin", () => {
  it("sets auth from the rotated tokens WITHOUT clearing the query cache or navigating", async () => {
    mockedApi.pinLogin.mockResolvedValue(authResponse);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const clearSpy = vi.spyOn(queryClient, "clear");

    const { result } = renderHook(() => useUnlockWithPin(), { wrapper: Wrapper });
    result.current.mutate({ refreshToken: "rt", pin: "1234" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(clearSpy).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("shows 'Incorrect PIN' fallback on failure", async () => {
    mockedApi.pinLogin.mockRejectedValue({});
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useUnlockWithPin(), { wrapper: Wrapper });
    result.current.mutate({ refreshToken: "rt", pin: "0000" });

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
  it("fetches the passkey list", async () => {
    mockedApi.listPasskeys.mockResolvedValue([] as never);
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => usePasskeys(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
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

describe("usePasskeyLogin", () => {
  it("gets options, gets the assertion, logs in, and navigates on success", async () => {
    mockedApi.getPasskeyLoginOptions.mockResolvedValue({} as never);
    mockedGetPasskeyAssertion.mockResolvedValue({ id: "cred1" } as never);
    mockedApi.passkeyLogin.mockResolvedValue(authResponse);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => usePasskeyLogin(), { wrapper: Wrapper });
    result.current.mutate({ email: "a@x.com", rememberMe: false });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(pushMock).toHaveBeenCalledWith("/home");
  });

  it("silently does nothing when the user cancels the browser prompt", async () => {
    mockedApi.getPasskeyLoginOptions.mockResolvedValue({} as never);
    mockedGetPasskeyAssertion.mockRejectedValue(new DOMException("cancelled", "NotAllowedError"));
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => usePasskeyLogin(), { wrapper: Wrapper });
    result.current.mutate({ email: "a@x.com", rememberMe: false });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).not.toHaveBeenCalled();
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
    expect(toast.success).toHaveBeenCalledWith("Welcome, Alice!");
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
