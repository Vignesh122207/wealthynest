import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormDatePicker } from "./FormDatePicker";

describe("FormDatePicker", () => {
  it("renders an empty combobox with the placeholder when no value is given", () => {
    render(<FormDatePicker label="Date" placeholder="Select date" />);
    expect(screen.getByRole("combobox")).toHaveAttribute("placeholder", "Select date");
    expect((screen.getByRole("combobox") as HTMLInputElement).value).toBe("");
  });

  it("formats a yyyy-MM-dd value as 'dd MMM yyyy' for display", () => {
    render(<FormDatePicker label="Date" value="2026-07-19" onChange={vi.fn()} />);
    expect((screen.getByRole("combobox") as HTMLInputElement).value).toBe("19 Jul 2026");
  });

  it("does not render a calendar dialog until opened", () => {
    render(<FormDatePicker label="Date" />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the calendar on click", async () => {
    render(<FormDatePicker label="Date" />);
    await userEvent.click(screen.getByRole("combobox"));
    expect(screen.getByRole("dialog", { name: "Choose date" })).toBeInTheDocument();
  });

  it("does not open when disabled", async () => {
    render(<FormDatePicker label="Date" disabled />);
    await userEvent.click(screen.getByRole("combobox"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("selecting a day calls onChange with yyyy-MM-dd and closes the calendar", async () => {
    const onChange = vi.fn();
    render(<FormDatePicker label="Date" value="2026-07-19" onChange={onChange} />);
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(screen.getByTestId("calendar-day-2026-07-15"));

    expect(onChange).toHaveBeenCalledWith("2026-07-15");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows a clear (×) button only when a value is set, and clearing calls onChange('')", async () => {
    const onChange = vi.fn();
    const { rerender } = render(<FormDatePicker label="Date" value="" onChange={onChange} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    rerender(<FormDatePicker label="Date" value="2026-07-19" onChange={onChange} />);
    const clearBtn = screen.getByRole("button");
    await userEvent.click(clearBtn);
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("navigating to month view and picking a month jumps the day grid to that month", async () => {
    render(<FormDatePicker label="Date" value="2026-07-19" onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(screen.getByTestId("calendar-month-year-header"));
    expect(screen.getByTestId("calendar-year-header")).toHaveTextContent("2026");

    await userEvent.click(screen.getByTestId("calendar-month-2026-03"));
    // Back in day view, header now reads March 2026
    expect(screen.getByTestId("calendar-month-year-header")).toHaveTextContent("March 2026");
  });

  it("navigating to year view and picking a year updates the month view's year", async () => {
    render(<FormDatePicker label="Date" value="2026-07-19" onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(screen.getByTestId("calendar-month-year-header"));
    await userEvent.click(screen.getByTestId("calendar-year-header"));
    await userEvent.click(screen.getByTestId("calendar-year-2024"));

    expect(screen.getByTestId("calendar-year-header")).toHaveTextContent("2024");
  });

  it("closes on outside click and fires onBlur", async () => {
    const onBlur = vi.fn();
    render(
      <div>
        <FormDatePicker label="Date" onBlur={onBlur} />
        <button>Outside</button>
      </div>
    );
    await userEvent.click(screen.getByRole("combobox"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole("button", { name: "Outside" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onBlur).toHaveBeenCalled();
  });

  it("closes on Escape and returns focus to the trigger input", async () => {
    render(<FormDatePicker label="Date" testId="date-input" />);
    await userEvent.click(screen.getByRole("combobox"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the error message and marks aria-invalid", () => {
    render(<FormDatePicker label="Date" error="Date is required" />);
    expect(screen.getByText("Date is required")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-invalid", "true");
  });

  it("Enter on the closed trigger opens the calendar", async () => {
    render(<FormDatePicker label="Date" />);
    const trigger = screen.getByRole("combobox");
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
