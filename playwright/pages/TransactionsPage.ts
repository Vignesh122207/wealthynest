import {expect, type Locator} from "@playwright/test";
import {BasePage} from "./BasePage";
import {ROUTES} from "../constants/routes";
import {TEST_IDS} from "../constants/testIds";
import {waitForApiResponse, waitForDialogClosed} from "../helpers/wait.helper";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Models wealthynest-web's /expenses route — the single page that hosts Expense, Income and
 * Transfer creation (see _components/TransactionModals.tsx), reached via its FloatingActionButton. */
export class TransactionsPage extends BasePage {
  async gotoTransactions(): Promise<void> {
    await this.goto(ROUTES.transactions);
  }

  typeTab(key: "all" | "expenses" | "income" | "transfers"): Locator {
    return this.page.getByTestId(TEST_IDS.typeTab(key));
  }

  get searchInput(): Locator {
    return this.page.getByPlaceholder("Search description, category, amount…");
  }

  /** The rolling-range pills (1W/1M/3M/6M/YTD) and the Custom option live in DateRangeCapsule,
   * always visible in the toolbar (no trigger to open first, unlike the old collapsed popover).
   * Clicking "Custom" opens DualCalendarRangePicker's floating panel. */
  async openCustomRangePicker(): Promise<void> {
    await this.page.getByTestId("date-mode-custom").click();
  }

  /** "All time" is DualCalendarRangePicker's Clear action (dateMode="custom" with both dates
   * empty) — page.tsx already resolves that to an unbounded query, same as the old dedicated
   * "All" pill did. Switch to this before asserting on a transaction whose date isn't guaranteed
   * to fall in the current month (e.g. a statement import's fixed-date rows). */
  async showAllDates(): Promise<void> {
    await this.openCustomRangePicker();
    await this.page.getByTestId("range-clear").click();
  }

  /** Clicks range-nav-prev/next enough times to bring the target ISO month into one of
   * DualCalendarRangePicker's two visible month panels (left = cursor, right = cursor + 1). */
  private async navigateRangePickerTo(isoDate: string): Promise<void> {
    const [targetYear, targetMonth] = isoDate.split("-").map(Number);
    const targetIndex = targetYear * 12 + targetMonth;
    const cursorLabel = await this.page.getByTestId("range-cursor-label").textContent();
    const cursor = new Date(`1 ${cursorLabel}`);
    const cursorIndex = cursor.getFullYear() * 12 + (cursor.getMonth() + 1);
    if (targetIndex < cursorIndex) {
      for (let i = 0; i < cursorIndex - targetIndex; i++) await this.page.getByTestId("range-nav-prev").click();
    } else if (targetIndex > cursorIndex + 1) {
      for (let i = 0; i < targetIndex - (cursorIndex + 1); i++) await this.page.getByTestId("range-nav-next").click();
    }
  }

  /** Picks an exact from/to range via DualCalendarRangePicker — for a period whose year differs
   * from whatever the month scrubber last left `year` state at. */
  async setCustomDateRange(fromISO: string, toISO: string): Promise<void> {
    await this.openCustomRangePicker();
    await this.navigateRangePickerTo(fromISO);
    await this.page.getByTestId(`range-day-${fromISO}`).click();
    await this.navigateRangePickerTo(toISO);
    await this.page.getByTestId(`range-day-${toISO}`).click();
    await this.page.getByTestId("range-apply").click();
  }

  // ── Add Expense ──────────────────────────────────────────────────────────
  async addExpense(input: { amount: number; categoryName: string; description?: string }): Promise<void> {
    await this.page.getByTestId(TEST_IDS.fab.toggle).click();
    await this.page.getByTestId(TEST_IDS.fab.addExpense).click();
    await this.page.getByTestId(TEST_IDS.expenseForm.categoryPickerTrigger).click();
    await this.page.getByTestId(TEST_IDS.expenseForm.categoryPickerPanel).getByText(input.categoryName, { exact: true }).click();
    await this.page.getByTestId("expense-amount-input").fill(String(input.amount));
    if (input.description) await this.page.getByLabel("Description (optional)").fill(input.description);
    await Promise.all([
      waitForApiResponse(this.page, "/expenses", "POST"),
      this.page.getByTestId(TEST_IDS.expenseForm.submit).click(),
    ]);
    await waitForDialogClosed(this.page);
  }

