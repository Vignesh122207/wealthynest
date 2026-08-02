import {expect, type Locator} from "@playwright/test";
import {BasePage} from "./BasePage";
import {ROUTES} from "../constants/routes";
import {TEST_IDS} from "../constants/testIds";
import {pickDate} from "../components/DatePicker";
import {waitForApiResponse, waitForDialogClosed} from "../helpers/wait.helper";

export class InvestmentsPage extends BasePage {
  async gotoInvestments(): Promise<void> {
    await this.goto(ROUTES.investments);
  }

  /** Every card shares the same data-testid — scope to one investment via .filter(). */
  card(name: string): Locator {
    return this.page.getByTestId("investment-card").filter({ hasText: name });
  }

  /** From the Overview tab, "Fixed Deposit" is a single FAB action that both switches to the FD
   * tab and opens the add form (see investments/page.tsx's FAB actions for tab === "overview"). */
  async createFixedDeposit(input: {
    bankName: string; investedAmount: number; couponRate: number; purchaseDate: string; maturityDate: string;
  }): Promise<void> {
    await this.page.getByTestId(TEST_IDS.fab.toggle).click();
    await this.page.getByTestId(TEST_IDS.fab.addFd).click();
    await this.page.getByTestId("fd-bank-name-input").fill(input.bankName);
    await this.page.getByTestId("fd-invested-amount-input").fill(String(input.investedAmount));
    await this.page.getByTestId("fd-coupon-rate-input").fill(String(input.couponRate));
    await pickDate(this.page, "fd-purchase-date-input", input.purchaseDate);
    await pickDate(this.page, "fd-maturity-date-input", input.maturityDate);
    await Promise.all([
      waitForApiResponse(this.page, "/investments", "POST"),
      this.page.getByTestId(TEST_IDS.investmentForm.submit).click(),
    ]);
    await waitForDialogClosed(this.page);
  }

  async createGold(input: { description: string; quantityGrams: number; buyPricePerGram: number; purchaseDate: string }): Promise<void> {
    await this.page.getByTestId(TEST_IDS.fab.toggle).click();
    await this.page.getByTestId(TEST_IDS.fab.addGold).click();
    await this.page.getByTestId("gold-description-input").fill(input.description);
    await this.page.getByTestId("gold-quantity-input").fill(String(input.quantityGrams));
    await this.page.getByTestId("gold-buy-price-input").fill(String(input.buyPricePerGram));
    await pickDate(this.page, "gold-purchase-date-input", input.purchaseDate);
    await Promise.all([
      waitForApiResponse(this.page, "/investments", "POST"),
      this.page.getByTestId(TEST_IDS.investmentForm.submit).click(),
    ]);
    await waitForDialogClosed(this.page);
  }

  async createBond(input: {
    companyName: string; faceValuePerBond: number; quantity: number; couponRate: number; purchaseDate: string;
  }): Promise<void> {
    await this.page.getByTestId(TEST_IDS.fab.toggle).click();
    await this.page.getByTestId(TEST_IDS.fab.addBond).click();
    await this.page.getByTestId("bond-name-input").fill(input.companyName);
    await this.page.getByTestId("bond-face-value-input").fill(String(input.faceValuePerBond));
    await this.page.getByTestId("bond-quantity-input").fill(String(input.quantity));
    await this.page.getByTestId("bond-coupon-rate-input").fill(String(input.couponRate));
    await pickDate(this.page, "bond-purchase-date-input", input.purchaseDate);
    await Promise.all([
      waitForApiResponse(this.page, "/investments", "POST"),
      this.page.getByTestId(TEST_IDS.investmentForm.submit).click(),
    ]);
    await waitForDialogClosed(this.page);
  }

  /** Intercepts the live NSE/BSE stock search this suite otherwise avoids (real-external-data
   * flakiness risk — see this file's own `importFromCas` comment for the same reasoning applied
   * to CAS PDF parsing) with canned, deterministic results. Call before opening the Stock form. */
  async mockStockSearch(results: { symbol: string; name: string; exchange: string }[]): Promise<void> {
    await this.page.route("**/investments/search/stocks*", route => route.fulfill({
      json: { success: true, status: 200, data: results.map(r => ({ ...r, type: "STOCK" })), timestamp: new Date().toISOString() },
    }));
  }

  /** Same as mockStockSearch but for the MF search (powered by MFAPI, same real-external-data
   * risk this sidesteps). */
  async mockMfSearch(results: { name: string; schemeCode: string }[]): Promise<void> {
    await this.page.route("**/investments/search/mf*", route => route.fulfill({
      json: { success: true, status: 200, data: results.map(r => ({ ...r, type: "MF" })), timestamp: new Date().toISOString() },
    }));
  }

