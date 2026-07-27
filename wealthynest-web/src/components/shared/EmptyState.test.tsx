import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "./EmptyState";
import { Inbox } from "lucide-react";

describe("EmptyState", () => {
  it("renders the title and description", () => {
    render(<EmptyState icon={Inbox} title="No expenses yet" description="Add your first expense to get started." />);
    expect(screen.getByText("No expenses yet")).toBeInTheDocument();
    expect(screen.getByText("Add your first expense to get started.")).toBeInTheDocument();
  });

  it("renders the action node when provided", () => {
    render(
      <EmptyState icon={Inbox} title="No expenses yet" description="Add one."
        action={<button>Add Expense</button>} />
    );
    expect(screen.getByRole("button", { name: "Add Expense" })).toBeInTheDocument();
  });

  it("renders nothing extra when no action is provided", () => {
    render(<EmptyState icon={Inbox} title="No expenses yet" description="Add one." />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
