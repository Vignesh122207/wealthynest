import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { Capacitor } from "@capacitor/core";
import { SecuritySetupPrompt } from "./SecuritySetupPrompt";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useNativeBiometricStatus } from "@/features/auth/hooks/useNativeBiometric";
import type { User } from "@/features/auth/types/auth.types";

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: vi.fn(() => true) },
}));
vi.mock("@/features/auth/hooks/useNativeBiometric", () => ({
  useNativeBiometricStatus: vi.fn(),
}));

const mockedIsNativePlatform = vi.mocked(Capacitor.isNativePlatform);
const mockedUseNativeBiometricStatus = vi.mocked(useNativeBiometricStatus);

const user: User = {
  id: "u1", fullName: "Alice Smith", email: "a@x.com", role: "MEMBER",
  active: true, createdAt: "2026-01-01", pinEnabled: false,
};

function renderPrompt() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <SecuritySetupPrompt />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedIsNativePlatform.mockReturnValue(true);
  mockedUseNativeBiometricStatus.mockReturnValue({ data: { available: true, enabled: false } } as never);
  localStorage.clear();
  useAuthStore.setState({ user, accessToken: "at", isAuthenticated: true, userVersion: 0 });
});

describe("SecuritySetupPrompt", () => {
  it("renders nothing on a non-native platform", () => {
    mockedIsNativePlatform.mockReturnValue(false);
    const { container } = renderPrompt();
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing once both PIN and fingerprint are set up", () => {
    useAuthStore.setState({ user: { ...user, pinEnabled: true } });
    mockedUseNativeBiometricStatus.mockReturnValue({ data: { available: true, enabled: true } } as never);
    const { container } = renderPrompt();
    expect(container).toBeEmptyDOMElement();
  });

  it("offers 'Set up PIN' when PIN isn't enabled", () => {
    renderPrompt();
    expect(screen.getByTestId("security-setup-prompt-pin")).toHaveTextContent("Set up PIN");
  });

  // The bug this guards against: fingerprint used to be gated behind PIN being set up first
  // ("Set up a PIN first", disabled) — a bare biometric toggle has nothing stored behind it, so it
  // must be independently settable regardless of PIN status.
  it("offers 'Set up fingerprint' even when PIN isn't enabled — not gated behind PIN", () => {
    renderPrompt();
    const link = screen.getByTestId("security-setup-prompt-fingerprint");
    expect(link).toHaveTextContent("Set up fingerprint");
    expect(screen.queryByTestId("security-setup-prompt-fingerprint-locked")).not.toBeInTheDocument();
  });

  it("shows 'Fingerprint enabled' once the device has fingerprint unlock turned on", () => {
    mockedUseNativeBiometricStatus.mockReturnValue({ data: { available: true, enabled: true } } as never);
    renderPrompt();
    expect(screen.getByText("Fingerprint enabled")).toBeInTheDocument();
  });

  it("dismisses and persists the dismissal per-user", () => {
    renderPrompt();
    fireEvent.click(screen.getByTestId("security-setup-prompt-dismiss"));
    expect(screen.queryByTestId("security-setup-prompt")).not.toBeInTheDocument();
    expect(localStorage.getItem("wealthynest:securitySetupPromptDismissed:u1")).toBe("true");
  });
});
