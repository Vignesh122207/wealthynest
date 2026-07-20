import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { AppLockScreen } from "./AppLockScreen";
import { useAuthStore } from "../store/auth.store";
import { authApi } from "../api/auth.api";
import { isWebAuthnSupported } from "../utils/webauthn";
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
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockedApi = vi.mocked(authApi);
const mockedWebAuthnSupported = vi.mocked(isWebAuthnSupported);

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
});
