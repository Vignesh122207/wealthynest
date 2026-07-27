import {expect} from "@playwright/test";
import {BasePage} from "./BasePage";
import {ROUTES} from "../constants/routes";
import {TEST_IDS} from "../constants/testIds";
import {waitForApiResponse, waitForDialogClosed} from "../helpers/wait.helper";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export class BudgetsPage extends BasePage {
  async gotoBudgets(): Promise<void> {
    await this.goto(ROUTES.budgets);
  }

  private async createBudget(type: "MONTHLY" | "YEARLY", input: { categoryName: string; amount: number }): Promise<void> {
    await this.page.getByTestId(TEST_IDS.fab.toggle).click();
    await this.page.getByTestId(TEST_IDS.fab.addBudget).click();
    if (type === "YEARLY") await this.page.getByTestId("budget-type-YEARLY").click();
    await this.page.getByTestId(TEST_IDS.budgetForm.categoryPickerTrigger).click();
    await this.page.getByTestId(TEST_IDS.budgetForm.categoryPickerPanel).getByText(input.categoryName, { exact: true }).click();
    await this.page.getByTestId("budget-amount-input").fill(String(input.amount));
    await Promise.all([
      waitForApiResponse(this.page, "/budgets", "POST"),
      this.page.getByTestId(TEST_IDS.budgetForm.submit).click(),
    ]);
    await waitForDialogClosed(this.page);
  }

  async createMonthlyBudget(input: { categoryName: string; amount: number }): Promise<void> {
    await this.createBudget("MONTHLY", input);
  }

  async createYearlyBudget(input: { categoryName: string; amount: number }): Promise<void> {
    await this.createBudget("YEARLY", input);
  }

  /** The Monthly/Yearly lists are tabbed (BudgetTypeTabs) — only the active tab's budgets are in
   * the DOM at all. Creating a budget auto-switches to its tab (see budgets/page.tsx's onSubmit),
   * so most flows never need this directly; it's here for anything that has to check the other
   * tab's list without creating something new in it. */
  async selectBudgetTypeTab(type: "MONTHLY" | "YEARLY"): Promise<void> {
    await this.page.getByTestId(`budget-list-tab-${type}`).click();
  }

  /** BudgetRow (budgets/page.tsx) gives every row an accessible
   * `aria-label="Edit <category> budget, <pct>% used"` — no dedicated testid needed to open it. */
  async openEditByCategory(categoryName: string): Promise<void> {
    await this.page.getByRole("button", { name: new RegExp(`^Edit ${escapeRegExp(categoryName)} budget`) }).click();
  }

  /** useUpdateBudget's onSuccess (useBudgets.ts) both closes the modal AND calls
   * invalidateQueries — the second is an independent network round trip that resolves after the
   * modal is already gone. Reopening the same edit form before that refetch lands opens it with
   * the pre-edit values baked into useForm's defaultValues (only read once, at mount, never
   * re-synced) — so this waits for that GET too, not just the PUT, before returning. */
  private async submitEditAndWait(): Promise<void> {
    await Promise.all([
      waitForApiResponse(this.page, "/budgets", "PUT"),
      waitForApiResponse(this.page, /\/budgets\?/, "GET"),
      this.page.getByTestId("budget-edit-submit").click(),
    ]);
    await waitForDialogClosed(this.page);
  }

  async editBudgetAmount(categoryName: string, newAmount: number): Promise<void> {
    await this.openEditByCategory(categoryName);
    await this.page.getByTestId("budget-edit-amount-input").fill(String(newAmount));
    await this.submitEditAndWait();
  }

  async editAlertThreshold(categoryName: string, percent: "50" | "60" | "70" | "75" | "80" | "90" | "100"): Promise<void> {
    await this.openEditByCategory(categoryName);
    await this.page.getByLabel("Alert At (%)").selectOption(percent);
    await this.submitEditAndWait();
  }

  async deleteBudget(categoryName: string): Promise<void> {
    await this.openEditByCategory(categoryName);
    // exact: true — unqualified "Delete" otherwise substring-matches the CategoryPicker's own
    // per-category "Delete <name> category" buttons too (Playwright's role name match isn't exact
    // by default), and this file creates several categories whose delete buttons are in the DOM
    // even while visually hidden (opacity-0 until hover).
    await this.page.getByRole("button", { name: "Delete", exact: true }).click();
    // Same invalidateQueries-is-a-second-round-trip gap as submitEditAndWait — the DELETE
    // resolving doesn't mean the list's own refetch has landed yet, so a follow-up
    // expectBudgetNotVisible right after can still see the stale (pre-delete) list.
    await Promise.all([
      waitForApiResponse(this.page, "/budgets", "DELETE"),
      waitForApiResponse(this.page, /\/budgets\?/, "GET"),
      this.page.getByTestId(TEST_IDS.confirmDialog.confirm).click(),
    ]);
    await waitForDialogClosed(this.page);
  }

  // Scoped to <main> — CategoryPicker's DropdownPanel portals its option list to document.body and
  // leaves it in the DOM (just visually hidden) even while closed, so a page-wide getByText also
  // matches a category name sitting unselected in some other still-mounted picker instance. main
  // excludes that portal entirely.
  private get main() {
    return this.page.locator("main");
  }

  async expectBudgetVisible(categoryName: string | RegExp): Promise<void> {
    await expect(this.main.getByText(categoryName).first()).toBeVisible();
  }

  // Not "category name absent from the page" — deleting a budget doesn't delete the underlying
  // category (it can still be in use elsewhere, e.g. on expenses), and it can still legitimately
  // appear elsewhere on this page too (e.g. selectable in the "New Budget" category picker). What
  // actually indicates the budget itself is gone is its row's accessible label (BudgetRow's
  // `aria-label="Edit <category> budget, ..."`) no longer existing.
  async expectBudgetNotVisible(categoryName: string): Promise<void> {
    await expect(this.page.getByRole("button", { name: new RegExp(`^Edit ${escapeRegExp(categoryName)} budget`) })).toHaveCount(0);
  }

  /** The edit form's useForm({defaultValues}) only reads the row's data once, at mount, and won't
   * re-sync if the underlying list refetches a moment later (a real React Hook Form behavior, not
   * a bug) — so even after confirming the refetch's own network response, there's a further small
   * window before React actually commits that data to the row this reopens against. Retries the
   * whole close-reopen-check cycle rather than a single check for that reason. */
  async expectAlertThreshold(categoryName: string, percent: string): Promise<void> {
    await expect(async () => {
      // Escape first — a no-op if nothing's open, but closes a modal left over from a prior
      // failed attempt in this same retry loop so the next attempt starts from a clean list view.
      await this.page.keyboard.press("Escape");
      await this.openEditByCategory(categoryName);
      await expect(this.page.getByLabel("Alert At (%)")).toHaveValue(percent, { timeout: 2000 });
    }).toPass({ timeout: 15000 });
    await this.page.getByRole("button", { name: "Close" }).click();
  }

  async expectValidationError(text: string | RegExp): Promise<void> {
    await expect(this.page.getByText(text)).toBeVisible();
  }

  /** Budgets are one-per-category-per-month — availableCategories (budgets/page.tsx) filters out
   * any category that already has one, so a category with an existing budget this month simply
   * never appears in the create form's picker. Opens that picker and asserts exactly that. */
  async expectCategoryNotInCreatePicker(categoryName: string): Promise<void> {
    await this.page.getByTestId(TEST_IDS.fab.toggle).click();
    await this.page.getByTestId(TEST_IDS.fab.addBudget).click();
    await this.page.getByTestId(TEST_IDS.budgetForm.categoryPickerTrigger).click();
    await expect(this.page.getByTestId(TEST_IDS.budgetForm.categoryPickerPanel).getByText(categoryName, { exact: true })).toHaveCount(0);
  }
}
