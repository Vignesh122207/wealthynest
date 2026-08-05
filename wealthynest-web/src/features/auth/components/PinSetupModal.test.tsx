import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { PinSetupModal } from "./PinSetupModal";
import { useAuthStore } from "../store/auth.store";
import { authApi } from "../api/auth.api";
import type { User } from "../types/auth.types";

vi.mock("../api/auth.api", () => ({
  authApi: { enablePin: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockedApi = vi.mocked(authApi);

const baseUser: User = {
  id: "u1", fullName: "Alice Smith", email: "a@x.com", role: "MEMBER",
  active: true, createdAt: "2026-01-01", pinEnabled: false, hasPasskeys: false, loginAlertEnabled: true,
};

function renderModal(props: Partial<{ currentPassword: string }> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const onClose = vi.fn();
  const onSuccess = vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <PinSetupModal onClose={onClose} onSuccess={onSuccess} {...props} />
    </QueryClientProvider>
  );
  return { onClose, onSuccess };
}

/** Taps the on-screen keypad — same convention as settings/security/pin/page.test.tsx. */
function tapDigits(digits: string) {
  for (const d of digits) fireEvent.click(screen.getByTestId(`pin-keypad-${d}`));
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ user: baseUser, accessToken: "at", isAuthenticated: true, userVersion: 0 });
});

describe("PinSetupModal", () => {
  describe("first-time setup (no PIN configured yet)", () => {
    it("goes straight to choosing a PIN, with no password step", () => {
      renderModal();
      expect(screen.queryByTestId("pin-setup-password-input")).not.toBeInTheDocument();
      expect(screen.getByText("Choose your PIN")).toBeInTheDocument();
    });

    it("enables the PIN with no currentPassword once chosen and confirmed", async () => {
      mockedApi.enablePin.mockResolvedValue(undefined);
      const { onSuccess } = renderModal();

      tapDigits("1234");
      await waitFor(() => expect(screen.getByText("Confirm your PIN")).toBeInTheDocument());
      tapDigits("1234");

      await waitFor(() => expect(mockedApi.enablePin).toHaveBeenCalledWith("1234", undefined));
      await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    });
  });

  // Regression coverage for a real gap: "Forgot your PIN?" deliberately skips proving the OLD
  // pin, which meant anyone holding an already-unlocked device could silently swap in their own
  // PIN with zero proof of anything at all — see AuthServiceImpl#enablePin's own comment. These
  // exercise the password step that closes that gap.
  describe("replacing an already-set PIN", () => {
    beforeEach(() => {
      useAuthStore.setState({ user: { ...baseUser, pinEnabled: true } });
    });

    it("shows a password step before the PIN choose/confirm flow", () => {
      renderModal();
      expect(screen.getByText("Confirm your password")).toBeInTheDocument();
      expect(screen.queryByText("Choose your PIN")).not.toBeInTheDocument();
    });

    it("proceeds to PIN setup and passes the password through once confirmed", async () => {
      mockedApi.enablePin.mockResolvedValue(undefined);
      renderModal();

      fireEvent.change(screen.getByTestId("pin-setup-password-input"), { target: { value: "hunter2" } });
      fireEvent.click(screen.getByTestId("pin-setup-password-submit"));

      await waitFor(() => expect(screen.getByText("Choose your PIN")).toBeInTheDocument());
      tapDigits("5678");
      await waitFor(() => expect(screen.getByText("Confirm your PIN")).toBeInTheDocument());
      tapDigits("5678");

      await waitFor(() => expect(mockedApi.enablePin).toHaveBeenCalledWith("5678", "hunter2"));
    });

    it("skips the password step when a currentPassword is already supplied (post sign-out/sign-in redirect)", () => {
      renderModal({ currentPassword: "already-proven" });
      expect(screen.queryByText("Confirm your password")).not.toBeInTheDocument();
      expect(screen.getByText("Choose your PIN")).toBeInTheDocument();
    });

    it("sends the user back to the password step with an inline error on a wrong password, instead of silently clearing the PIN", async () => {
      mockedApi.enablePin.mockRejectedValue({
        response: { data: { error: "WRONG_PASSWORD", message: "Current password is incorrect" } },
      });
      renderModal();

      fireEvent.change(screen.getByTestId("pin-setup-password-input"), { target: { value: "wrong-pass" } });
      fireEvent.click(screen.getByTestId("pin-setup-password-submit"));

      await waitFor(() => expect(screen.getByText("Choose your PIN")).toBeInTheDocument());
      tapDigits("5678");
      await waitFor(() => expect(screen.getByText("Confirm your PIN")).toBeInTheDocument());
      tapDigits("5678");

      await waitFor(() => expect(screen.getByText("Confirm your password")).toBeInTheDocument());
      expect(screen.getByText("Incorrect password")).toBeInTheDocument();
    });

    // Regression coverage for a real bug found in review, before it could reach production:
    // usePinEntryFlow only ever clears its entered PIN through the onError callback it hands to
    // onConfirmed — the WRONG_PASSWORD branch above skips calling that (a PIN mismatch isn't what
    // happened), so without an explicit startOver() the retry below would have landed back on
    // "Confirm your PIN" already showing 4 filled, un-editable cells from the failed attempt, with
    // no way to type a fresh PIN over it.
    it("lets a full retry succeed after a wrong password — the PIN entry doesn't get stuck", async () => {
      mockedApi.enablePin
        .mockRejectedValueOnce({ response: { data: { error: "WRONG_PASSWORD", message: "Current password is incorrect" } } })
        .mockResolvedValueOnce(undefined);
      const { onSuccess } = renderModal();

      fireEvent.change(screen.getByTestId("pin-setup-password-input"), { target: { value: "wrong-pass" } });
      fireEvent.click(screen.getByTestId("pin-setup-password-submit"));
      await waitFor(() => expect(screen.getByText("Choose your PIN")).toBeInTheDocument());
      tapDigits("5678");
      await waitFor(() => expect(screen.getByText("Confirm your PIN")).toBeInTheDocument());
      tapDigits("5678");
      await waitFor(() => expect(screen.getByText("Confirm your password")).toBeInTheDocument());

      fireEvent.change(screen.getByTestId("pin-setup-password-input"), { target: { value: "correct-pass" } });
      fireEvent.click(screen.getByTestId("pin-setup-password-submit"));

      // Lands back on "Choose your PIN" fresh (not "Confirm your PIN" pre-filled from the failed
      // attempt) — proof the entry state was actually reset, not just the password.
      await waitFor(() => expect(screen.getByText("Choose your PIN")).toBeInTheDocument());
      tapDigits("9999");
      await waitFor(() => expect(screen.getByText("Confirm your PIN")).toBeInTheDocument());
      tapDigits("9999");

      await waitFor(() => expect(mockedApi.enablePin).toHaveBeenLastCalledWith("9999", "correct-pass"));
      await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    });
  });
});
