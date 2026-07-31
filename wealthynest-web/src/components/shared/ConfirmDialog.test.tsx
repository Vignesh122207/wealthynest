import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "./ConfirmDialog";

describe("ConfirmDialog", () => {
  it("renders nothing when open is false", () => {
    const { container } = render(
      <ConfirmDialog open={false} title="Delete?" description="Are you sure?" onConfirm={vi.fn()} onCancel={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the title and description when open", () => {
    render(<ConfirmDialog open title="Delete item?" description="This cannot be undone." onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText("Delete item?")).toBeInTheDocument();
    expect(screen.getByText("This cannot be undone.")).toBeInTheDocument();
  });

  it("calls onConfirm when the confirm button is clicked", async () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog open title="Delete?" description="Sure?" onConfirm={onConfirm} onCancel={vi.fn()} />);
    await userEvent.click(screen.getByTestId("confirm-dialog-confirm"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when the cancel button is clicked", async () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog open title="Delete?" description="Sure?" onConfirm={vi.fn()} onCancel={onCancel} />);
    await userEvent.click(screen.getByTestId("confirm-dialog-cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when the backdrop is clicked", () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog open title="Delete?" description="Sure?" onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByTestId("modal-overlay-backdrop").querySelector(".bg-black\\/60")!);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel on Escape (via useDialogA11y)", () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog open title="Delete?" description="Sure?" onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("self-managed (no loading prop): a second click while already submitting does not call onConfirm again", async () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog open title="Delete?" description="Sure?" onConfirm={onConfirm} onCancel={vi.fn()} />);
    const confirmBtn = screen.getByTestId("confirm-dialog-confirm");
    fireEvent.click(confirmBtn);
    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("externally-managed (loading=true): confirm button shows the busy state and is disabled", () => {
    render(<ConfirmDialog open title="Delete?" description="Sure?" loading onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByTestId("confirm-dialog-confirm")).toBeDisabled();
  });

  it("externally-managed (loading=false): stays clickable even after a click, since submitting state isn't self-tracked", async () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog open title="Delete?" description="Sure?" loading={false} onConfirm={onConfirm} onCancel={vi.fn()} />);
    const confirmBtn = screen.getByTestId("confirm-dialog-confirm");
    await userEvent.click(confirmBtn);
    await userEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });

  it("typeToConfirm: confirm is disabled until the exact text is typed", async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog open title="Delete family?" description="Sure?" typeToConfirm="DELETE"
        onConfirm={onConfirm} onCancel={vi.fn()} />
    );
    const confirmBtn = screen.getByTestId("confirm-dialog-confirm");
    expect(confirmBtn).toBeDisabled();

    const input = screen.getByLabelText(/Type/);
    await userEvent.type(input, "wrong");
    expect(confirmBtn).toBeDisabled();

    await userEvent.clear(input);
    await userEvent.type(input, "DELETE");
    expect(confirmBtn).not.toBeDisabled();

    await userEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("uses the danger styling and 'danger' button variant when danger=true", () => {
    render(<ConfirmDialog open danger title="Delete?" description="Sure?" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByTestId("confirm-dialog-confirm").className).toContain("from-red-600");
  });

  it("uses custom confirm/cancel labels when provided", () => {
    render(
      <ConfirmDialog open title="Delete?" description="Sure?" confirmLabel="Yes, delete" cancelLabel="No, keep it"
        onConfirm={vi.fn()} onCancel={vi.fn()} />
    );
    expect(screen.getByText("Yes, delete")).toBeInTheDocument();
    expect(screen.getByText("No, keep it")).toBeInTheDocument();
  });
});
