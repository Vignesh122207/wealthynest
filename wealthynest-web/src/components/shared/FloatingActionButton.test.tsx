import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FloatingActionButton, type FabAction } from "./FloatingActionButton";
import { Plus } from "lucide-react";

function buildActions(overrides: Partial<FabAction>[] = []): FabAction[] {
  const base: FabAction = { icon: Plus, label: "Add Expense", color: "rose", onClick: vi.fn() };
  return overrides.length
    ? overrides.map((o) => ({ ...base, onClick: vi.fn(), ...o }))
    : [base];
}

describe("FloatingActionButton", () => {
  it("starts closed — no action items rendered", () => {
    render(<FloatingActionButton actions={buildActions()} />);
    expect(screen.queryByText("Add Expense")).not.toBeInTheDocument();
  });

  it("opens on toggle click, revealing visible actions", async () => {
    render(<FloatingActionButton actions={buildActions()} />);
    await userEvent.click(screen.getByTestId("fab-toggle"));
    expect(screen.getByText("Add Expense")).toBeInTheDocument();
  });

  it("hides actions marked hidden", async () => {
    const actions = buildActions([{ label: "Add Expense" }, { label: "Add Income", hidden: true }]);
    render(<FloatingActionButton actions={actions} />);
    await userEvent.click(screen.getByTestId("fab-toggle"));
    expect(screen.getByText("Add Expense")).toBeInTheDocument();
    expect(screen.queryByText("Add Income")).not.toBeInTheDocument();
  });

  it("clicking an action closes the menu and calls the action's onClick", async () => {
    const onClick = vi.fn();
    render(<FloatingActionButton actions={[{ icon: Plus, label: "Add Expense", color: "rose", onClick }]} />);
    await userEvent.click(screen.getByTestId("fab-toggle"));
    await userEvent.click(screen.getByText("Add Expense"));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Add Expense")).not.toBeInTheDocument();
  });

  it("a disabled action does not fire onClick", async () => {
    const onClick = vi.fn();
    render(<FloatingActionButton actions={[{ icon: Plus, label: "Add Expense", color: "rose", onClick, disabled: true }]} />);
    await userEvent.click(screen.getByTestId("fab-toggle"));
    await userEvent.click(screen.getByText("Add Expense"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("closes when clicking outside the FAB", async () => {
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <FloatingActionButton actions={buildActions()} />
      </div>
    );
    await userEvent.click(screen.getByTestId("fab-toggle"));
    expect(screen.getByText("Add Expense")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(screen.queryByText("Add Expense")).not.toBeInTheDocument();
  });

  it("toggle button aria-label reflects open/closed state", async () => {
    render(<FloatingActionButton actions={buildActions()} />);
    expect(screen.getByTestId("fab-toggle")).toHaveAttribute("aria-label", "Quick add");
    await userEvent.click(screen.getByTestId("fab-toggle"));
    expect(screen.getByTestId("fab-toggle")).toHaveAttribute("aria-label", "Close menu");
  });
});
