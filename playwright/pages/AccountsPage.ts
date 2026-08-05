import {expect, type Locator} from "@playwright/test";
import {BasePage} from "./BasePage";
import {ROUTES} from "../constants/routes";
import {TEST_IDS} from "../constants/testIds";
import {waitForApiResponse, waitForDialogClosed} from "../helpers/wait.helper";

export class AccountsPage extends BasePage {
  async gotoAccounts(): Promise<void> {
    await this.goto(ROUTES.accounts);
  }

  get addAccountFab(): Locator {
    return this.page.getByTestId(TEST_IDS.fab.addAccount);
  }
  get bankNameInput(): Locator {
    return this.page.getByTestId(TEST_IDS.account.bankNameInput);
  }
  get openingBalanceInput(): Locator {
    return this.page.getByTestId("account-opening-balance-input");
  }
  get actualBalanceInput(): Locator {
    return this.page.getByTestId("account-actual-balance-input");
  }
  get submitButton(): Locator {
    return this.page.getByTestId(TEST_IDS.account.formSubmit);
  }

  accountTypeButton(type: string): Locator {
    return this.page.getByTestId(TEST_IDS.account.typeButton(type));
  }

  /** The FAB's "Add Account" action always opens the modal on Bank Account (see
   * accounts/page.tsx's `openCreate("BANK_ACCOUNT")`) — every create flow starts here and picks
   * its real type from the grid, which only renders while modal === "create". Public so a test
   * can inspect the type grid itself (e.g. the singleton-type disabled state) without completing
   * a full creation. */
  async openCreateModal(): Promise<void> {
    await this.page.getByTestId(TEST_IDS.fab.toggle).click();
    await this.addAccountFab.click();
  }

  /** Submits and waits for the accounts response, not just the click — clicking Submit and
   * immediately asserting the change is racy; the row doesn't update until the round trip (create
   * POST, update PUT, or archive/delete) actually completes. Also waits for the modal's backdrop to
   * actually detach (see waitForDialogClosed) before returning — otherwise a second modal-opening
   * call right after (e.g. creating two accounts back to back) can hit the still-present backdrop
   * intercepting its click. */
  private async submitAndWait(method: "POST" | "PUT" = "POST"): Promise<void> {
    await Promise.all([
      waitForApiResponse(this.page, "/accounts", method),
      this.submitButton.click(),
    ]);
    await waitForDialogClosed(this.page);
  }

  async createBankAccount(input: { bankName: string; openingBalance: number }): Promise<void> {
    await this.openCreateModal();
    await this.accountTypeButton("BANK_ACCOUNT").click();
    await this.bankNameInput.fill(input.bankName);
    await this.openingBalanceInput.fill(String(input.openingBalance));
    await this.submitAndWait();
  }

  async createCashWalletAccount(openingBalance: number): Promise<void> {
    await this.openCreateModal();
    await this.accountTypeButton("CASH_WALLET").click();
    await this.openingBalanceInput.fill(String(openingBalance));
    await this.submitAndWait();
  }

  /** Emergency Fund is no longer its own account type — it's a Purpose tag on a regular Bank
   * Account (see Purpose taxonomy in accounts/schemas/account.schema.ts). This creates a Bank
   * Account and tags it accordingly, the only way to get an "Emergency Fund" account today. */
  async createEmergencyFundAccount(openingBalance: number): Promise<void> {
    await this.openCreateModal();
    await this.accountTypeButton("BANK_ACCOUNT").click();
    await this.bankNameInput.fill("Emergency Fund Bank");
    await this.openingBalanceInput.fill(String(openingBalance));
    await this.page.getByLabel("Purpose (optional)").selectOption({ label: "Emergency Fund" });
    await this.submitAndWait();
  }

  async createCreditCard(input: { bankName: string; creditLimit: number; outstanding: number }): Promise<void> {
    await this.openCreateModal();
    await this.accountTypeButton("CREDIT_CARD").click();
    await this.bankNameInput.fill(input.bankName);
    await this.page.getByPlaceholder("e.g. 100000").fill(String(input.creditLimit));
    await this.openingBalanceInput.fill(String(input.outstanding));
    await this.submitAndWait();
  }

  /** Doesn't select a loan type — used to assert the "Loan type is required" validation. */
  async attemptCreateLoanWithoutType(bankName: string, outstanding: number): Promise<void> {
    await this.openCreateModal();
    await this.accountTypeButton("LOAN").click();
    await this.bankNameInput.fill(bankName);
    await this.openingBalanceInput.fill(String(outstanding));
    await this.submitButton.click();
  }