  /** Splits the expense with one or more family members — familyMembers only renders the "Split
   * with family" toggle at all once regressionUser is actually in a family with someone else
   * (see expenses/page.tsx's useFamilyMembers), so this can only be called from a spec that's
   * already set that up (see expense-split.spec.ts). Defaults to equal-split mode; pass
   * `customShares` (a participant id -> amount map) to switch to custom-amount mode and fill each
   * participant's share explicitly instead. */
  async addExpenseWithSplit(input: {
    amount: number; categoryName: string; description?: string;
    participants: string[]; customShares?: Record<string, number>;
  }): Promise<void> {
    await this.page.getByTestId(TEST_IDS.fab.toggle).click();
    await this.page.getByTestId(TEST_IDS.fab.addExpense).click();
    await this.page.getByTestId(TEST_IDS.expenseForm.categoryPickerTrigger).click();
    await this.page.getByTestId(TEST_IDS.expenseForm.categoryPickerPanel).getByText(input.categoryName, { exact: true }).click();
    await this.page.getByTestId("expense-amount-input").fill(String(input.amount));
    if (input.description) await this.page.getByLabel("Description (optional)").fill(input.description);
    await this.page.getByTestId("expense-split-toggle").click();
    for (const id of input.participants) {
      await this.page.getByTestId(`expense-split-participant-${id}`).click();
    }
    if (input.customShares) {
      await this.page.getByTestId("expense-split-mode-custom").click();
      for (const [id, amount] of Object.entries(input.customShares)) {
        await this.page.getByTestId(`expense-split-custom-share-${id}`).fill(String(amount));
      }
    }
    await Promise.all([
      waitForApiResponse(this.page, "/expenses", "POST"),
      this.page.getByTestId(TEST_IDS.expenseForm.submit).click(),
    ]);
    await waitForDialogClosed(this.page);
  }

  /** Runs the Import Bank Statement flow with a CSV that uses column headers the backend
   * auto-detects (Date/Description/Debit/Credit — see StatementImportServiceImpl's *_ALIASES),
   * so it skips straight to the review step (no mapping/password step). Leaves every parsed row
   * at its default included/category state and confirms as-is — good enough to prove the round
   * trip end to end; doesn't exercise per-row editing (toggle include, reassign category, bulk
   * apply), which would need its own more targeted test if that logic needs coverage later. */
  async importStatementCsv(input: { accountId: string; filePath: string }): Promise<void> {
    await this.page.getByRole("button", { name: "Import statement" }).click();
    await this.page.getByTestId("import-statement-account-picker-trigger").click();
    await this.page.getByTestId(`import-statement-account-picker-option-${input.accountId}`).click();
    await Promise.all([
      waitForApiResponse(this.page, "/statement-import/preview", "POST"),
      this.page.getByTestId("import-statement-file-input").setInputFiles(input.filePath),
    ]);
    await expect(this.page.getByTestId("import-statement-confirm")).toBeVisible();
    await Promise.all([
      waitForApiResponse(this.page, "/statement-import/confirm", "POST"),
      this.page.getByTestId("import-statement-confirm").click(),
    ]);
    await this.page.getByTestId("import-statement-close-result").click();
    await waitForDialogClosed(this.page);
  }

