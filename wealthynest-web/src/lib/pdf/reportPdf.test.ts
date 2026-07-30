import { describe, it, expect, vi } from "vitest";
import type { jsPDF } from "jspdf";
import {
  addSectionTitle, addSummaryCards, addTable, createReportDoc, finalizePdf, pdfCurrencyPrefix, yieldToMain,
} from "./reportPdf";

describe("yieldToMain", () => {
  it("resolves on a later macrotask rather than synchronously", async () => {
    let resolved = false;
    const promise = yieldToMain().then(() => { resolved = true; });

    expect(resolved).toBe(false); // hasn't run yet — still queued behind the current task
    await promise;
    expect(resolved).toBe(true);
  });
});

describe("pdfCurrencyPrefix", () => {
  it("uses a text fallback for INR instead of the ₹ glyph, which jsPDF's standard fonts can't encode", () => {
    // jsPDF's built-in fonts only support WinAnsiEncoding — U+20B9 (₹) silently renders as
    // "¹" (verified by inspecting a generated PDF's content stream), so INR gets a safe prefix.
    expect(pdfCurrencyPrefix("INR")).toBe("Rs. ");
  });

  it("keeps the real symbol for currencies that are in WinAnsiEncoding", () => {
    expect(pdfCurrencyPrefix("USD")).toBe("$");
    expect(pdfCurrencyPrefix("EUR")).toBe("€");
    expect(pdfCurrencyPrefix("GBP")).toBe("£");
  });

  it("falls back to the currency code for anything unrecognized", () => {
    expect(pdfCurrencyPrefix("JPY")).toBe("JPY ");
  });

  it("defaults to INR when no currency is passed", () => {
    expect(pdfCurrencyPrefix()).toBe("Rs. ");
  });
});

describe("createReportDoc", () => {
  it("returns a single-page A4 doc with the letterhead drawn and a cursor past it", () => {
    const { doc, y } = createReportDoc("2026 Annual Report", "Full-year summary");

    expect(typeof doc.save).toBe("function");
    expect(doc.getNumberOfPages()).toBe(1);
    expect(y).toBeGreaterThan(30); // below the brand mark, title and subtitle
  });
});

describe("addSummaryCards", () => {
  it("advances the cursor by a fixed card height regardless of card count", () => {
    const { doc, y } = createReportDoc("Title", "Subtitle");
    const y3 = addSummaryCards(doc, y, [
      { label: "Total Income", value: "Rs. 1,000", tone: "positive" },
      { label: "Total Expenses", value: "Rs. 500", tone: "negative" },
      { label: "Net Savings", value: "Rs. 500", tone: "positive" },
    ]);
    const y1 = addSummaryCards(doc, y, [{ label: "Current Balance", value: "Rs. 5,000" }]);

    expect(y3).toBeGreaterThan(y);
    expect(y3).toBe(y1); // same fixed card height either way
  });
});

describe("addSectionTitle", () => {
  it("advances the cursor by a small fixed amount", () => {
    const { doc, y } = createReportDoc("Title", "Subtitle");
    const next = addSectionTitle(doc, y, "Month-by-Month Summary");
    expect(next).toBeCloseTo(y + 6.5, 5);
  });
});

describe("addTable", () => {
  it("draws a table and returns a cursor below it", () => {
    const { doc, y } = createReportDoc("Title", "Subtitle");
    const next = addTable(doc, y, ["Month", "Income", "Expenses"], [
      ["Jan", "Rs. 1,000", "Rs. 500"],
      ["Feb", "Rs. 1,200", "Rs. 600"],
    ]);

    expect(next).toBeGreaterThan(y);
    expect((doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY).toBeGreaterThan(y);
  });

  it("paginates automatically once body rows overflow a single A4 page", () => {
    const { doc, y } = createReportDoc("Title", "Subtitle");
    const manyRows = Array.from({ length: 80 }, (_, i) => [`2026-01-${(i % 28) + 1}`, "Category", "Description", "Rs. 100"]);

    addTable(doc, y, ["Date", "Category", "Description", "Amount"], manyRows);

    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
  });
});

describe("finalizePdf", () => {
  it("stamps a footer on every page and saves under the given filename", () => {
    const { doc, y } = createReportDoc("Title", "Subtitle");
    const manyRows = Array.from({ length: 80 }, (_, i) => [`2026-01-${(i % 28) + 1}`, "Category", "Description", "Rs. 100"]);
    addTable(doc, y, ["Date", "Category", "Description", "Amount"], manyRows);
    const pageCountBefore = doc.getNumberOfPages();
    const saveSpy = vi.spyOn(doc, "save").mockImplementation(() => doc);

    finalizePdf(doc, "WealthyNest-2026-Annual.pdf");

    expect(saveSpy).toHaveBeenCalledWith("WealthyNest-2026-Annual.pdf");
    expect(doc.getNumberOfPages()).toBe(pageCountBefore); // footer drawing doesn't add pages
  });
});
