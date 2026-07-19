import {expect} from "@playwright/test";
import {BasePage} from "./BasePage";
import {ROUTES} from "../constants/routes";
import {waitForApiResponse} from "../helpers/wait.helper";

export class SupportPage extends BasePage {
  async gotoContact(): Promise<void> {
    await this.goto(ROUTES.settingsSupportContact);
  }

  async gotoFaq(): Promise<void> {
    await this.goto(ROUTES.settingsSupportFaq);
  }

  async gotoTickets(): Promise<void> {
    await this.goto(ROUTES.settingsSupportTickets);
  }

  async gotoNewTicket(): Promise<void> {
    await this.goto(`${ROUTES.settingsSupportTickets}/new`);
  }

  /** Submits and waits for the redirect to the new ticket's detail page — createTicket's
   * onSuccess navigates to /settings/support/tickets/{id}, not back to the list. */
  async createTicket(input: { subject: string; description: string }): Promise<void> {
    await this.page.getByTestId("ticket-subject-input").fill(input.subject);
    await this.page.getByTestId("ticket-description-input").fill(input.description);
    await Promise.all([
      waitForApiResponse(this.page, "/support/tickets", "POST"),
      this.page.getByTestId("ticket-submit").click(),
    ]);
    await this.page.waitForURL(/\/settings\/support\/tickets\/[^/]+$/);
  }

  async expectTicketVisible(subject: string): Promise<void> {
    await expect(this.page.getByText(subject).first()).toBeVisible();
  }

  async toggleFaq(question: string): Promise<void> {
    await this.page.getByRole("button", { name: question }).click();
  }

  async expectFaqAnswerVisible(answerText: string | RegExp): Promise<void> {
    await expect(this.page.getByText(answerText).first()).toBeVisible();
  }

  async expectEmailVisible(email: string): Promise<void> {
    await expect(this.page.getByText(email).first()).toBeVisible();
  }

  async clickFaqLink(): Promise<void> {
    await this.page.getByRole("link", { name: /FAQ/ }).click();
    await this.page.waitForURL(/\/settings\/support\/faq$/);
  }
}