  /** For a CSV whose headers `StatementImportServiceImpl.autoDetect` can't confidently match —
   * drives the manual column-mapping step (`mapping` values are 0-based column indices) before
   * landing on review. */
  async importStatementWithMapping(input: {
    accountId: string; filePath: string;
    mapping: { date: number; description: number; debit: number; credit: number };
  }): Promise<void> {
    await this.page.getByRole("button", { name: "Import statement" }).click();
    await this.page.getByTestId("import-statement-account-picker-trigger").click();
    await this.page.getByTestId(`import-statement-account-picker-option-${input.accountId}`).click();
    await Promise.all([
      waitForApiResponse(this.page, "/statement-import/preview", "POST"),
      this.page.getByTestId("import-statement-file-input").setInputFiles(input.filePath),
    ]);
    await expect(this.page.getByTestId("import-statement-map-date")).toBeVisible();
    await this.page.getByTestId("import-statement-map-date").selectOption(String(input.mapping.date));
    await this.page.getByTestId("import-statement-map-description").selectOption(String(input.mapping.description));
    await this.page.getByTestId("import-statement-map-debit").selectOption(String(input.mapping.debit));
    await this.page.getByTestId("import-statement-map-credit").selectOption(String(input.mapping.credit));
    await Promise.all([
      waitForApiResponse(this.page, "/statement-import/preview", "POST"),
      this.page.getByRole("button", { name: "Continue" }).click(),
    ]);
    await expect(this.page.getByTestId("import-statement-confirm")).toBeVisible();
    await Promise.all([
      waitForApiResponse(this.page, "/statement-import/confirm", "POST"),
      this.page.getByTestId("import-statement-confirm").click(),
    ]);
    await this.page.getByTestId("import-statement-close-result").click();
    await waitForDialogClosed(this.page);
  }

  /** For a password-protected PDF — drives the password step (PDFBox throwing
   * `InvalidPasswordException` server-side is what flips `needsPassword`) before landing on
   * review. */
  async importStatementWithPassword(input: { accountId: string; filePath: string; password: string }): Promise<void> {
    await this.page.getByRole("button", { name: "Import statement" }).click();
    await this.page.getByTestId("import-statement-account-picker-trigger").click();
    await this.page.getByTestId(`import-statement-account-picker-option-${input.accountId}`).click();
    await Promise.all([
      waitForApiResponse(this.page, "/statement-import/preview", "POST"),
      this.page.getByTestId("import-statement-file-input").setInputFiles(input.filePath),
    ]);
    await expect(this.page.getByTestId("import-statement-password-input")).toBeVisible();
    await this.page.getByTestId("import-statement-password-input").fill(input.password);
    await Promise.all([
      waitForApiResponse(this.page, "/statement-import/preview", "POST"),
      this.page.getByRole("button", { name: "Unlock" }).click(),
    ]);
    await expect(this.page.getByTestId("import-statement-confirm")).toBeVisible();
    await Promise.all([
      waitForApiResponse(this.page, "/statement-import/confirm", "POST"),
      this.page.getByTestId("import-statement-confirm").click(),
    ]);
    await this.page.getByTestId("import-statement-close-result").click();
    await waitForDialogClosed(this.page);
  }

  /** Uploads a CSV and stops at the review step (doesn't confirm) — for tests exercising
   * per-row editing (toggle include, reassign category, bulk-apply) before confirming. */
  async uploadStatementForReview(input: { accountId: string; filePath: string }): Promise<void> {
    await this.page.getByRole("button", { name: "Import statement" }).click();
    await this.page.getByTestId("import-statement-account-picker-trigger").click();
    await this.page.getByTestId(`import-statement-account-picker-option-${input.accountId}`).click();
    await Promise.all([
      waitForApiResponse(this.page, "/statement-import/preview", "POST"),
      this.page.getByTestId("import-statement-file-input").setInputFiles(input.filePath),
    ]);
    await expect(this.page.getByTestId("import-statement-confirm")).toBeVisible();
  }

  async toggleImportRowIncluded(rowIndex: number): Promise<void> {
    await this.page.getByTestId(`import-row-checkbox-${rowIndex}`).click();
  }

