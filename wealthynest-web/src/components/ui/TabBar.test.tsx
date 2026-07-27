import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Wallet, Landmark, Banknote } from "lucide-react";
import { TabBar, type TabBarItem } from "./TabBar";

type Key = "all" | "bank" | "cash";

const items: TabBarItem<Key>[] = [
  { key: "all",  label: "All",  icon: Wallet,    color: "#475569" },
  { key: "bank", label: "Bank", icon: Landmark,  color: "#4f46e5", count: 4 },
  { key: "cash", label: "Cash", icon: Banknote,  color: "#059669", count: 0 },
];

class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

beforeEach(() => {
  // jsdom has no layout engine, and doesn't implement scrollIntoView or ResizeObserver at all —
  // the component calls scrollIntoView on every active-tab change to keep the selection in view
  // on a scrolled rail, and watches the active button with a ResizeObserver to catch a post-mount
  // webfont reflow the initial synchronous measurement could otherwise miss.
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal("ResizeObserver", MockResizeObserver);
});

describe("TabBar", () => {
  it("renders every item's label", () => {
    render(<TabBar items={items} value="all" onChange={vi.fn()} />);
    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByText("Bank")).toBeInTheDocument();
    expect(screen.getByText("Cash")).toBeInTheDocument();
  });

  it("marks the active item as the selected tab", () => {
    render(<TabBar items={items} value="bank" onChange={vi.fn()} />);
    expect(screen.getByRole("tab", { name: /Bank/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /All/ })).toHaveAttribute("aria-selected", "false");
  });

  it("calls onChange with the clicked item's key", async () => {
    const onChange = vi.fn();
    render(<TabBar items={items} value="all" onChange={onChange} />);
    await userEvent.click(screen.getByRole("tab", { name: /Cash/ }));
    expect(onChange).toHaveBeenCalledWith("cash");
  });

  it("shows a count badge only for items with a truthy count", () => {
    render(<TabBar items={items} value="all" onChange={vi.fn()} />);
    expect(screen.getByText("4")).toBeInTheDocument(); // Bank
    // "All" has no count field, "Cash" has count 0 — neither renders a badge.
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("prefixes each tab's data-testid when testIdPrefix is given", () => {
    render(<TabBar items={items} value="all" onChange={vi.fn()} testIdPrefix="account-filter" />);
    expect(screen.getByTestId("account-filter-all")).toBeInTheDocument();
    expect(screen.getByTestId("account-filter-bank")).toBeInTheDocument();
    expect(screen.getByTestId("account-filter-cash")).toBeInTheDocument();
  });

  it("omits data-testid entirely when no testIdPrefix is given", () => {
    render(<TabBar items={items} value="all" onChange={vi.fn()} />);
    expect(screen.getByRole("tab", { name: /All/ })).not.toHaveAttribute("data-testid");
  });
});
