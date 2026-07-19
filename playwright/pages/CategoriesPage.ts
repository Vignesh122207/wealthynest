import {expect} from "@playwright/test";
import {BasePage} from "./BasePage";
import {ROUTES} from "../constants/routes";
import {TEST_IDS} from "../constants/testIds";
import {waitForApiResponse, waitForDialogClosed} from "../helpers/wait.helper";

/** Models wealthynest-web's /settings/categories route — custom EXPENSE/INCOME category CRUD.
 * System categories render read-only (no edit handler); only custom ones are editable/deletable. */
export class CategoriesPage extends BasePage {
  async gotoCategories(): Promise<void> {
    await this.goto(ROUTES.settings + "/categories");
  }

  async switchTab(type: "EXPENSE" | "INCOME"): Promise<void> {
    await this.page.getByTestId(`category-tab-${type}`).click();
  }

  async createCategory(type: "EXPENSE" | "INCOME", name: string): Promise<void> {
    await this.page.getByTestId(TEST_IDS.fab.toggle).click();
    await this.page.getByTestId(TEST_ID_FAB[type]).click();
    await this.page.getByTestId("category-name-input").fill(name);
    await Promise.all([
      waitForApiResponse(this.page, "/categories", "POST"),
      this.page.getByTestId("category-form-submit").click(),
    ]);
  }

  /** CategoryRow gives every editable (custom) row an accessible
   * `aria-label="Edit <name> category"` — no dedicated testid needed to open it. */
  async openEdit(name: string): Promise<void> {
    await this.page.getByRole("button", { name: `Edit ${name} category`, exact: true }).click();
  }

  async deleteCategory(name: string): Promise<void> {
    await this.openEdit(name);
    await this.page.getByRole("button", { name: "Delete", exact: true }).click();
    await Promise.all([
      waitForApiResponse(this.page, "/categories", "DELETE"),
      this.page.getByTestId("confirm-dialog-confirm").click(),
    ]);
    await waitForDialogClosed(this.page);
  }

  async expectCategoryVisible(name: string): Promise<void> {
    await expect(this.page.getByText(name).first()).toBeVisible();
  }

  async expectCategoryNotVisible(name: string): Promise<void> {
    await expect(this.page.getByRole("button", { name: `Edit ${name} category`, exact: true })).toHaveCount(0);
  }
}

const TEST_ID_FAB = { EXPENSE: "fab-add-expense-category", INCOME: "fab-add-income-category" } as const;
