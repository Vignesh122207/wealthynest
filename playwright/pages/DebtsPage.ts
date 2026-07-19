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

  /** Every card in the list shares the same data-testid — scope to one contact via .filter(). */
  card(contactName: string): Locator {
    return this.page.getByTestId("debt-card").filter({ hasText: contactName });
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

  async expectValidationError(text: string | RegExp): Promise<void> {
    await expect(this.page.getByText(text)).toBeVisible();
  }
}
