import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDialogA11y } from "./useDialogA11y";

function setup() {
  const container = document.createElement("div");
  const input = document.createElement("input");
  container.appendChild(input);
  document.body.appendChild(container);
  return { containerRef: { current: container }, input };
}

describe("useDialogA11y", () => {
  it("calls onDismiss on Escape", () => {
    const { containerRef } = setup();
    const onDismiss = vi.fn();
    renderHook(() => useDialogA11y(containerRef, onDismiss));

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("always dispatches to the latest onDismiss, even though it never re-subscribes the keydown listener", () => {
    const { containerRef } = setup();
    const onDismiss1 = vi.fn();
    const onDismiss2 = vi.fn();
    const { rerender } = renderHook(({ cb }) => useDialogA11y(containerRef, cb), {
      initialProps: { cb: onDismiss1 },
    });

    rerender({ cb: onDismiss2 });
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    expect(onDismiss2).toHaveBeenCalledTimes(1);
    expect(onDismiss1).not.toHaveBeenCalled();
  });

  // Regression test: a caller passing an inline `() => ...` for onDismiss (the common case — see
  // TransactionModalOverlay call sites) gets a new function identity on every parent re-render.
  // The setup/cleanup effect used to depend on `[onDismiss]`, so any re-render of the parent while
  // the dialog was open (e.g. typing into a field backed by local useState) re-ran the cleanup,
  // which refocused whatever had focus *before* the dialog opened — yanking focus out from under
  // whatever the user just typed into. Fixed by reading onDismiss through a ref and running the
  // focus-trap effect once on mount only.
  it("does not steal focus from an element the user focused, across parent re-renders with a new onDismiss identity", () => {
    const { containerRef, input } = setup();
    const { rerender } = renderHook(({ cb }) => useDialogA11y(containerRef, cb), {
      initialProps: { cb: () => {} },
    });

    input.focus();
    expect(document.activeElement).toBe(input);

    // Simulates the parent re-rendering (e.g. on every keystroke) and passing a brand-new
    // inline callback each time.
    rerender({ cb: () => {} });
    rerender({ cb: () => {} });

    expect(document.activeElement).toBe(input);
  });
});