  async setImportRowCategory(rowIndex: number, categoryName: string): Promise<void> {
    await this.page.getByTestId(`import-row-category-${rowIndex}-trigger`).click();
    await this.page.getByTestId(`import-row-category-${rowIndex}-panel`).getByText(categoryName, { exact: true }).click();
  }

  /** Clicking a DEBIT row's description area (rather than its checkbox) marks it for bulk
   * categorization — only enabled while the row has no suggested category (see
   * ImportStatementModal's `bulkSelectable`). */
  async selectImportRowForBulk(rowIndex: number): Promise<void> {
    await this.page.getByTestId(`import-row-select-${rowIndex}`).click();
  }

  async applyBulkImportCategory(categoryName: string): Promise<void> {
    await this.page.getByTestId("import-bulk-category-trigger").click();
    await this.page.getByTestId("import-bulk-category-panel").getByText(categoryName, { exact: true }).click();
  }

  async confirmStatementImport(): Promise<void> {
    await Promise.all([
      waitForApiResponse(this.page, "/statement-import/confirm", "POST"),
      this.page.getByTestId("import-statement-confirm").click(),
    ]);
    await this.page.getByTestId("import-statement-close-result").click();
    await waitForDialogClosed(this.page);
  }

  /** Opens Add Expense, picks a category, but leaves amount blank — for validation tests. */
  async attemptAddExpenseWithoutAmount(categoryName: string): Promise<void> {
    await this.page.getByTestId(TEST_IDS.fab.toggle).click();
    await this.page.getByTestId(TEST_IDS.fab.addExpense).click();
    await this.page.getByTestId(TEST_IDS.expenseForm.categoryPickerTrigger).click();
    await this.page.getByTestId(TEST_IDS.expenseForm.categoryPickerPanel).getByText(categoryName, { exact: true }).click();
    await this.page.getByTestId(TEST_IDS.expenseForm.submit).click();
  }

  /** The "All" tab (the default) is the only one whose rows carry an accessible
   * `aria-label="Edit ..., <amount>"` (AllTransactionRow.tsx) — the per-type tabs' own row
   * components don't, so edit/delete flows always go through here regardless of transaction type. */
  async openEditByDescription(description: string): Promise<void> {
    await this.page.getByRole("button", { name: new RegExp(`^Edit ${escapeRegExp(description)}`) }).click();
  }

  async editExpenseAmount(description: string, newAmount: number): Promise<void> {
    await this.openEditByDescription(description);
    await this.page.getByTestId("expense-amount-input").fill(String(newAmount));
    await Promise.all([
      waitForApiResponse(this.page, "/expenses", "PUT"),
      this.page.getByTestId(TEST_IDS.expenseForm.submit).click(),
    ]);
    await waitForDialogClosed(this.page);
  }

  async deleteExpense(description: string): Promise<void> {
    await this.openEditByDescription(description);
    await this.page.getByRole("button", { name: "Delete", exact: true }).click();
    await Promise.all([
      waitForApiResponse(this.page, "/expenses", "DELETE"),
      this.page.getByTestId(TEST_IDS.confirmDialog.confirm).click(),
    ]);
    await waitForDialogClosed(this.page);
  }

  // ── Add Income ───────────────────────────────────────────────────────────
  async addIncome(input: { amount: number; sourceLabel: string; accountName: string; description?: string }): Promise<void> {
    await this.page.getByTestId(TEST_IDS.fab.toggle).click();
    await this.page.getByTestId(TEST_IDS.fab.addIncome).click();
    await this.page.getByTestId("income-amount-input").fill(String(input.amount));
    await this.selectIncomeSource(input.sourceLabel);
    await this.page.getByTestId(TEST_IDS.incomeForm.accountPickerTrigger).click();
    await this.page.getByTestId(TEST_IDS.incomeForm.accountPickerPanel).getByText(input.accountName, { exact: false }).click();
    if (input.description) await this.page.getByLabel("Description (optional)").fill(input.description);
    await Promise.all([
      waitForApiResponse(this.page, "/income", "POST"),
      this.page.getByTestId(TEST_IDS.incomeForm.submit).click(),
    ]);
    await waitForDialogClosed(this.page);
  }

