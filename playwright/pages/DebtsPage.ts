import {expect, type Locator} from "@playwright/test";
import {BasePage} from "./BasePage";
import {ROUTES} from "../constants/routes";
import {TEST_IDS} from "../constants/testIds";
import {waitForApiResponse, waitForDialogClosed} from "../helpers/wait.helper";
import {pickDate} from "../components/DatePicker";

export class DebtsPage extends BasePage {
  async gotoDebts(): Promise<void> {
    await this.goto(ROUTES.debts);
  }

  tab(id: "ALL" | "LENT" | "BORROWED"): Locator {
    return this.page.getByTestId(`debt-tab-${id}`);
  }

  /** Every transaction row shares the same data-testid — scope to one contact through their
   * ledger card (ContactLedgerCard.tsx) rather than matching row text, since a row no longer
   * repeats the contact's name (that lives once in the ledger card's own header — see
   * groupByContact.ts). If that contact has more than one active transaction, this can match more
   * than one element; most flows in this suite only ever give a contact a single transaction, so
   * this stays their entry point. A SETTLED transaction lives inside that contact's own collapsed
   * "Settled Debts" disclosure (ContactLedgerCard.tsx, same pattern as Accounts' Closed section)
   * and isn't in the DOM until expanded — call settledToggleFor(contactName).click() first when
   * asserting on one you expect to have just settled. */
  card(contactName: string): Locator {
    return this.contactCard(contactName).getByTestId("debt-card");
  }

  /** The per-person ledger card (ContactLedgerCard.tsx) — one per contact, wrapping that
   * person's active + settled transactions. Scope contact-level actions (add another
   * transaction, expand their settled section) through this rather than the page globally, since
   * multiple contacts' cards coexist in this suite's shared debt list. */
  contactCard(contactName: string): Locator {
    return this.page.getByTestId("contact-ledger-card").filter({ hasText: contactName });
  }

  settledToggleFor(contactName: string): Locator {
    return this.contactCard(contactName).getByText(/Settled Debts/);
  }

  private async openCreateModal(type: "LENT" | "BORROWED"): Promise<void> {
    await this.page.getByTestId(TEST_IDS.fab.toggle).click();
    await this.page.getByTestId(type === "LENT" ? "fab-add-debt-lent" : "fab-add-debt-borrowed").click();
  }

  async createDebt(input: {
    type: "LENT" | "BORROWED"; contactName: string; amount: number; note?: string; dueDate?: string;
  }): Promise<void> {
    await this.openCreateModal(input.type);
    await this.page.getByTestId("debt-amount-input").fill(String(input.amount));
    await this.page.getByTestId("debt-contact-name-input").fill(input.contactName);
    if (input.note) await this.page.getByTestId("debt-note-input").fill(input.note);
    if (input.dueDate) await pickDate(this.page, "debt-due-date-input", input.dueDate);
    await Promise.all([
      waitForApiResponse(this.page, "/debts", "POST"),
      this.page.getByTestId("debt-form-submit").click(),
    ]);
    await waitForDialogClosed(this.page);
  }

  /** Opens the create modal from an existing contact's own ledger card ("+ Add"), pre-filled
   * with their name/phone (DebtFormModal's prefillContact) — the multi-transaction-per-person
   * flow, as opposed to createDebt's FAB entry point for a brand-new contact. */
  async addTransactionToContact(contactName: string, input: {
    type: "LENT" | "BORROWED"; amount: number; note?: string;
  }): Promise<void> {
    await this.contactCard(contactName).getByTestId("contact-add-transaction").click();
    if (input.type === "BORROWED") await this.page.getByTestId("debt-type-borrowed").click();
    await this.page.getByTestId("debt-amount-input").fill(String(input.amount));
    if (input.note) await this.page.getByTestId("debt-note-input").fill(input.note);
    await Promise.all([
      waitForApiResponse(this.page, "/debts", "POST"),
      this.page.getByTestId("debt-form-submit").click(),
    ]);
    await waitForDialogClosed(this.page);
  }

