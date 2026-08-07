import {describe, it, expect, vi, beforeEach} from "vitest";
import {renderHook, waitFor, act} from "@testing-library/react";
import {useReceiptAttachment} from "./useReceiptAttachment";
import {toast} from "sonner";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
});

function imageFile(name = "receipt.png", sizeBytes = 1024): File {
  const bytes = new Uint8Array(sizeBytes);
  return new File([bytes], name, { type: "image/png" });
}

describe("useReceiptAttachment", () => {
  it("starts with no attachment when nothing is stored", () => {
    const { result } = renderHook(() => useReceiptAttachment("e1"));
    expect(result.current.dataUrl).toBeNull();
  });

  it("reads a previously-stored receipt for the given expense on mount", () => {
    window.localStorage.setItem("wn-receipt-e1", "data:image/png;base64,AAAA");
    const { result } = renderHook(() => useReceiptAttachment("e1"));
    expect(result.current.dataUrl).toBe("data:image/png;base64,AAAA");
  });

  it("attaches an image file and persists it to localStorage", async () => {
    const { result } = renderHook(() => useReceiptAttachment("e1"));

    act(() => { result.current.attach(imageFile()); });

    await waitFor(() => expect(result.current.dataUrl).not.toBeNull());
    expect(result.current.dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(window.localStorage.getItem("wn-receipt-e1")).toBe(result.current.dataUrl);
  });

  it("rejects a non-image file without touching storage", () => {
    const { result } = renderHook(() => useReceiptAttachment("e1"));
    const pdf = new File([new Uint8Array(10)], "receipt.pdf", { type: "application/pdf" });

    act(() => { result.current.attach(pdf); });

    expect(toast.error).toHaveBeenCalledWith("Only image receipts are supported (JPG, PNG, etc).");
    expect(result.current.dataUrl).toBeNull();
    expect(window.localStorage.getItem("wn-receipt-e1")).toBeNull();
  });

  it("rejects a file over the size limit", () => {
    const { result } = renderHook(() => useReceiptAttachment("e1"));
    const tooBig = imageFile("big.png", 3 * 1024 * 1024);

    act(() => { result.current.attach(tooBig); });

    expect(toast.error).toHaveBeenCalledWith("Receipt image is too large — please use one under 2MB.");
    expect(result.current.dataUrl).toBeNull();
  });

  it("removes a stored receipt", async () => {
    const { result } = renderHook(() => useReceiptAttachment("e1"));
    act(() => { result.current.attach(imageFile()); });
    await waitFor(() => expect(result.current.dataUrl).not.toBeNull());

    act(() => { result.current.remove(); });

    expect(result.current.dataUrl).toBeNull();
    expect(window.localStorage.getItem("wn-receipt-e1")).toBeNull();
  });

  it("keeps separate attachments per expense id and re-syncs when the id changes", async () => {
    window.localStorage.setItem("wn-receipt-e1", "data:image/png;base64,ONE");
    window.localStorage.setItem("wn-receipt-e2", "data:image/png;base64,TWO");
    const { result, rerender } = renderHook(({ id }) => useReceiptAttachment(id), { initialProps: { id: "e1" } });

    expect(result.current.dataUrl).toBe("data:image/png;base64,ONE");

    rerender({ id: "e2" });

    await waitFor(() => expect(result.current.dataUrl).toBe("data:image/png;base64,TWO"));
  });

  it("is a no-op when there's no expense id yet", () => {
    const { result } = renderHook(() => useReceiptAttachment(undefined));

    act(() => { result.current.attach(imageFile()); });
    act(() => { result.current.remove(); });

    expect(result.current.dataUrl).toBeNull();
  });
});