  /** IncomeForm.tsx defaults `source` to "Salary" for a user with no prior income history, and
   * CategoryPicker's panel omits whichever option is already selected — so requesting "Salary"
   * from a fresh user needs no panel interaction at all (the panel legitimately won't contain
   * it), while any other source needs the normal open-panel-and-pick flow. */
  private async selectIncomeSource(sourceLabel: string): Promise<void> {
    const trigger = this.page.getByTestId(TEST_IDS.incomeForm.sourcePickerTrigger);
    if ((await trigger.textContent())?.trim() === sourceLabel) return;
    await trigger.click();
    await this.page.getByTestId(TEST_IDS.incomeForm.sourcePickerPanel).getByText(sourceLabel, { exact: true }).click();
  }

  /** Pass the income's own description — falls back to the row's default label "income entry" when
   * none was set (see AllTransactionRow.tsx's `income.description || "income entry"`). */
  async deleteIncomeEntry(descriptionOrLabel: string): Promise<void> {
    await this.openEditByDescription(descriptionOrLabel);
    await this.page.getByRole("button", { name: "Delete", exact: true }).click();
    await Promise.all([
      waitForApiResponse(this.page, "/income", "DELETE"),
      this.page.getByTestId(TEST_IDS.confirmDialog.confirm).click(),
    ]);
    await waitForDialogClosed(this.page);
  }

  // ── Transfer ─────────────────────────────────────────────────────────────
  async transfer(input: { amount: number; fromAccountName: string; toAccountName: string }): Promise<void> {
    await this.page.getByTestId(TEST_IDS.fab.toggle).click();
    await this.page.getByTestId(TEST_IDS.fab.addTransfer).click();
    await this.page.getByTestId("transfer-amount-input").fill(String(input.amount));
    await this.page.getByTestId(TEST_IDS.transferForm.fromAccountTrigger).click();
    await this.page.getByTestId(TEST_IDS.transferForm.fromAccountPanel).getByText(input.fromAccountName, { exact: false }).click();
    await this.page.getByTestId(TEST_IDS.transferForm.toAccountTrigger).click();
    await this.page.getByTestId(TEST_IDS.transferForm.toAccountPanel).getByText(input.toAccountName, { exact: false }).click();
    await Promise.all([
      waitForApiResponse(this.page, "/accounts/transfer", "POST"),
      this.page.getByTestId(TEST_IDS.transferForm.submit).click(),
    ]);
    await waitForDialogClosed(this.page);
  }

  async deleteTransfer(labelText = "Edit transfer"): Promise<void> {
    await this.page.getByRole("button", { name: new RegExp(`^${escapeRegExp(labelText)}`) }).first().click();
    await this.page.getByRole("button", { name: "Delete", exact: true }).click();
    await Promise.all([
      waitForApiResponse(this.page, "/accounts/transfer", "DELETE"),
      this.page.getByTestId(TEST_IDS.confirmDialog.confirm).click(),
    ]);
    await waitForDialogClosed(this.page);
  }

  async search(text: string): Promise<void> {
    await this.searchInput.fill(text);
  }

  // Scoped to <main> — CategoryPicker's DropdownPanel portals its option list to document.body and
  // leaves it in the DOM (just visually hidden) even while closed, so a page-wide getByText can
  // also match a category/account name sitting unselected in some other still-mounted picker.
  private get main() {
    return this.page.locator("main");
  }

  async expectRowVisible(text: string | RegExp): Promise<void> {
    await expect(this.main.getByText(text).first()).toBeVisible();
  }

  async expectRowNotVisible(text: string | RegExp): Promise<void> {
    await expect(this.main.getByText(text)).toHaveCount(0);
  }

  async expectValidationError(text: string | RegExp): Promise<void> {
    await expect(this.page.getByText(text)).toBeVisible();
  }
}
