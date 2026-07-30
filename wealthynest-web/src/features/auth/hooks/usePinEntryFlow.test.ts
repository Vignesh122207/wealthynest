import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { usePinEntryFlow } from "./usePinEntryFlow";

describe("usePinEntryFlow", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function enterDigits(result: { current: ReturnType<typeof usePinEntryFlow> }, digits: string) {
    for (const d of digits) act(() => result.current.handleDigit(d));
  }

  it("starts on the choose step with an empty value", () => {
    const onConfirmed = vi.fn();
    const { result } = renderHook(() => usePinEntryFlow({ isPending: false, onConfirmed }));
    expect(result.current.step).toBe("choose");
    expect(result.current.value).toBe("");
    expect(result.current.mismatch).toBe(false);
  });

  it("moves to confirm after 4 digits on the choose step, without calling onConfirmed", () => {
    const onConfirmed = vi.fn();
    const { result } = renderHook(() => usePinEntryFlow({ isPending: false, onConfirmed }));

    enterDigits(result, "1234");
    act(() => vi.advanceTimersByTime(180));

    expect(result.current.step).toBe("confirm");
    expect(result.current.value).toBe("");
    expect(onConfirmed).not.toHaveBeenCalled();
  });

  it("calls onConfirmed once the confirm step repeats the same digits", () => {
    const onConfirmed = vi.fn();
    const { result } = renderHook(() => usePinEntryFlow({ isPending: false, onConfirmed }));

    enterDigits(result, "1234");
    act(() => vi.advanceTimersByTime(180));
    enterDigits(result, "1234");
    act(() => vi.advanceTimersByTime(180));

    expect(onConfirmed).toHaveBeenCalledTimes(1);
    expect(onConfirmed).toHaveBeenCalledWith("1234", { onError: expect.any(Function) });
  });

  it("flags a mismatch and clears back to an empty value on the confirm step when digits differ", () => {
    const onConfirmed = vi.fn();
    const { result } = renderHook(() => usePinEntryFlow({ isPending: false, onConfirmed }));

    enterDigits(result, "1234");
    act(() => vi.advanceTimersByTime(180));
    enterDigits(result, "5678");
    act(() => vi.advanceTimersByTime(180));

    expect(onConfirmed).not.toHaveBeenCalled();
    expect(result.current.mismatch).toBe(true);
    expect(result.current.value).toBe("5678");

    act(() => vi.advanceTimersByTime(450));
    expect(result.current.mismatch).toBe(false);
    expect(result.current.value).toBe("");
    expect(result.current.step).toBe("confirm");
  });

  it("ignores digit taps while mismatched cells are still full (value already at PIN_LENGTH)", () => {
    const onConfirmed = vi.fn();
    const { result } = renderHook(() => usePinEntryFlow({ isPending: false, onConfirmed }));

    enterDigits(result, "1234");
    act(() => vi.advanceTimersByTime(180));
    enterDigits(result, "5678");
    act(() => vi.advanceTimersByTime(180));
    expect(result.current.mismatch).toBe(true);

    act(() => result.current.handleDigit("9"));
    expect(result.current.mismatch).toBe(true);
    expect(result.current.value).toBe("5678");
  });

  it("backspace clears an active mismatch early, ahead of the 450ms auto-clear", () => {
    const onConfirmed = vi.fn();
    const { result } = renderHook(() => usePinEntryFlow({ isPending: false, onConfirmed }));

    enterDigits(result, "1234");
    act(() => vi.advanceTimersByTime(180));
    enterDigits(result, "5678");
    act(() => vi.advanceTimersByTime(180));
    expect(result.current.mismatch).toBe(true);

    act(() => result.current.handleBackspace());
    expect(result.current.mismatch).toBe(false);
    expect(result.current.value).toBe("567");
  });

  it("runs onConfirmed's onError callback to clear the value (e.g. on an API rejection)", () => {
    const onConfirmed = vi.fn((_pin: string, { onError }: { onError: () => void }) => onError());
    const { result } = renderHook(() => usePinEntryFlow({ isPending: false, onConfirmed }));

    enterDigits(result, "1234");
    act(() => vi.advanceTimersByTime(180));
    enterDigits(result, "1234");
    act(() => vi.advanceTimersByTime(180));

    expect(result.current.value).toBe("");
  });

  it("ignores digit input once 4 digits are already entered", () => {
    const onConfirmed = vi.fn();
    const { result } = renderHook(() => usePinEntryFlow({ isPending: false, onConfirmed }));

    act(() => result.current.handleDigit("1"));
    act(() => result.current.handleDigit("2"));
    act(() => result.current.handleDigit("3"));
    act(() => result.current.handleDigit("4"));
    act(() => result.current.handleDigit("5"));

    expect(result.current.value).toBe("1234");
  });

  it("ignores digit and backspace input while isPending is true", () => {
    const onConfirmed = vi.fn();
    const { result, rerender } = renderHook(
      ({ isPending }) => usePinEntryFlow({ isPending, onConfirmed }),
      { initialProps: { isPending: true } }
    );

    act(() => result.current.handleDigit("1"));
    expect(result.current.value).toBe("");

    rerender({ isPending: false });
    act(() => result.current.handleDigit("1"));
    expect(result.current.value).toBe("1");

    rerender({ isPending: true });
    act(() => result.current.handleBackspace());
    expect(result.current.value).toBe("1");
  });

  it("backspace removes the last digit and clears an active mismatch", () => {
    const onConfirmed = vi.fn();
    const { result } = renderHook(() => usePinEntryFlow({ isPending: false, onConfirmed }));

    act(() => result.current.handleDigit("1"));
    act(() => result.current.handleDigit("2"));
    act(() => result.current.handleBackspace());
    expect(result.current.value).toBe("1");

    act(() => result.current.handleBackspace());
    expect(result.current.value).toBe("");
    act(() => result.current.handleBackspace());
    expect(result.current.value).toBe("");
  });

  it("startOver resets step, chosen pin, value, and mismatch back to the initial choose state", () => {
    const onConfirmed = vi.fn();
    const { result } = renderHook(() => usePinEntryFlow({ isPending: false, onConfirmed }));

    enterDigits(result, "1234");
    act(() => vi.advanceTimersByTime(180));
    enterDigits(result, "5678");
    act(() => vi.advanceTimersByTime(180));
    expect(result.current.mismatch).toBe(true);

    act(() => result.current.startOver());

    expect(result.current.step).toBe("choose");
    expect(result.current.value).toBe("");
    expect(result.current.mismatch).toBe(false);

    // chosenPin was really cleared too — re-entering "5678" on "choose" now becomes the new
    // chosen pin, so confirming with "5678" again should succeed instead of mismatching.
    enterDigits(result, "5678");
    act(() => vi.advanceTimersByTime(180));
    enterDigits(result, "5678");
    act(() => vi.advanceTimersByTime(180));
    expect(onConfirmed).toHaveBeenCalledWith("5678", { onError: expect.any(Function) });
  });
});
