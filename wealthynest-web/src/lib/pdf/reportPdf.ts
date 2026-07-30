import {jsPDF} from "jspdf";
import autoTable, {type RowInput, type Styles} from "jspdf-autotable";
import {downloadBlob} from "@/lib/downloadFile";

/** Building a large report is synchronous (autoTable + jsPDF's encoder both run on the main
 * thread with no async points) and can take a couple hundred ms for a few thousand rows.
 * Awaiting this macrotask boundary right before that work starts guarantees the "generating…"
 * spinner state React just queued has actually painted, instead of the tab looking frozen from
 * the very first frame. It doesn't make the build itself non-blocking — at the row counts this
 * app sees per report that's not worth the complexity/regression risk of chunked rendering or a
 * Web Worker — it just makes the block start from a visibly "in progress" state. */
export function yieldToMain(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

// Brand palette — matches the app's actual primary identity (Button "primary" variant,
// the --brand-* scale in globals.css, auth/app-lock screens), NOT the indigo/violet
// ".hero-gradient" which is scoped to the marketing landing page only.
const BRAND      = "#c2703d";
const BRAND_DARK = "#8a4a26";
const BRAND_TINT = "#fbf1e9";
const INK        = "#18181b";
const MUTED      = "#8a8a95";
const BORDER     = "#ece4d8";
// Matches CHART_COLORS.income/expense in src/lib/chartColors.ts — the app's one other
// place income/expense colors are canonically defined — so a PDF's "green means more
// money in" reads the same as it does on the Home page charts.
const POSITIVE = "#10b981";
const NEGATIVE = "#f43f5e";

const PAGE_WIDTH    = 210; // A4, mm
const PAGE_HEIGHT   = 297;
const MARGIN        = 14;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_Y       = PAGE_HEIGHT - 12;

/** jsPDF's built-in fonts only cover WinAnsiEncoding — ₹ (U+20B9) isn't in that set and
 * silently renders as "¹". $/€/£ are all in WinAnsi and render fine, so only INR needs
 * a text fallback rather than pulling in a whole embedded Unicode font just for one glyph. */
export function pdfCurrencyPrefix(currency: string = "INR"): string {
  return currency === "INR" ? "Rs. " : ({USD: "$", EUR: "€", GBP: "£"}[currency] ?? `${currency} `);
}

export interface SummaryCard {
  label: string;
  value: string;
  tone?: "positive" | "negative" | "neutral";
}

/** Starts a new A4 report doc with the WealthyNest letterhead + title block already drawn.
 * Returns the doc and the y-cursor to continue drawing from. */
export function createReportDoc(title: string, subtitle: string): {doc: jsPDF; y: number} {
  const doc = new jsPDF({unit: "mm", format: "a4"});

  doc.setFillColor(BRAND);
  doc.roundedRect(MARGIN, 12, 9, 9, 2, 2, "F");
  doc.setTextColor("#ffffff");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("W", MARGIN + 4.5, 18.3, {align: "center"});

  doc.setTextColor(INK);
  doc.setFontSize(12);
  doc.text("WealthyNest", MARGIN + 13, 16.8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(MUTED);
  doc.text("PERSONAL FINANCE", MARGIN + 13, 20.3);

  const generatedLabel = `Generated ${new Date().toLocaleDateString("en-IN", {day: "numeric", month: "long", year: "numeric"})}`;
  doc.setFontSize(8.5);
  doc.text(generatedLabel, PAGE_WIDTH - MARGIN, 18, {align: "right"});

  doc.setDrawColor(BRAND);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, 25, PAGE_WIDTH - MARGIN, 25);

  let y = 34;
  doc.setTextColor(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(title, MARGIN, y);
  y += 6.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(MUTED);
  doc.text(subtitle, MARGIN, y);
  y += 9;

  return {doc, y};
}

/** Up to 3 KPI cards side by side (Total Income / Total Expenses / Net Savings, etc). */
export function addSummaryCards(doc: jsPDF, y: number, cards: SummaryCard[]): number {
  const gap        = 4;
  const cardHeight  = 19;
  const cardWidth   = (CONTENT_WIDTH - gap * (cards.length - 1)) / cards.length;

  cards.forEach((card, i) => {
    const x = MARGIN + i * (cardWidth + gap);
    doc.setDrawColor(BORDER);
    doc.setFillColor("#fafafa");
    doc.roundedRect(x, y, cardWidth, cardHeight, 2, 2, "FD");
    doc.setFillColor(BRAND);
    doc.rect(x + 0.4, y + 0.4, cardWidth - 0.8, 0.9, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED);
    doc.text(card.label.toUpperCase(), x + 4, y + 7.2);

    const color = card.tone === "positive" ? POSITIVE : card.tone === "negative" ? NEGATIVE : INK;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(color);
    doc.text(card.value, x + 4, y + 14.5);
  });

  return y + cardHeight + 9;
}

/** Small uppercase heading with a brand-colored left rule, matching the print letterhead's
 * .section-title style. */
export function addSectionTitle(doc: jsPDF, y: number, text: string): number {
  doc.setDrawColor(BRAND);
  doc.setLineWidth(1);
  doc.line(MARGIN, y - 3.3, MARGIN, y + 0.8);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(BRAND_DARK);
  doc.text(text.toUpperCase(), MARGIN + 3, y);
  return y + 6.5;
}

export interface AddTableOptions {
  foot?: RowInput[];
  columnStyles?: Record<number, Partial<Styles>>;
}

/** Vector (selectable, crisp) table via autoTable — not a rasterized screenshot — styled to
 * match the report's brand tint instead of autoTable's default grid theme. */
export function addTable(doc: jsPDF, y: number, head: string[], body: RowInput[], opts: AddTableOptions = {}): number {
  autoTable(doc, {
    startY: y,
    head: [head],
    body,
    foot: opts.foot,
    // autoTable's default repeats the foot row on every page — wrong for a running "Total"
    // row, which should only ever appear once, after the last body row.
    showFoot: "lastPage",
    margin: {left: MARGIN, right: MARGIN},
    theme: "plain",
    styles: {font: "helvetica", fontSize: 8.5, textColor: INK, lineColor: BORDER, lineWidth: 0.1, cellPadding: 2.3},
    headStyles: {fillColor: BRAND_TINT, textColor: BRAND_DARK, fontStyle: "bold", fontSize: 7.5, lineWidth: {bottom: 0.2, top: 0, left: 0, right: 0}},
    footStyles: {fillColor: "#ffffff", textColor: INK, fontStyle: "bold", fontSize: 8.5, lineWidth: {top: 0.3, bottom: 0, left: 0, right: 0}},
    bodyStyles: {lineWidth: {bottom: 0.1, top: 0, left: 0, right: 0}},
    columnStyles: opts.columnStyles,
    // autoTable only applies columnStyles to body cells (see its section-styles merge) — without
    // this, a right-aligned numeric column's header/footer text sits left-aligned while the body
    // sits right-aligned, which reads as broken rather than premium.
    didParseCell: (data) => {
      const halign = opts.columnStyles?.[data.column.index]?.halign;
      if (halign && data.section !== "body") data.cell.styles.halign = halign;
    },
  });
  return (doc as jsPDF & {lastAutoTable: {finalY: number}}).lastAutoTable.finalY + 8;
}

/** Stamps the footer (tagline + page number) on every page and triggers the actual file
 * download — no popup window, no browser print dialog. Goes through downloadBlob() rather than
 * jsPDF's own doc.save() so this also works inside the Android WebView shell, not just a browser
 * tab — see that function's own comment for why doc.save()'s anchor-click approach doesn't. */
export async function finalizePdf(doc: jsPDF, filename: string): Promise<void> {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(BORDER);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, FOOTER_Y - 4, PAGE_WIDTH - MARGIN, FOOTER_Y - 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED);
    doc.text("WealthyNest · Free forever · No ads", MARGIN, FOOTER_Y);
    doc.text(`Page ${i} of ${pageCount}`, PAGE_WIDTH - MARGIN, FOOTER_Y, {align: "right"});
  }
  await downloadBlob(doc.output("blob"), filename);
}
