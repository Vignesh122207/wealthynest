import {type Download, expect, type Page} from "@playwright/test";
import {BasePage} from "./BasePage";
import {ROUTES} from "../constants/routes";
import {TEST_IDS} from "../constants/testIds";

/** Models wealthynest-web's /reports route — three tabs (Monthly, Annual, Export Data), all
 * mounted simultaneously and toggled via CSS `display` (see reports/page.tsx), which is why every
 * button here needs a tab-qualified testid rather than a shared one. Every action here is a
 * client-side blob download (`<a download>.click()`, see reportHelpers.ts) or a `window.open`
 * print window — nothing mutates server data, so there's no waitForApiResponse/waitForDialogClosed
 * pattern to reuse from the other page objects. */
export class ReportsPage extends BasePage {
  async gotoReports(): Promise<void> {
    await this.goto(ROUTES.reports);
  }

  async selectTab(id: "monthly" | "annual" | "export"): Promise<void> {
    await this.page.getByTestId(TEST_IDS.reports.tab(id)).click();
  }

  async downloadMonthlyCsv(): Promise<Download> {
    const [download] = await Promise.all([
      this.page.waitForEvent("download"),
      this.page.getByTestId(TEST_IDS.reports.monthlyCsv).click(),
    ]);
    return download;
  }

  async downloadAnnualCsv(): Promise<Download> {
    const [download] = await Promise.all([
      this.page.waitForEvent("download"),
      this.page.getByTestId(TEST_IDS.reports.annualCsv).click(),
    ]);
    return download;
  }

  async downloadExport(key: string): Promise<Download> {
    const [download] = await Promise.all([
      this.page.waitForEvent("download"),
      this.page.getByTestId(TEST_IDS.reports.exportCsv(key)).click(),
    ]);
    return download;
  }

  /** openPrintWindow (reportHelpers.ts) does a real `window.open` — caught as a new page in the
   * same browser context, not a download. */
  async openMonthlyPdf(): Promise<Page> {
    const [popup] = await Promise.all([
      this.page.context().waitForEvent("page"),
      this.page.getByTestId(TEST_IDS.reports.monthlyPdf).click(),
    ]);
    await popup.waitForLoadState();
    return popup;
  }

  async expectLoaded(): Promise<void> {
    await expect(this.headerTitle).toHaveText("Reports");
  }
}