  /** Expands the payment-history chip on a contact's (single-transaction) card and deletes its
   * one logged payment. Assumes exactly one payment exists — this suite never needs to
   * disambiguate between several on the same transaction. */
  async deleteOnlyPayment(contactName: string): Promise<void> {
    await this.card(contactName).getByTestId("debt-payment-history-toggle").click();
    await this.card(contactName).getByTestId("debt-payment-delete").click();
    await Promise.all([
      waitForApiResponse(this.page, "/payments", "DELETE"),
      this.page.getByTestId(TEST_IDS.confirmDialog.confirm).click(),
    ]);
    await waitForDialogClosed(this.page);
  }

  /** Opens the create modal, submits with an empty name, and returns the validation error text —
   * doesn't submit a payload, so there's no network wait here (client-side validation blocks it). */
  async attemptCreateWithoutContactName(type: "LENT" | "BORROWED", amount: number): Promise<void> {
    await this.openCreateModal(type);
    await this.page.getByTestId("debt-amount-input").fill(String(amount));
    await this.page.getByTestId("debt-form-submit").click();
  }

  /** debtSchema's own superRefine rejects a due date before the debt date (which defaults to
   * today) — no network wait, since the invalid submission never fires the POST. */
  async attemptCreateWithDueDateBeforeDebtDate(type: "LENT" | "BORROWED", contactName: string, amount: number, dueDateIso: string): Promise<void> {
    await this.openCreateModal(type);
    await this.page.getByTestId("debt-amount-input").fill(String(amount));
    await this.page.getByTestId("debt-contact-name-input").fill(contactName);
    await pickDate(this.page, "debt-due-date-input", dueDateIso);
    await this.page.getByTestId("debt-form-submit").click();
  }

  async recordPayment(contactName: string, amount: number, note?: string): Promise<void> {
    await this.card(contactName).getByTestId("debt-card-pay-button").click();
    await this.page.getByTestId("debt-payment-amount-input").fill(String(amount));
    if (note) await this.page.getByLabel("Note (optional)").fill(note);
    await Promise.all([
      waitForApiResponse(this.page, "/payments", "POST"),
      this.page.getByTestId("debt-payment-submit").click(),
    ]);
    await waitForDialogClosed(this.page);
  }

  async editDebt(contactName: string): Promise<void> {
    await this.card(contactName).click();
  }

  async editDebtAmount(contactName: string, newAmount: number): Promise<void> {
    await this.editDebt(contactName);
    await this.page.getByTestId("debt-amount-input").fill(String(newAmount));
    await Promise.all([
      waitForApiResponse(this.page, "/debts", "PUT"),
      this.page.getByTestId("debt-form-submit").click(),
    ]);
    await waitForDialogClosed(this.page);
  }

  async deleteDebt(contactName: string): Promise<void> {
    await this.editDebt(contactName);
    await this.page.getByRole("button", { name: "Delete", exact: true }).click();
    await Promise.all([
      waitForApiResponse(this.page, "/debts", "DELETE"),
      this.page.getByTestId(TEST_IDS.confirmDialog.confirm).click(),
    ]);
    await waitForDialogClosed(this.page);
  }

  async expectDebtVisible(contactName: string): Promise<void> {
    await expect(this.card(contactName)).toBeVisible();
  }

  async expectDebtNotVisible(contactName: string): Promise<void> {
    await expect(this.card(contactName)).toHaveCount(0);
  }

  async expectStatus(contactName: string, status: "Active" | "Partial" | "Settled"): Promise<void> {
    await expect(this.card(contactName).getByText(status, { exact: true })).toBeVisible();
  }

  async expectNetPosition(contactName: string, text: string | RegExp): Promise<void> {
    await expect(this.contactCard(contactName).getByTestId("contact-net-position")).toHaveText(text);
  }

  async expectValidationError(text: string | RegExp): Promise<void> {
    await expect(this.page.getByText(text)).toBeVisible();
  }

  /** Opens the payment modal and submits an amount over the remaining balance — no network wait,
   * since PaymentModal's own client-side check should block the submit before any request fires. */
  async attemptOverpay(contactName: string, amount: number): Promise<void> {
    await this.card(contactName).getByTestId("debt-card-pay-button").click();
    await this.page.getByTestId("debt-payment-amount-input").fill(String(amount));
    await this.page.getByTestId("debt-payment-submit").click();
  }
}
