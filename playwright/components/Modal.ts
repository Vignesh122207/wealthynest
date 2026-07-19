import type {Page} from "@playwright/test";

/** Generic chrome shared by every modal in the app (TransactionModalOverlay /
 * FormModalShell / ConfirmDialog) — Escape-to-close and backdrop-click-to-close both wire
 * through the same dismiss handler, so a page object never needs to know which specific modal
 * is open to close it. */
export class Modal {
  constructor(private readonly page: Page) {}

  async closeWithEscape(): Promise<void> {
    await this.page.keyboard.press("Escape");
  }
}
