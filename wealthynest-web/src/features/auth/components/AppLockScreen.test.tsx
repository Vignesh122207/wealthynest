import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { AppLockScreen } from "./AppLockScreen";
import { useAuthStore } from "../store/auth.store";
import { authApi } from "../api/auth.api";
import { isWebAuthnSupported } from "../utils/webauthn";
import { isNativePlatform, isNativeBiometricAvailable, hasBiometricPinStored, retrievePinViaBiometric, isBiometryError } from "../utils/nativeBiometric";
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
  isWebAuthnSupported: vi.fn(() => false),
  getPasskeyAssertion: vi.fn(),
}));
vi.mock("../utils/nativeBiometric", () => ({
  BiometryErrorType: { userCancel: "userCancel", appCancel: "appCancel" },
  isNativePlatform: vi.fn(() => false),
  isNativeBiometricAvailable: vi.fn(() => Promise.resolve(false)),
  hasBiometricPinStored: vi.fn(() => Promise.resolve(false)),
  retrievePinViaBiometric: vi.fn(),
  isBiometryError: vi.fn(() => false),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockedApi = vi.mocked(authApi);
const mockedWebAuthnSupported = vi.mocked(isWebAuthnSupported);
const mockedIsNativePlatform = vi.mocked(isNativePlatform);
const mockedIsNativeBiometricAvailable = vi.mocked(isNativeBiometricAvailable);
const mockedHasBiometricPinStored = vi.mocked(hasBiometricPinStored);
const mockedRetrievePinViaBiometric = vi.mocked(retrievePinViaBiometric);
const mockedIsBiometryError = vi.mocked(isBiometryError);

const user: User = {
  id: "u1", fullName: "Alice Smith", email: "a@x.com", role: "MEMBER",
  active: true, createdAt: "2026-01-01", pinEnabled: true,
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
  mockedWebAuthnSupported.mockReturnValue(false);
  mockedApi.listPasskeys.mockResolvedValue([]);
  mockedIsNativePlatform.mockReturnValue(false);
  mockedIsNativeBiometricAvailable.mockResolvedValue(false);
  mockedHasBiometricPinStored.mockResolvedValue(false);
  useAuthStore.setState({
    user, accessToken: "at", refreshToken: "rt", isAuthenticated: true, userVersion: 0,
  });
});

describe("AppLockScreen", () => {
  it("greets the user by first name", () => {
    renderLockScreen();
    expect(screen.getByText(/Welcome back, Alice/)).toBeInTheDocument();
  });

  it("renders nothing when there is no active user", () => {
    useAuthStore.setState({ user: null });
    const { container } = renderLockScreen();
    expect(container).toBeEmptyDOMElement();
  });

  it("disables the unlock button until at least 4 digits are entered", () => {
    renderLockScreen();
    const submit = screen.getByTestId("applock-pin-submit");
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByTestId("applock-pin-input"), { target: { value: "123" } });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByTestId("applock-pin-input"), { target: { value: "1234" } });
    expect(submit).not.toBeDisabled();
  });

  it("strips non-digit characters from the PIN input", () => {
    renderLockScreen();
    const input = screen.getByTestId("applock-pin-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "12a3b4" } });
    expect(input.value).toBe("1234");
  });

  it("unlocking with the correct PIN clears the lock store without navigating away", async () => {
    mockedApi.pinLogin.mockResolvedValue({
      accessToken: "at2", refreshToken: "rt2", user, expiresIn: 3600, tokenType: "Bearer",
    });
    renderLockScreen();

    fireEvent.change(screen.getByTestId("applock-pin-input"), { target: { value: "1234" } });
    fireEvent.click(screen.getByTestId("applock-pin-submit"));

    await waitFor(() => expect(mockedApi.pinLogin).toHaveBeenCalledWith("rt", "1234"));
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("hides the passkey button when WebAuthn isn't supported", () => {
    mockedWebAuthnSupported.mockReturnValue(false);
    mockedApi.listPasskeys.mockResolvedValue([{ id: "p1", nickname: "Phone", createdAt: "2026-01-01" }]);
    renderLockScreen();
    expect(screen.queryByTestId("applock-passkey-button")).not.toBeInTheDocument();
  });

  it("shows the passkey button when WebAuthn is supported and the account has a registered passkey", async () => {
    mockedWebAuthnSupported.mockReturnValue(true);
    mockedApi.listPasskeys.mockResolvedValue([{ id: "p1", nickname: "Phone", createdAt: "2026-01-01" }]);
    renderLockScreen();
    await waitFor(() => expect(screen.getByTestId("applock-passkey-button")).toBeInTheDocument());
  });

  // The bug this guards against: the button used to be shown purely off browser capability, so a
  // PIN-only account with zero registered passkeys still saw a passkey button that could only ever
  // fail when clicked.
  it("hides the passkey button when WebAuthn is supported but the account has no registered passkeys", async () => {
    mockedWebAuthnSupported.mockReturnValue(true);
    mockedApi.listPasskeys.mockResolvedValue([]);
    renderLockScreen();
    await waitFor(() => expect(mockedApi.listPasskeys).toHaveBeenCalled());
    expect(screen.queryByTestId("applock-passkey-button")).not.toBeInTheDocument();
  });

  // The other half of the same bug: the PIN form used to render unconditionally, so a
  // passkey-only account (no PIN configured) was still forced to look at a PIN box that could
  // never succeed.
  it("hides the PIN form when the account has no PIN configured", () => {
    useAuthStore.setState({ user: { ...user, pinEnabled: false } });
    mockedWebAuthnSupported.mockReturnValue(true);
    mockedApi.listPasskeys.mockResolvedValue([{ id: "p1", nickname: "Phone", createdAt: "2026-01-01" }]);
    renderLockScreen();
    expect(screen.queryByTestId("applock-pin-input")).not.toBeInTheDocument();
  });

  it("'Not you? Sign out' calls the logout endpoint", async () => {
    mockedApi.logout.mockResolvedValue(undefined);
    renderLockScreen();

    fireEvent.click(screen.getByTestId("applock-sign-out"));

    await waitFor(() => expect(mockedApi.logout).toHaveBeenCalledWith("rt"));
    expect(pushMock).toHaveBeenCalledWith("/login");
  });

  describe("native biometric unlock", () => {
    it("stays hidden on web even for a PIN account", async () => {
      renderLockScreen();
      await waitFor(() => expect(mockedHasBiometricPinStored).not.toHaveBeenCalled());
      expect(screen.queryByTestId("applock-biometric-button")).not.toBeInTheDocument();
    });

    it("stays hidden natively when the device has no PIN saved to secure storage", async () => {
      mockedIsNativePlatform.mockReturnValue(true);
      mockedIsNativeBiometricAvailable.mockResolvedValue(true);
      mockedHasBiometricPinStored.mockResolvedValue(false);
      renderLockScreen();
      await waitFor(() => expect(mockedHasBiometricPinStored).toHaveBeenCalled());
      expect(screen.queryByTestId("applock-biometric-button")).not.toBeInTheDocument();
    });

    it("stays hidden for a passkey-only account even if biometrics happen to be available", async () => {
      useAuthStore.setState({ user: { ...user, pinEnabled: false } });
      mockedIsNativePlatform.mockReturnValue(true);
      mockedIsNativeBiometricAvailable.mockResolvedValue(true);
      mockedHasBiometricPinStored.mockResolvedValue(true);
      renderLockScreen();
      await waitFor(() => expect(mockedHasBiometricPinStored).toHaveBeenCalled());
      expect(screen.queryByTestId("applock-biometric-button")).not.toBeInTheDocument();
    });

    it("shows the biometric button when native, available, and a PIN is stored", async () => {
      mockedIsNativePlatform.mockReturnValue(true);
      mockedIsNativeBiometricAvailable.mockResolvedValue(true);
      mockedHasBiometricPinStored.mockResolvedValue(true);
      renderLockScreen();
      await waitFor(() => expect(screen.getByTestId("applock-biometric-button")).toBeInTheDocument());
    });

    it("retrieves the PIN via biometric and unlocks through the same server-verified PIN login", async () => {
      mockedIsNativePlatform.mockReturnValue(true);
      mockedIsNativeBiometricAvailable.mockResolvedValue(true);
      mockedHasBiometricPinStored.mockResolvedValue(true);
      mockedRetrievePinViaBiometric.mockResolvedValue("9012");
      mockedApi.pinLogin.mockResolvedValue({
        accessToken: "at3", refreshToken: "rt3", user, expiresIn: 3600, tokenType: "Bearer",
      });
      renderLockScreen();

      await waitFor(() => expect(screen.getByTestId("applock-biometric-button")).toBeInTheDocument());
      fireEvent.click(screen.getByTestId("applock-biometric-button"));

      await waitFor(() => expect(mockedApi.pinLogin).toHaveBeenCalledWith("rt", "9012"));
    });

    it("silently ignores a cancelled biometric prompt", async () => {
      mockedIsNativePlatform.mockReturnValue(true);
      mockedIsNativeBiometricAvailable.mockResolvedValue(true);
      mockedHasBiometricPinStored.mockResolvedValue(true);
      mockedRetrievePinViaBiometric.mockRejectedValue(Object.assign(new Error("cancelled"), { code: "userCancel" }));
      mockedIsBiometryError.mockReturnValue(true);
      renderLockScreen();

      await waitFor(() => expect(screen.getByTestId("applock-biometric-button")).toBeInTheDocument());
      fireEvent.click(screen.getByTestId("applock-biometric-button"));

      await waitFor(() => expect(mockedRetrievePinViaBiometric).toHaveBeenCalled());
      expect(mockedApi.pinLogin).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
    });
  });
});