  async createLoan(input: { bankName: string; loanType: string; outstanding: number }): Promise<void> {
    await this.openCreateModal();
    await this.accountTypeButton("LOAN").click();
    await this.page.getByLabel("Loan Type").selectOption({ label: input.loanType });
    await this.bankNameInput.fill(input.bankName);
    await this.openingBalanceInput.fill(String(input.outstanding));
    await this.submitAndWait();
  }

  /** Every account card's whole surface opens Edit (AccountCard.tsx: `onClick={onEdit}` on the
   * card root) — no dedicated "Edit" button to target, so this clicks the card via its visible
   * name text instead of adding a testid that would duplicate what's already there. */
  async openEdit(accountName: string): Promise<void> {
    await this.page.getByText(accountName, { exact: true }).first().click();
  }

  async reconcileBalance(accountName: string, actualBalance: number): Promise<void> {
    await this.openEdit(accountName);
    await this.actualBalanceInput.fill(String(actualBalance));
    await this.submitAndWait("PUT");
  }

  /** The Archive icon in the edit modal doesn't archive directly — it closes that modal and opens
   * a generic ConfirmDialog (accounts/page.tsx's askConfirm); the PATCH only fires once that's
   * confirmed. Unscoped (not `getByRole("dialog")`) — unlike most modals in the app,
   * AccountFormModal uses its own bespoke overlay markup rather than the shared
   * TransactionModalOverlay, so it carries no role="dialog" to scope by. */
  async archiveAccount(accountName: string): Promise<void> {
    await this.openEdit(accountName);
    await this.page.getByRole("button", { name: "Archive" }).click();
    await Promise.all([
      waitForApiResponse(this.page, "/archive", "PATCH"),
      this.page.getByTestId(TEST_IDS.confirmDialog.confirm).click(),
    ]);
    await waitForDialogClosed(this.page);
  }

  get archivedAccountsToggle(): Locator {
    return this.page.getByText(/Archived Accounts/);
  }

  /** Accounts can only be permanently deleted from the Archived Accounts list (see
   * ArchivedAccountsSection.tsx) — there's no direct delete on an active account, so this
   * archives first if the account isn't already archived. Delete only ever succeeds when the
   * account has zero history (no expense/income/transfer/investment-link/goal ever referenced
   * it) — the API rejects with a 409 otherwise; there's no "also delete transactions" override
   * anymore, so a test exercising a with-history account should expect the rejection instead
   * (see expectDeleteBlocked below). */
  async deleteAccount(accountName: string, opts?: { alreadyArchived?: boolean }): Promise<void> {
    if (!opts?.alreadyArchived) await this.archiveAccount(accountName);
    await this.archivedAccountsToggle.click();
    const row = this.page.getByTestId("archived-account-row").filter({ hasText: accountName });
    await row.getByRole("button", { name: "Delete", exact: true }).click();
    await Promise.all([
      waitForApiResponse(this.page, "/accounts", "DELETE"),
      this.page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click(),
    ]);
    await waitForDialogClosed(this.page);
  }

  /** Attempts delete on an already-archived, history-bearing account and asserts the API
   * rejects it with 409 — the account stays listed since the row never disappears. */
  async attemptDeleteAccountWithHistory(accountName: string): Promise<void> {
    await this.archivedAccountsToggle.click();
    const row = this.page.getByTestId("archived-account-row").filter({ hasText: accountName });
    await row.getByRole("button", { name: "Delete", exact: true }).click();
    const [response] = await Promise.all([
      waitForApiResponse(this.page, "/accounts", "DELETE"),
      this.page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click(),
    ]);
    expect(response.status()).toBe(409);
  }

  // Scoped to <main> — a just-fired toast (e.g. "Becker - Grady Bank deleted") can still contain
  // the account name for a few seconds after the action, which a page-wide getByText would also
  // match and turn a real 0-left-behind state into a false "still visible"/wrong-count result.
  private get main() {
    return this.page.locator("main");
  }

  // Explicit 10s, not the 5s default — by the last test in a serial regression run against one
  // shared user, this list has accumulated every account earlier tests in the file created and
  // never deleted, and rendering that many cards can outrun the default under CI/parallel-project
  // CPU contention even though the underlying create genuinely already succeeded.
  async expectAccountVisible(name: string | RegExp): Promise<void> {
    await expect(this.main.getByText(name).first()).toBeVisible({ timeout: 10000 });
  }

  async expectAccountNotVisible(name: string | RegExp): Promise<void> {
    await expect(this.main.getByText(name)).toHaveCount(0, { timeout: 10000 });
  }

  async expectTypeButtonDisabled(type: string): Promise<void> {
    await expect(this.accountTypeButton(type)).toBeDisabled();
  }

  async expectValidationError(text: string | RegExp): Promise<void> {
    await expect(this.page.getByText(text)).toBeVisible();
  }
}
