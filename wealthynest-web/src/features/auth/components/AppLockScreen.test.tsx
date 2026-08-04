import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { AppLockScreen } from "./AppLockScreen";
import { useAuthStore } from "../store/auth.store";
import { useAppLockStore } from "../store/appLock.store";
import { authApi } from "../api/auth.api";
import { isWebAuthnSupported, getPasskeyAssertion } from "../utils/webauthn";
import {
  isNativePlatform, isBiometricHardwareAvailable, isBiometricUnlockEnabled, verifyBiometric, isBiometryError,
} from "../utils/nativeBiometric";
import { toast } from "sonner";
import type { User } from "../types/auth.types";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));
vi.mock("../api/auth.api", () => ({
  authApi: {
    pinLogin: vi.fn(), logout: vi.fn(), getPasskeyLoginOptions: vi.fn(), passkeyLogin: vi.fn(),
    listPasskeys: vi.fn(),
  },
}));
vi.mock("../utils/webauthn", () => ({
  isWebAuthnSupported: vi.fn(() => Promise.resolve(false)),
  getPasskeyAssertion: vi.fn(),
}));
vi.mock("../utils/nativeBiometric", () => ({
  BiometryErrorType: { userCancel: "userCancel", appCancel: "appCancel" },
  isNativePlatform: vi.fn(() => false),
  isBiometricHardwareAvailable: vi.fn(() => Promise.resolve(false)),
  isBiometricUnlockEnabled: vi.fn(() => Promise.resolve(false)),
  verifyBiometric: vi.fn(),
  isBiometryError: vi.fn(() => false),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockedApi = vi.mocked(authApi);
const mockedWebAuthnSupported = vi.mocked(isWebAuthnSupported);
const mockedGetPasskeyAssertion = vi.mocked(getPasskeyAssertion);
const mockedIsNativePlatform = vi.mocked(isNativePlatform);
const mockedIsBiometricHardwareAvailable = vi.mocked(isBiometricHardwareAvailable);
const mockedIsBiometricUnlockEnabled = vi.mocked(isBiometricUnlockEnabled);
const mockedVerifyBiometric = vi.mocked(verifyBiometric);
const mockedIsBiometryError = vi.mocked(isBiometryError);

const user: User = {
  id: "u1", fullName: "Alice Smith", email: "a@x.com", role: "MEMBER",
  active: true, createdAt: "2026-01-01", pinEnabled: true, hasPasskeys: false, loginAlertEnabled: true,
};

function renderLockScreen() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AppLockScreen />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  mockedWebAuthnSupported.mockResolvedValue(false);
  mockedApi.listPasskeys.mockResolvedValue([]);
  mockedIsNativePlatform.mockReturnValue(false);
  mockedIsBiometricHardwareAvailable.mockResolvedValue(false);
  mockedIsBiometricUnlockEnabled.mockResolvedValue(false);
  // Auto-fire fires the credential check the instant fingerprintAvailable flips true, so any test
  // that gets there without configuring its own resolved/rejected value needs a safe default
  // rather than an unconfigured mock resolving to `undefined`.
  mockedGetPasskeyAssertion.mockRejectedValue(new Error("not configured in this test"));
  mockedVerifyBiometric.mockRejectedValue(new Error("not configured in this test"));
  useAuthStore.setState({
    user, accessToken: "at", isAuthenticated: true, userVersion: 0,
  });
  // Reset between tests — "signs out once the dialog is confirmed" (and this file's own new
  // pinRecoveryPending test) both flip these via the real onConfirm handler, and Zustand module
  // state otherwise leaks across tests in the same file.
  useAppLockStore.setState({ isLocked: false, pinRecoveryPending: false, pendingPinResetPassword: null });
});

describe("AppLockScreen", () => {
  // Deliberately no name/greeting on this screen — see the component's own comment on why (a lock
  // screen is exactly the moment a phone might be in someone else's hands).
  it("does not display the account holder's name", () => {
    renderLockScreen();
    expect(screen.queryByText(/Alice/)).not.toBeInTheDocument();
  });

  it("renders the dialog with an accessible label instead of relying on visible name text", () => {
    renderLockScreen();
    expect(screen.getByRole("dialog", { name: "Unlock WealthyNest" })).toBeInTheDocument();
  });

  it("offers 'Sign out & use password' as a peer option, not just a buried sign-out link", () => {
    renderLockScreen();
    expect(screen.getByTestId("applock-use-password")).toHaveTextContent("Sign out & use password");
  });

  it("renders nothing when there is no active user", () => {
    useAuthStore.setState({ user: null });
    const { container } = renderLockScreen();
    expect(container).toBeEmptyDOMElement();
  });

  it("disables the unlock button until 4 digits are entered", () => {
    renderLockScreen();
    const submit = screen.getByTestId("applock-pin-submit");
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByTestId("applock-pin-input"), { target: { value: "123" } });
    expect(submit).toBeDisabled();
  });

  it("strips non-digit characters from the PIN input", () => {
    renderLockScreen();
    const input = screen.getByTestId("applock-pin-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "12a3b4" } });
    expect(input.value).toBe("1234");
  });

  // PIN creation (settings/security/page.tsx's pinSchema) is fixed at exactly 4 digits, so this
  // screen no longer needs to accommodate an unknown account-chosen length the way it used to.
  it("always renders exactly 4 PIN cells", () => {
    renderLockScreen();
    expect(screen.getAllByTestId("applock-pin-cell")).toHaveLength(4);
  });

  it("caps the PIN input at 4 characters", () => {
    renderLockScreen();
    expect(screen.getByTestId("applock-pin-input")).toHaveAttribute("maxLength", "4");
  });

  // Typing the 4th digit submits on its own — no separate "Unlock" tap needed for a fixed-length
  // PIN. The explicit click in earlier versions of this test is gone on purpose: by the time a
  // click would fire, the auto-submit effect has already sent the request.
  it("auto-submits the instant the 4th digit is entered, without a button click", async () => {
    mockedApi.pinLogin.mockResolvedValue({
      accessToken: "at2", user, expiresIn: 3600, tokenType: "Bearer",
    });
    renderLockScreen();

    fireEvent.change(screen.getByTestId("applock-pin-input"), { target: { value: "1234" } });

    await waitFor(() => expect(mockedApi.pinLogin).toHaveBeenCalledWith("1234"));
    expect(mockedApi.pinLogin).toHaveBeenCalledTimes(1);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("shows an inline error and clears the PIN when the server rejects it", async () => {
    mockedApi.pinLogin.mockRejectedValue(new Error("Incorrect PIN"));
    renderLockScreen();

    const input = screen.getByTestId("applock-pin-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "9999" } });

    await waitFor(() => expect(screen.getByText("Incorrect PIN — try again")).toBeInTheDocument());
    expect(input.value).toBe("");
  });

  it("clears the inline PIN error as soon as the user starts typing again", async () => {
    mockedApi.pinLogin.mockRejectedValue(new Error("Incorrect PIN"));
    renderLockScreen();

    fireEvent.change(screen.getByTestId("applock-pin-input"), { target: { value: "9999" } });
    await waitFor(() => expect(screen.getByText("Incorrect PIN — try again")).toBeInTheDocument());

    fireEvent.change(screen.getByTestId("applock-pin-input"), { target: { value: "1" } });
    expect(screen.queryByText("Incorrect PIN — try again")).not.toBeInTheDocument();
  });

  // logout() revokes the refresh token the instant it's called, with no undo — so unlike "Not
  // you? Sign out" (whose label already says exactly what it does), "Sign out & use password" is
  // gated behind the app's shared ConfirmDialog modal (see src/components/shared/ConfirmDialog.tsx
  // — same "confirm a consequential action" pattern used everywhere else) rather than a bespoke
  // inline banner: a mis-tap shouldn't force a full re-login.
  describe("'Sign out & use password' confirm step", () => {
    it("does not sign out immediately — opens the confirm dialog first", () => {
      renderLockScreen();
      fireEvent.click(screen.getByTestId("applock-use-password"));
      expect(mockedApi.logout).not.toHaveBeenCalled();
      expect(screen.getByTestId("confirm-dialog-confirm")).toBeInTheDocument();
    });

    it("cancels without signing out", () => {
      renderLockScreen();
      fireEvent.click(screen.getByTestId("applock-use-password"));
      fireEvent.click(screen.getByTestId("confirm-dialog-cancel"));
      expect(mockedApi.logout).not.toHaveBeenCalled();
      expect(screen.queryByTestId("confirm-dialog-confirm")).not.toBeInTheDocument();
      expect(screen.getByTestId("applock-use-password")).toBeInTheDocument();
    });

    it("signs out once the dialog is confirmed", async () => {
      mockedApi.logout.mockResolvedValue(undefined);
      renderLockScreen();
      fireEvent.click(screen.getByTestId("applock-use-password"));
      fireEvent.click(screen.getByTestId("confirm-dialog-confirm"));

      await waitFor(() => expect(mockedApi.logout).toHaveBeenCalledWith());
      expect(pushMock).toHaveBeenCalledWith("/login");
    });

    // Regression coverage for a real gap: this escape hatch got the user back into the app, but
    // never touched the actual forgotten PIN, so the very next lock re-showed the same PIN prompt
    // they couldn't answer before. useLogin's own redirect-to-PIN-setup logic reads this flag —
    // see appLock.store's own comment on pinRecoveryPending.
    it("marks pinRecoveryPending before signing out, so the next login can redirect into PIN setup", async () => {
      mockedApi.logout.mockResolvedValue(undefined);
      expect(useAppLockStore.getState().pinRecoveryPending).toBe(false);
      renderLockScreen();
      fireEvent.click(screen.getByTestId("applock-use-password"));
      fireEvent.click(screen.getByTestId("confirm-dialog-confirm"));

      expect(useAppLockStore.getState().pinRecoveryPending).toBe(true);
      await waitFor(() => expect(mockedApi.logout).toHaveBeenCalledWith());
    });
  });

  // Passkey (web/desktop) — the fingerprint button on web is a WebAuthn ceremony, only ever shown
  // off-native (native gets the bare BiometricPrompt path below instead, never both — see the
  // component's own comment for why).
  describe("passkey fingerprint (web/desktop)", () => {
    it("hides the fingerprint button when WebAuthn isn't supported", () => {
      mockedWebAuthnSupported.mockResolvedValue(false);
      mockedApi.listPasskeys.mockResolvedValue([{ id: "p1", nickname: "Phone", createdAt: "2026-01-01" }]);
      renderLockScreen();
      expect(screen.queryByTestId("applock-fingerprint-button")).not.toBeInTheDocument();
    });

    it("shows the fingerprint button when WebAuthn is supported and the account has a registered passkey", async () => {
      mockedWebAuthnSupported.mockResolvedValue(true);
      mockedApi.listPasskeys.mockResolvedValue([{ id: "p1", nickname: "Phone", createdAt: "2026-01-01" }]);
      renderLockScreen();
      await waitFor(() => expect(screen.getByTestId("applock-fingerprint-button")).toBeInTheDocument());
    });

    // The bug this guards against: the button used to be shown purely off browser capability, so a
    // PIN-only account with zero registered passkeys still saw a button that could only ever fail.
    it("hides the fingerprint button when WebAuthn is supported but the account has no registered passkeys", async () => {
      mockedWebAuthnSupported.mockResolvedValue(true);
      mockedApi.listPasskeys.mockResolvedValue([]);
      renderLockScreen();
      await waitFor(() => expect(mockedApi.listPasskeys).toHaveBeenCalled());
      expect(screen.queryByTestId("applock-fingerprint-button")).not.toBeInTheDocument();
    });

    // Passkeys are the web/desktop story only — native gets a bare BiometricPrompt instead (see
    // "native fingerprint" below), so a passkey button must never appear there even if the account
    // happens to have a passkey registered from a prior web session.
    it("hides the passkey-based fingerprint button on native even with a registered passkey", async () => {
      mockedIsNativePlatform.mockReturnValue(true);
      mockedWebAuthnSupported.mockResolvedValue(true);
      mockedApi.listPasskeys.mockResolvedValue([{ id: "p1", nickname: "Phone", createdAt: "2026-01-01" }]);
      renderLockScreen();
      await waitFor(() => expect(mockedApi.listPasskeys).toHaveBeenCalled());
      expect(mockedGetPasskeyAssertion).not.toHaveBeenCalled();
      expect(screen.queryByTestId("applock-fingerprint-button")).not.toBeInTheDocument();
    });

    // Deliberately never auto-fires — see the component's own comment on the auto-trigger effect
    // for why: passkey availability is account-wide (any device that ever registered one), so
    // auto-attempting the ceremony would surface a system passkey prompt on every device tied to
    // the account, including ones that never set one up locally. It only ever fires from a tap.
    it("never auto-fires — stays idle until the button is tapped", async () => {
      mockedWebAuthnSupported.mockResolvedValue(true);
      mockedApi.listPasskeys.mockResolvedValue([{ id: "p1", nickname: "Phone", createdAt: "2026-01-01" }]);
      renderLockScreen();

      await waitFor(() => expect(screen.getByTestId("applock-fingerprint-button")).toBeInTheDocument());
      expect(mockedGetPasskeyAssertion).not.toHaveBeenCalled();
    });

    it("runs the ceremony and signs in on a tap", async () => {
      mockedWebAuthnSupported.mockResolvedValue(true);
      mockedApi.listPasskeys.mockResolvedValue([{ id: "p1", nickname: "Phone", createdAt: "2026-01-01" }]);
      mockedApi.getPasskeyLoginOptions.mockResolvedValue({} as never);
      mockedGetPasskeyAssertion.mockResolvedValue({} as never);
      mockedApi.passkeyLogin.mockResolvedValue({
        accessToken: "at3", user, expiresIn: 3600, tokenType: "Bearer",
      });
      renderLockScreen();

      await waitFor(() => expect(screen.getByTestId("applock-fingerprint-button")).toBeInTheDocument());
      fireEvent.click(screen.getByTestId("applock-fingerprint-button"));

      await waitFor(() => expect(mockedGetPasskeyAssertion).toHaveBeenCalled());
      await waitFor(() => expect(mockedApi.passkeyLogin).toHaveBeenCalled());
    });

    // Revoking this device's prior session (if any) on a passkey unlock is now purely a backend
    // concern — the server reads the httpOnly cookie already riding along on the request itself
    // (see WebAuthnController/AuthServiceImpl), with no client-side token to pass or assert on
    // here. Covered on the backend by AuthControllerTest's webAuthnLoginVerify cookie tests.

    it("silently ignores a cancelled passkey prompt", async () => {
      mockedWebAuthnSupported.mockResolvedValue(true);
      mockedApi.listPasskeys.mockResolvedValue([{ id: "p1", nickname: "Phone", createdAt: "2026-01-01" }]);
      mockedApi.getPasskeyLoginOptions.mockResolvedValue({} as never);
      mockedGetPasskeyAssertion.mockRejectedValue(new DOMException("cancelled", "NotAllowedError"));
      renderLockScreen();

      await waitFor(() => expect(screen.getByTestId("applock-fingerprint-button")).toBeInTheDocument());
      fireEvent.click(screen.getByTestId("applock-fingerprint-button"));

      await waitFor(() => expect(mockedGetPasskeyAssertion).toHaveBeenCalled());
      expect(mockedApi.passkeyLogin).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
    });

    // passkeys is account-wide (any device that ever registered one), so a Touch ID/Windows
    // Hello-capable device with no locally matching credential still passes every check above and
    // only finds out when the ceremony actually fails — see appLock.store.ts's own comment.
    describe("device-local dismiss", () => {
      it("does not show the dismiss link before any attempt has failed", async () => {
        mockedWebAuthnSupported.mockResolvedValue(true);
        mockedApi.listPasskeys.mockResolvedValue([{ id: "p1", nickname: "Phone", createdAt: "2026-01-01" }]);
        renderLockScreen();

        await waitFor(() => expect(screen.getByTestId("applock-fingerprint-button")).toBeInTheDocument());
        expect(screen.queryByTestId("applock-dismiss-passkey")).not.toBeInTheDocument();
      });

      it("shows the dismiss link once a passkey attempt fails on this device", async () => {
        mockedWebAuthnSupported.mockResolvedValue(true);
        mockedApi.listPasskeys.mockResolvedValue([{ id: "p1", nickname: "Phone", createdAt: "2026-01-01" }]);
        mockedApi.getPasskeyLoginOptions.mockResolvedValue({} as never);
        mockedGetPasskeyAssertion.mockRejectedValue(new DOMException("cancelled", "NotAllowedError"));
        renderLockScreen();

        await waitFor(() => expect(screen.getByTestId("applock-fingerprint-button")).toBeInTheDocument());
        fireEvent.click(screen.getByTestId("applock-fingerprint-button"));

        await waitFor(() => expect(screen.getByTestId("applock-dismiss-passkey")).toBeInTheDocument());
      });

      it("hides the fingerprint button and remembers the choice across remounts once dismissed", async () => {
        mockedWebAuthnSupported.mockResolvedValue(true);
        mockedApi.listPasskeys.mockResolvedValue([{ id: "p1", nickname: "Phone", createdAt: "2026-01-01" }]);
        mockedApi.getPasskeyLoginOptions.mockResolvedValue({} as never);
        mockedGetPasskeyAssertion.mockRejectedValue(new DOMException("cancelled", "NotAllowedError"));
        const { unmount } = renderLockScreen();

        await waitFor(() => expect(screen.getByTestId("applock-fingerprint-button")).toBeInTheDocument());
        fireEvent.click(screen.getByTestId("applock-fingerprint-button"));
        await waitFor(() => expect(screen.getByTestId("applock-dismiss-passkey")).toBeInTheDocument());

        fireEvent.click(screen.getByTestId("applock-dismiss-passkey"));
        expect(screen.queryByTestId("applock-fingerprint-button")).not.toBeInTheDocument();
        expect(window.localStorage.getItem("wealthynest:applock:passkeyDismissed")).toBe("true");

        // A fresh mount (e.g. the next time the app re-locks) must stay dismissed too — this is a
        // per-device choice, not a one-render UI toggle.
        unmount();
        renderLockScreen();
        await waitFor(() => expect(mockedApi.listPasskeys).toHaveBeenCalled());
        expect(screen.queryByTestId("applock-fingerprint-button")).not.toBeInTheDocument();
      });
    });

    it("keeps the PIN form visible as a fallback alongside the passkey button", async () => {
      mockedWebAuthnSupported.mockResolvedValue(true);
      mockedApi.listPasskeys.mockResolvedValue([{ id: "p1", nickname: "Phone", createdAt: "2026-01-01" }]);
      renderLockScreen();

      await waitFor(() => expect(screen.getByTestId("applock-fingerprint-button")).toBeInTheDocument());
      expect(screen.getByTestId("applock-pin-input")).toBeInTheDocument();
      expect(screen.getByTestId("applock-pin-submit")).toHaveTextContent("Unlock");
    });

    it("labels the primary button as fingerprint unlock, not generic passkey copy", async () => {
      mockedWebAuthnSupported.mockResolvedValue(true);
      mockedApi.listPasskeys.mockResolvedValue([{ id: "p1", nickname: "Phone", createdAt: "2026-01-01" }]);
      renderLockScreen();

      await waitFor(() => expect(screen.getByTestId("applock-fingerprint-button")).toBeInTheDocument());
      expect(screen.getByText("Unlock with fingerprint")).toBeInTheDocument();
    });
  });

  // Native — a bare BiometricPrompt check with nothing stored behind it. Success clears the lock
  // screen directly (no server round trip), since the session underneath is already valid the
  // whole time the screen is up — see nativeBiometric.ts and the component's own comment.
  describe("native fingerprint", () => {
    it("stays hidden on web even for a PIN account", async () => {
      renderLockScreen();
      await waitFor(() => expect(mockedIsBiometricUnlockEnabled).not.toHaveBeenCalled());
      expect(screen.queryByTestId("applock-fingerprint-button")).not.toBeInTheDocument();
    });

    it("stays hidden natively when the user hasn't turned it on", async () => {
      mockedIsNativePlatform.mockReturnValue(true);
      mockedIsBiometricHardwareAvailable.mockResolvedValue(true);
      mockedIsBiometricUnlockEnabled.mockResolvedValue(false);
      renderLockScreen();
      await waitFor(() => expect(mockedIsBiometricUnlockEnabled).toHaveBeenCalled());
      expect(screen.queryByTestId("applock-fingerprint-button")).not.toBeInTheDocument();
    });

    it("shows the fingerprint button when native, available, and enabled", async () => {
      mockedIsNativePlatform.mockReturnValue(true);
      mockedIsBiometricHardwareAvailable.mockResolvedValue(true);
      mockedIsBiometricUnlockEnabled.mockResolvedValue(true);
      renderLockScreen();
      await waitFor(() => expect(screen.getByTestId("applock-fingerprint-button")).toBeInTheDocument());
    });

    it("unlocks locally on a successful check — no server call, no PIN, no stored secret", async () => {
      useAppLockStore.setState({ isLocked: true });
      mockedIsNativePlatform.mockReturnValue(true);
      mockedIsBiometricHardwareAvailable.mockResolvedValue(true);
      mockedIsBiometricUnlockEnabled.mockResolvedValue(true);
      mockedVerifyBiometric.mockResolvedValue(undefined);
      renderLockScreen();

      await waitFor(() => expect(mockedVerifyBiometric).toHaveBeenCalled());
      expect(mockedApi.pinLogin).not.toHaveBeenCalled();
      expect(mockedApi.passkeyLogin).not.toHaveBeenCalled();
      // unlock() clears the store's isLocked flag directly — no server round trip needed, since
      // the session underneath the lock screen was already valid the whole time.
      await waitFor(() => expect(useAppLockStore.getState().isLocked).toBe(false));
    });

    it("fires the prompt automatically, without a click, as soon as it becomes available", async () => {
      mockedIsNativePlatform.mockReturnValue(true);
      mockedIsBiometricHardwareAvailable.mockResolvedValue(true);
      mockedIsBiometricUnlockEnabled.mockResolvedValue(true);
      mockedVerifyBiometric.mockResolvedValue(undefined);
      renderLockScreen();

      await waitFor(() => expect(mockedVerifyBiometric).toHaveBeenCalledTimes(1));
    });

    // Regression coverage for a real, live bug: showing the native BiometricPrompt pauses the
    // hosting Activity (system UI taking focus), so useAppLockTrigger's pause/resume bridge fires
    // around this ceremony too — a zero-grace lock policy then re-locked the instant the prompt
    // succeeded, which re-fired this same auto-triggering prompt: an infinite loop. AppLockScreen
    // must mark the ceremony as in-flight for the whole time verifyBiometric() is pending, so
    // useAppLockTrigger can tell "our own prompt" apart from "the user actually left the app".
    it("marks the ceremony as in-flight for the whole time verifyBiometric() is pending", async () => {
      const { isBiometricPromptActive, __resetBiometricPromptStateForTests } = await import("../store/appLock.store");
      __resetBiometricPromptStateForTests();
      mockedIsNativePlatform.mockReturnValue(true);
      mockedIsBiometricHardwareAvailable.mockResolvedValue(true);
      mockedIsBiometricUnlockEnabled.mockResolvedValue(true);
      let resolveVerify!: () => void;
      mockedVerifyBiometric.mockReturnValue(new Promise((resolve) => { resolveVerify = resolve; }));
      renderLockScreen();

      await waitFor(() => expect(mockedVerifyBiometric).toHaveBeenCalledTimes(1));
      expect(isBiometricPromptActive()).toBe(true); // still pending

      resolveVerify();
      await waitFor(() => expect(useAppLockStore.getState().isLocked).toBe(false));
      expect(isBiometricPromptActive()).toBe(true); // settled, but still within the post-ceremony tail

      __resetBiometricPromptStateForTests();
    });

    it("silently ignores a cancelled prompt", async () => {
      mockedIsNativePlatform.mockReturnValue(true);
      mockedIsBiometricHardwareAvailable.mockResolvedValue(true);
      mockedIsBiometricUnlockEnabled.mockResolvedValue(true);
      mockedVerifyBiometric.mockRejectedValue(Object.assign(new Error("cancelled"), { code: "userCancel" }));
      mockedIsBiometryError.mockReturnValue(true);
      renderLockScreen();

      await waitFor(() => expect(mockedVerifyBiometric).toHaveBeenCalled());
      expect(toast.error).not.toHaveBeenCalled();
      expect(screen.getByTestId("applock-fingerprint-button")).toBeInTheDocument();
    });

    // The dismiss link exists only because passkey availability is account-wide, not per-device —
    // native's own "enabled" flag is already a per-device preference (see nativeBiometric.ts), so
    // there's no equivalent mismatch here for it to guard against.
    it("never shows the device-local dismiss link, even after a failed attempt", async () => {
      mockedIsNativePlatform.mockReturnValue(true);
      mockedIsBiometricHardwareAvailable.mockResolvedValue(true);
      mockedIsBiometricUnlockEnabled.mockResolvedValue(true);
      mockedVerifyBiometric.mockRejectedValue(new Error("sensor error"));
      renderLockScreen();

      await waitFor(() => expect(mockedVerifyBiometric).toHaveBeenCalled());
      expect(screen.queryByTestId("applock-dismiss-passkey")).not.toBeInTheDocument();
    });

    // GPay-style minimal screen: the PIN form is NOT rendered up front alongside the auto-fired
    // prompt (unlike the web/passkey card, which keeps it visible — see that describe block's own
    // "keeps the PIN form visible" test) — it only appears once the user explicitly asks for it.
    describe("minimal screen / PIN fallback toggle", () => {
      it("hides the PIN form until 'Enter PIN instead' is tapped", async () => {
        mockedIsNativePlatform.mockReturnValue(true);
        mockedIsBiometricHardwareAvailable.mockResolvedValue(true);
        mockedIsBiometricUnlockEnabled.mockResolvedValue(true);
        renderLockScreen();

        await waitFor(() => expect(screen.getByTestId("applock-fingerprint-button")).toBeInTheDocument());
        expect(screen.queryByTestId("applock-pin-input")).not.toBeInTheDocument();

        fireEvent.click(screen.getByTestId("applock-show-pin"));
        expect(screen.getByTestId("applock-pin-input")).toBeInTheDocument();
        expect(screen.getByTestId("applock-pin-submit")).toHaveTextContent("Unlock");
      });

      it("does not offer 'Enter PIN instead' when the account has no PIN set up", async () => {
        useAuthStore.setState({ user: { ...user, pinEnabled: false } });
        mockedIsNativePlatform.mockReturnValue(true);
        mockedIsBiometricHardwareAvailable.mockResolvedValue(true);
        mockedIsBiometricUnlockEnabled.mockResolvedValue(true);
        renderLockScreen();

        await waitFor(() => expect(screen.getByTestId("applock-fingerprint-button")).toBeInTheDocument());
        expect(screen.queryByTestId("applock-show-pin")).not.toBeInTheDocument();
      });

      it("returns to the fingerprint face via 'Use fingerprint instead', clearing anything typed", async () => {
        mockedIsNativePlatform.mockReturnValue(true);
        mockedIsBiometricHardwareAvailable.mockResolvedValue(true);
        mockedIsBiometricUnlockEnabled.mockResolvedValue(true);
        renderLockScreen();

        await waitFor(() => expect(screen.getByTestId("applock-fingerprint-button")).toBeInTheDocument());
        fireEvent.click(screen.getByTestId("applock-show-pin"));
        fireEvent.change(screen.getByTestId("applock-pin-input"), { target: { value: "12" } });

        fireEvent.click(screen.getByTestId("applock-back-to-fingerprint"));
        expect(screen.queryByTestId("applock-pin-input")).not.toBeInTheDocument();
        expect(screen.getByTestId("applock-fingerprint-button")).toBeInTheDocument();

        fireEvent.click(screen.getByTestId("applock-show-pin"));
        expect((screen.getByTestId("applock-pin-input") as HTMLInputElement).value).toBe("");
      });

      it("guards 'Sign out & use password' behind the same confirm dialog on the minimal screen", async () => {
        mockedIsNativePlatform.mockReturnValue(true);
        mockedIsBiometricHardwareAvailable.mockResolvedValue(true);
        mockedIsBiometricUnlockEnabled.mockResolvedValue(true);
        renderLockScreen();

        await waitFor(() => expect(screen.getByTestId("applock-fingerprint-button")).toBeInTheDocument());
        fireEvent.click(screen.getByTestId("applock-use-password"));
        expect(mockedApi.logout).not.toHaveBeenCalled();
        expect(screen.getByTestId("confirm-dialog-confirm")).toBeInTheDocument();
      });

      it("still auto-submits a PIN typed after switching to the PIN fallback", async () => {
        mockedApi.pinLogin.mockResolvedValue({
          accessToken: "at2", user, expiresIn: 3600, tokenType: "Bearer",
        });
        mockedIsNativePlatform.mockReturnValue(true);
        mockedIsBiometricHardwareAvailable.mockResolvedValue(true);
        mockedIsBiometricUnlockEnabled.mockResolvedValue(true);
        renderLockScreen();

        await waitFor(() => expect(screen.getByTestId("applock-fingerprint-button")).toBeInTheDocument());
        fireEvent.click(screen.getByTestId("applock-show-pin"));
        fireEvent.change(screen.getByTestId("applock-pin-input"), { target: { value: "1234" } });

        await waitFor(() => expect(mockedApi.pinLogin).toHaveBeenCalledWith("1234"));
      });
    });
  });
});