  /** Requires mockStockSearch() to already be routed — picks the first (only) mocked result. */
  async createStock(input: {
    searchQuery: string; units: number; avgBuyPrice: number; purchaseDate: string;
  }): Promise<void> {
    await this.page.getByTestId(TEST_IDS.fab.toggle).click();
    await this.page.getByTestId(TEST_IDS.fab.addStock).click();
    await this.page.getByTestId("live-search-input").fill(input.searchQuery);
    await this.page.getByTestId("live-search-result-0").click();
    await this.page.getByTestId("stock-units-input").fill(String(input.units));
    await this.page.getByTestId("stock-avg-buy-price-input").fill(String(input.avgBuyPrice));
    await pickDate(this.page, "stock-purchase-date-input", input.purchaseDate);
    await Promise.all([
      waitForApiResponse(this.page, "/investments", "POST"),
      this.page.getByTestId(TEST_IDS.investmentForm.submit).click(),
    ]);
    await waitForDialogClosed(this.page);
  }

  /** Requires mockMfSearch() to already be routed — picks the first (only) mocked result. */
  async createMutualFund(input: {
    searchQuery: string; units: number; avgBuyPrice: number; purchaseDate: string;
  }): Promise<void> {
    await this.page.getByTestId(TEST_IDS.fab.toggle).click();
    await this.page.getByTestId(TEST_IDS.fab.addMf).click();
    await this.page.getByTestId("live-search-input").fill(input.searchQuery);
    await this.page.getByTestId("live-search-result-0").click();
    await this.page.getByTestId("mf-units-input").fill(String(input.units));
    await this.page.getByTestId("mf-avg-buy-price-input").fill(String(input.avgBuyPrice));
    await pickDate(this.page, "mf-purchase-date-input", input.purchaseDate);
    await Promise.all([
      waitForApiResponse(this.page, "/investments", "POST"),
      this.page.getByTestId(TEST_IDS.investmentForm.submit).click(),
    ]);
    await waitForDialogClosed(this.page);
  }

  /** Every suggestion row shares the same data-testid — scope to one via .filter(), same pattern
   * as `card()` above. */
  dividendSuggestionRow(symbol: string): Locator {
    return this.page.getByTestId("dividend-suggestion-row").filter({ hasText: symbol });
  }

  async expectDividendSuggestionVisible(symbol: string): Promise<void> {
    await expect(this.dividendSuggestionRow(symbol)).toBeVisible();
  }

  async expectDividendSuggestionNotVisible(symbol: string): Promise<void> {
    await expect(this.dividendSuggestionRow(symbol)).toHaveCount(0);
  }

  async logDividendSuggestion(symbol: string): Promise<void> {
    await Promise.all([
      waitForApiResponse(this.page, /\/investments\/.+\/log-income$/, "POST"),
      this.dividendSuggestionRow(symbol).getByTestId("dividend-log-button").click(),
    ]);
  }

  async dismissDividendSuggestion(symbol: string): Promise<void> {
    await Promise.all([
      waitForApiResponse(this.page, /\/investments\/.+\/dismiss-dividend$/, "POST"),
      this.dividendSuggestionRow(symbol).getByTestId("dividend-dismiss-button").click(),
    ]);
  }

  /** Runs the Import from CAS flow with a PDF constructed so the backend's regex-based parser
   * (CasImportServiceImpl.parseHoldings — see its own "honest caveat" doc comment: it's tuned
   * against general knowledge of CAS layouts, not a verified real sample) confidently extracts
   * exactly one fully-valid holding (scheme name, units, NAV, and current value all resolved) —
   * see test-data/files/sample-cas-statement.pdf and the comment on its generating script for the
   * exact text layout this depends on. That sidesteps the parser's real flakiness risk (this
   * suite doesn't drive fuzzy real-world PDF parsing, just the upload -> review -> confirm round
   * trip) at the cost of not exercising the manual-fix-a-row / add-missed-scheme paths, which
   * would need their own targeted test if that logic needs coverage later. */
  async importFromCas(filePath: string): Promise<void> {
    await this.page.getByTestId(TEST_IDS.fab.toggle).click();
    await this.page.getByTestId(TEST_IDS.fab.importCas).click();
    await Promise.all([
      waitForApiResponse(this.page, "/cas-import/preview", "POST"),
      this.page.getByTestId("import-cas-file-input").setInputFiles(filePath),
    ]);
    await expect(this.page.getByTestId("import-cas-confirm")).toBeEnabled();
    await Promise.all([
      waitForApiResponse(this.page, "/cas-import/confirm", "POST"),
      this.page.getByTestId("import-cas-confirm").click(),
    ]);
    await this.page.getByTestId("import-cas-close-result").click();
    await waitForDialogClosed(this.page);
  }

  /** Same round trip as importFromCas but for a password-protected PDF — drives the password
   * step (PDFBox's InvalidPasswordException server-side flips `needsPassword`) first. */
  async importFromCasWithPassword(filePath: string, password: string): Promise<void> {
    await this.page.getByTestId(TEST_IDS.fab.toggle).click();
    await this.page.getByTestId(TEST_IDS.fab.importCas).click();
    await Promise.all([
      waitForApiResponse(this.page, "/cas-import/preview", "POST"),
      this.page.getByTestId("import-cas-file-input").setInputFiles(filePath),
    ]);
    await expect(this.page.getByTestId("import-cas-password-input")).toBeVisible();
    await this.page.getByTestId("import-cas-password-input").fill(password);
    await Promise.all([
      waitForApiResponse(this.page, "/cas-import/preview", "POST"),
      this.page.getByRole("button", { name: "Unlock" }).click(),
    ]);
    await expect(this.page.getByTestId("import-cas-confirm")).toBeEnabled();
    await Promise.all([
      waitForApiResponse(this.page, "/cas-import/confirm", "POST"),
      this.page.getByTestId("import-cas-confirm").click(),
    ]);
    await this.page.getByTestId("import-cas-close-result").click();
    await waitForDialogClosed(this.page);
  }

