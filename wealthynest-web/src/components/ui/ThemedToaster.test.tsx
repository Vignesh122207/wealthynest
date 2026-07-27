import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { ThemedToaster } from "./ThemedToaster";
import { useTheme } from "next-themes";

vi.mock("next-themes", () => ({ useTheme: vi.fn() }));
vi.mock("sonner", () => ({ Toaster: (props: Record<string, unknown>) => <div data-testid="toaster" data-theme={String(props.theme)} /> }));

const mockedUseTheme = vi.mocked(useTheme);

describe("ThemedToaster", () => {
  it("passes theme=\"dark\" to Toaster when the app theme is dark", () => {
    mockedUseTheme.mockReturnValue({ theme: "dark" } as never);
    const { getByTestId } = render(<ThemedToaster />);
    expect(getByTestId("toaster")).toHaveAttribute("data-theme", "dark");
  });

  it("passes theme=\"light\" when the app theme is light", () => {
    mockedUseTheme.mockReturnValue({ theme: "light" } as never);
    const { getByTestId } = render(<ThemedToaster />);
    expect(getByTestId("toaster")).toHaveAttribute("data-theme", "light");
  });

  it("falls back to theme=\"light\" when the theme is undefined (not yet resolved)", () => {
    mockedUseTheme.mockReturnValue({ theme: undefined } as never);
    const { getByTestId } = render(<ThemedToaster />);
    expect(getByTestId("toaster")).toHaveAttribute("data-theme", "light");
  });
});
