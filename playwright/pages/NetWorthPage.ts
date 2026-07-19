import {expect, type Locator} from "@playwright/test";
import {BasePage} from "./BasePage";
import {ROUTES} from "../constants/routes";
import {TEST_IDS} from "../constants/testIds";
import {waitForApiResponse, waitForDialogClosed} from "../helpers/wait.helper";

/** Models wealthynest-web's /assets route (page title "Net Worth") — Assets and Liabilities,
 * both reached via the FloatingActionButton, both editable through the same row-click ->
 * modal -> ConfirmDialog pattern as every other module. */
export class NetWorthPage extends BasePage {
  async gotoNetWorth(): Promise<void> {
    await this.goto(ROUTES.netWorth);
  }

  // ── Assets ──────────────────────────────────────────────────────────────
  async createAsset(input: { name: string; assetType: string; currentValue: number; institution?: string }): Promise<void> {
    await this.page.getByTestId(TEST_IDS.fab.toggle).click();
    await this.page.getByTestId(TEST_IDS.fab.addAsset).click();
    await this.page.getByTestId(TEST_IDS.asset.nameInput).fill(input.name);
    await this.page.getByTestId(TEST_IDS.asset.typeSelect).selectOption(input.assetType);
    await this.page.getByTestId(TEST_IDS.asset.valueInput).fill(String(input.currentValue));
    if (input.institution) await this.page.getByLabel("Institution / Source").fill(input.institution);
    await Promise.all([
      waitForApiResponse(this.page, "/assets", "POST"),
      this.page.getByTestId(TEST_IDS.asset.submit).click(),
    ]);
    await waitForDialogClosed(this.page);
  }

  /** AssetRow gives every row an accessible `aria-label="Edit <name> asset"` — no dedicated
   * testid needed to open it. */
  async openAssetEdit(name: string): Promise<void> {
    await this.page.getByRole("button", { name: `Edit ${name} asset`, exact: true }).click();
  }

  async editAssetValue(name: string, newValue: number): Promise<void> {
    await this.openAssetEdit(name);
    await this.page.getByTestId(TEST_IDS.asset.valueInput).fill(String(newValue));
    await Promise.all([
      waitForApiResponse(this.page, "/assets", "PUT"),
      this.page.getByTestId(TEST_IDS.asset.submit).click(),
    ]);
    await waitForDialogClosed(this.page);
  }

  async deleteAsset(name: string): Promise<void> {
    await this.openAssetEdit(name);
    await this.page.getByRole("button", { name: "Delete", exact: true }).click();
    await Promise.all([
      waitForApiResponse(this.page, "/assets", "DELETE"),
      this.page.getByTestId(TEST_IDS.confirmDialog.confirm).click(),
    ]);
    await waitForDialogClosed(this.page);
  }

  assetRow(name: string): Locator {
    return this.page.getByRole("button", { name: `Edit ${name} asset`, exact: true });
  }

  async expectAssetVisible(name: string | RegExp): Promise<void> {
    await expect(this.page.getByText(name).first()).toBeVisible();
  }

  async expectAssetNotVisible(name: string): Promise<void> {
    await expect(this.page.getByRole("button", { name: `Edit ${name} asset`, exact: true })).toHaveCount(0);
  }

  // ── Liabilities ─────────────────────────────────────────────────────────
  async createLiability(input: { name: string; liabilityType: string; outstandingAmount: number; principalAmount: number }): Promise<void> {
    await this.page.getByTestId(TEST_IDS.fab.toggle).click();
    await this.page.getByTestId(TEST_IDS.fab.addLiability).click();
    await this.page.getByTestId(TEST_IDS.liability.nameInput).fill(input.name);
    await this.page.getByTestId(TEST_IDS.liability.typeSelect).selectOption(input.liabilityType);
    await this.page.getByTestId(TEST_IDS.liability.outstandingInput).fill(String(input.outstandingAmount));
    await this.page.getByLabel("Original Loan Amount").fill(String(input.principalAmount));
    await Promise.all([
      waitForApiResponse(this.page, "/liabilities", "POST"),
      this.page.getByTestId(TEST_IDS.liability.submit).click(),
    ]);
    await waitForDialogClosed(this.page);
  }

  /** LiabilityRow gives every *editable* row (non-derived) an accessible
   * `aria-label="Edit <name> liability"` — auto-linked (derived) liabilities render as a plain
   * div instead and aren't editable at all. */
  async openLiabilityEdit(name: string): Promise<void> {
    await this.page.getByRole("button", { name: `Edit ${name} liability`, exact: true }).click();
  }

  async deleteLiability(name: string): Promise<void> {
    await this.openLiabilityEdit(name);
    await this.page.getByRole("button", { name: "Delete", exact: true }).click();
    await Promise.all([
      waitForApiResponse(this.page, "/liabilities", "DELETE"),
      this.page.getByTestId(TEST_IDS.confirmDialog.confirm).click(),
    ]);
    await waitForDialogClosed(this.page);
  }

  async expectLiabilityVisible(name: string | RegExp): Promise<void> {
    await expect(this.page.getByText(name).first()).toBeVisible();
  }

  async expectLiabilityNotVisible(name: string): Promise<void> {
    await expect(this.page.getByRole("button", { name: `Edit ${name} liability`, exact: true })).toHaveCount(0);
  }
}
