import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { Capacitor } from "@capacitor/core";
import SetupPinPage from "./page";
import { authApi } from "@/features/auth/api/auth.api";
import { useAuthStore } from "@/features/auth/store/auth.store";
import type { User } from "@/features/auth/types/auth.types";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }), usePathname: () => "/settings/security/pin" }));
vi.mock("@/features/auth/api/auth.api", () => ({
  authApi: { enablePin: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
// Defaults to web (not native) — the dedicated native-fullscreen test below overrides this.
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: vi.fn(() => false) },
}));
// Isolates this test from Header/PageWrapper's own dependency trees (notifications, UI store,
// etc.) — irrelevant chrome for what this test is actually verifying. Also doubles as the "did
// the dashboard chrome render at all" signal for the native-vs-web split below.
vi.mock("@/components/layout/Header", () => ({ Header: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock("@/components/layout/PageWrapper", () => ({ PageWrapper: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

const mockedApi = vi.mocked(authApi);
const mockedIsNativePlatform = vi.mocked(Capacitor.isNativePlatform);

const user: User = {
  id: "u1", fullName: "Alice Smith", email: "a@x.com", role: "MEMBER",
  active: true, createdAt: "2026-01-01", pinEnabled: false, hasPasskeys: false, loginAlertEnabled: true,
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <SetupPinPage />
    </QueryClientProvider>
  );
}

/** Taps the on-screen keypad — the whole point of this page is that entry never touches a real
 * keyboard, so every test drives it through the same buttons a user would tap. */
function tapDigits(digits: string) {
  for (const d of digits) fireEvent.click(screen.getByTestId(`pin-keypad-${d}`));
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ user, accessToken: "at", isAuthenticated: true, userVersion: 0 });
});

describe("SetupPinPage", () => {
  it("renders a full keypad — digits 0-9 and a backspace key, no text input anywhere", () => {
    renderPage();
    for (const d of "0123456789") expect(screen.getByTestId(`pin-keypad-${d}`)).toBeInTheDocument();
    expect(screen.getByTestId("pin-keypad-backspace")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("has no password field anywhere in the flow", () => {
    renderPage();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
  });

  it("fills a cell per keypad tap and advances to the confirm step automatically after 4 digits", async () => {
    renderPage();
    tapDigits("1234");
    await waitFor(() => expect(screen.getByText("Confirm your PIN")).toBeInTheDocument());
  });

  it("backspace removes the last entered digit without advancing", () => {
    renderPage();
    tapDigits("12");
    fireEvent.click(screen.getByTestId("pin-keypad-backspace"));
    // Still on the choose step — cells show exactly 1 filled, not advanced or reset.
    const cells = screen.getAllByTestId("pin-setup-cell");
    expect(cells[0]).toHaveClass("border-brand-500");
    expect(cells[1]).not.toHaveClass("border-brand-500");
  });

  it("submits with no password when the confirm PIN matches, and redirects to Security on success", async () => {
    mockedApi.enablePin.mockResolvedValue(undefined);
    renderPage();

    tapDigits("1234");
    await waitFor(() => expect(screen.getByText("Confirm your PIN")).toBeInTheDocument());
    tapDigits("1234");

    await waitFor(() => expect(mockedApi.enablePin).toHaveBeenCalledWith("1234", undefined));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/settings/security"));
  });

  it("shows a mismatch error and resets the confirm step, without submitting, when the PINs differ", async () => {
    renderPage();

    tapDigits("1234");
    await waitFor(() => expect(screen.getByText("Confirm your PIN")).toBeInTheDocument());
    tapDigits("9999");

    await waitFor(() => expect(screen.getByText("PINs didn't match — try again")).toBeInTheDocument());
    expect(mockedApi.enablePin).not.toHaveBeenCalled();

    await waitFor(() => {
      const cells = screen.getAllByTestId("pin-setup-cell");
      expect(cells.every((c) => !c.classList.contains("border-brand-500"))).toBe(true);
    });
  });

  it("'Start over' resets both steps back to choosing a PIN", async () => {
    renderPage();

    tapDigits("1234");
    await waitFor(() => expect(screen.getByTestId("pin-setup-start-over")).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("pin-setup-start-over"));

    await waitFor(() => expect(screen.getByText("Choose your PIN")).toBeInTheDocument());
    const cells = screen.getAllByTestId("pin-setup-cell");
    expect(cells.every((c) => !c.classList.contains("border-brand-500"))).toBe(true);
  });

  it("close button navigates back to Security", () => {
    renderPage();
    fireEvent.click(screen.getByTestId("pin-setup-close"));
    expect(pushMock).toHaveBeenCalledWith("/settings/security");
  });

  it("renders inside the normal dashboard chrome (Header/PageWrapper) on web", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Set up PIN")).toBeInTheDocument());
    expect(screen.queryByTestId("pin-setup-fullscreen")).not.toBeInTheDocument();
  });

  describe("on the native app", () => {
    beforeEach(() => mockedIsNativePlatform.mockReturnValue(true));

    it("renders full screen with no dashboard chrome, keypad and cells still work the same", async () => {
      renderPage();
      await waitFor(() => expect(screen.getByTestId("pin-setup-fullscreen")).toBeInTheDocument());
      // Header/PageWrapper are skipped entirely, not just hidden — the mocked Header's "Set up PIN"
      // title never renders in this branch.
      expect(screen.queryByText("Set up PIN")).not.toBeInTheDocument();

      tapDigits("1234");
      await waitFor(() => expect(screen.getByText("Confirm your PIN")).toBeInTheDocument());
    });
  });
});
