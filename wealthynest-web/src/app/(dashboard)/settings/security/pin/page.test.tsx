import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
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
// Isolates this test from Header/PageWrapper's own dependency trees (notifications, UI store,
// etc.) — irrelevant chrome for what this test is actually verifying.
vi.mock("@/components/layout/Header", () => ({ Header: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock("@/components/layout/PageWrapper", () => ({ PageWrapper: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

const mockedApi = vi.mocked(authApi);

const user: User = {
  id: "u1", fullName: "Alice Smith", email: "a@x.com", role: "MEMBER",
  active: true, createdAt: "2026-01-01", pinEnabled: false,
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <SetupPinPage />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ user, accessToken: "at", isAuthenticated: true, userVersion: 0 });
});

describe("SetupPinPage", () => {
  it("autofocuses the choose-PIN input on load — no click needed to start typing", () => {
    renderPage();
    expect(screen.getByTestId("pin-setup-choose-input")).toHaveFocus();
  });

  it("has no password field anywhere in the flow", () => {
    renderPage();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
  });

  it("advances to the confirm step automatically once 4 digits are entered, and autofocuses that input too", async () => {
    renderPage();
    fireEvent.change(screen.getByTestId("pin-setup-choose-input"), { target: { value: "1234" } });

    await waitFor(() => expect(screen.getByTestId("pin-setup-confirm-input")).toBeInTheDocument());
    expect(screen.getByTestId("pin-setup-confirm-input")).toHaveFocus();
  });

  it("strips non-digit characters and caps at 4", () => {
    renderPage();
    const input = screen.getByTestId("pin-setup-choose-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "1a2b3c4d5" } });
    expect(input.value).toBe("1234");
  });

  it("submits with no password when the confirm PIN matches, and redirects to Security on success", async () => {
    mockedApi.enablePin.mockResolvedValue(undefined);
    renderPage();

    fireEvent.change(screen.getByTestId("pin-setup-choose-input"), { target: { value: "1234" } });
    await waitFor(() => expect(screen.getByTestId("pin-setup-confirm-input")).toBeInTheDocument());
    fireEvent.change(screen.getByTestId("pin-setup-confirm-input"), { target: { value: "1234" } });

    await waitFor(() => expect(mockedApi.enablePin).toHaveBeenCalledWith("1234"));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/settings/security"));
  });

  it("shows a mismatch error and clears the confirm field, without submitting, when the PINs differ", async () => {
    renderPage();

    fireEvent.change(screen.getByTestId("pin-setup-choose-input"), { target: { value: "1234" } });
    await waitFor(() => expect(screen.getByTestId("pin-setup-confirm-input")).toBeInTheDocument());
    fireEvent.change(screen.getByTestId("pin-setup-confirm-input"), { target: { value: "9999" } });

    await waitFor(() => expect(screen.getByText("PINs didn't match — try again")).toBeInTheDocument());
    expect(mockedApi.enablePin).not.toHaveBeenCalled();

    await waitFor(() => expect((screen.getByTestId("pin-setup-confirm-input") as HTMLInputElement).value).toBe(""));
  });

  it("'Start over' resets both steps back to choosing a PIN", async () => {
    renderPage();

    fireEvent.change(screen.getByTestId("pin-setup-choose-input"), { target: { value: "1234" } });
    await waitFor(() => expect(screen.getByTestId("pin-setup-start-over")).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("pin-setup-start-over"));

    await waitFor(() => expect(screen.getByTestId("pin-setup-choose-input")).toBeInTheDocument());
    expect((screen.getByTestId("pin-setup-choose-input") as HTMLInputElement).value).toBe("");
  });

  it("links back to Security on the first step", () => {
    renderPage();
    expect(screen.getByTestId("pin-setup-back-link")).toHaveAttribute("href", "/settings/security");
  });
});