  /** Uploads a CAS PDF and stops at the review step (doesn't confirm) — for tests exercising
   * manual-fix-a-row or "Add missed scheme" before confirming. */
  async uploadCasForReview(filePath: string): Promise<void> {
    await this.page.getByTestId(TEST_IDS.fab.toggle).click();
    await this.page.getByTestId(TEST_IDS.fab.importCas).click();
    await Promise.all([
      waitForApiResponse(this.page, "/cas-import/preview", "POST"),
      this.page.getByTestId("import-cas-file-input").setInputFiles(filePath),
    ]);
    await expect(this.page.getByTestId("import-cas-confirm")).toBeVisible();
  }

  /** `rowIndex` is negative for a manually-added row (see ImportCasModal's `manualRowSeq`) — any
   * integer works here, positive or negative, since it's just interpolated into the testid. */
  casRowField(rowIndex: number, field: "scheme" | "units" | "nav" | "value" | "invested"): Locator {
    return this.page.getByTestId(`import-cas-${field}-${rowIndex}`);
  }

  async fillCasRow(rowIndex: number, patch: Partial<{ scheme: string; units: number; nav: number; value: number; invested: number }>): Promise<void> {
    if (patch.scheme !== undefined)   await this.casRowField(rowIndex, "scheme").fill(patch.scheme);
    if (patch.units !== undefined)    await this.casRowField(rowIndex, "units").fill(String(patch.units));
    if (patch.nav !== undefined)      await this.casRowField(rowIndex, "nav").fill(String(patch.nav));
    if (patch.value !== undefined)    await this.casRowField(rowIndex, "value").fill(String(patch.value));
    if (patch.invested !== undefined) await this.casRowField(rowIndex, "invested").fill(String(patch.invested));
  }

  /** Adds a blank manually-entered holding row (the "Add missed scheme" affordance) — its
   * rowIndex is always -1 for the first manual row added in a given review session
   * (ImportCasModal's `manualRowSeq` module-level counter starts at -1 and decrements). */
  async addCasManualRow(): Promise<void> {
    await this.page.getByTestId("import-cas-add-row").click();
  }

  async confirmCasImport(): Promise<void> {
    await Promise.all([
      waitForApiResponse(this.page, "/cas-import/confirm", "POST"),
      this.page.getByTestId("import-cas-confirm").click(),
    ]);
    await this.page.getByTestId("import-cas-close-result").click();
    await waitForDialogClosed(this.page);
  }

  /** Every investment card's whole surface opens Edit (InvestmentCard.tsx: `onClick={onEdit}` on
   * the card root) — clicks via the shared data-testid + name filter, not a dedicated Edit button. */
  async openEditByName(name: string): Promise<void> {
    await this.card(name).click();
  }

  async deleteInvestment(name: string): Promise<void> {
    await this.openEditByName(name);
    await this.page.getByRole("button", { name: "Delete", exact: true }).click();
    await Promise.all([
      waitForApiResponse(this.page, "/investments", "DELETE"),
      this.page.getByTestId(TEST_IDS.confirmDialog.confirm).click(),
    ]);
    await waitForDialogClosed(this.page);
  }

  private static readonly TAB_LABELS: Record<"overview" | "stocks" | "mf" | "gold" | "fd" | "bonds", string> = {
    overview: "Overview", stocks: "Stocks", mf: "Mutual Funds", gold: "Gold", fd: "Fixed Deposits", bonds: "Bonds",
  };

  /** Clicks the real tab pill — investments/page.tsx's TabBar onChange does a client-side
   * router.replace, not a full reload, so this matches how a real user actually switches tabs.
   * A hard page.goto() here used to re-mount DashboardLayout on top of whatever the *previous*
   * goto() (gotoInvestments, importFromCas, etc.) had just triggered, occasionally close enough
   * to race two concurrent cold-boot refresh-token redemptions — see wait.helper.ts's own comment
   * on the single-request version of this same underlying behavior. */
  async gotoTab(tab: "overview" | "stocks" | "mf" | "gold" | "fd" | "bonds"): Promise<void> {
    await this.page.getByRole("tab", { name: InvestmentsPage.TAB_LABELS[tab] }).click();
  }

  async expectInvestmentVisible(name: string | RegExp): Promise<void> {
    await expect(this.page.getByText(name).first()).toBeVisible();
  }

  async expectInvestmentNotVisible(name: string): Promise<void> {
    await expect(this.card(name)).toHaveCount(0);
  }
}
