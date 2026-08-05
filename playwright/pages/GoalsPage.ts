import {expect, type Locator} from "@playwright/test";
import {BasePage} from "./BasePage";
import {ROUTES} from "../constants/routes";
import {TEST_IDS} from "../constants/testIds";
import {waitForApiResponse, waitForDialogClosed} from "../helpers/wait.helper";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export class GoalsPage extends BasePage {
  async gotoGoals(): Promise<void> {
    await this.goto(ROUTES.goals);
  }

  /** Every card shares the same data-testid — scope to one goal via .filter(). */
  card(name: string): Locator {
    return this.page.getByTestId("goal-card").filter({ hasText: name });
  }

  async createGoal(input: { name: string; targetAmount: number }): Promise<void> {
    await this.page.getByTestId(TEST_IDS.fab.toggle).click();
    await this.page.getByTestId(TEST_IDS.fab.addGoal).click();
    await this.page.getByTestId("goal-name-input").fill(input.name);
    await this.page.getByTestId("goal-target-amount-input").fill(String(input.targetAmount));
    await Promise.all([
      waitForApiResponse(this.page, "/goals", "POST"),
      this.page.getByTestId(TEST_IDS.goalForm.submit).click(),
    ]);
    await waitForDialogClosed(this.page);
  }

  /** Same close-reopen-retry shape as RecurringRulesPage.selectPickerOption — the account picker's
   * option list depends on a useAccounts() fetch that isn't guaranteed to have landed and
   * re-rendered by the time this clicks the trigger, so a plain click can hang against a stale
   * empty panel. */
  private async selectAccountPickerOption(accountId: string): Promise<void> {
    await expect(async () => {
      await this.page.getByTestId("goal-account-picker-trigger").click();
      await this.page.getByTestId(`goal-account-picker-option-${accountId}`).click({ timeout: 3000 });
    }).toPass({ timeout: 30000 });
  }

  /** Links the account at creation time — AccountPicker's onChange (GoalForm.tsx) auto-fills
   * savedAmount from the account's currentBalance, same as a real user picking it. */
  async createGoalLinkedToAccount(input: { name: string; targetAmount: number; accountId: string }): Promise<void> {
    await this.page.getByTestId(TEST_IDS.fab.toggle).click();
    await this.page.getByTestId(TEST_IDS.fab.addGoal).click();
    await this.page.getByTestId("goal-name-input").fill(input.name);
    await this.page.getByTestId("goal-target-amount-input").fill(String(input.targetAmount));
    await this.selectAccountPickerOption(input.accountId);
    await Promise.all([
      waitForApiResponse(this.page, "/goals", "POST"),
      this.page.getByTestId(TEST_IDS.goalForm.submit).click(),
    ]);
    await waitForDialogClosed(this.page);
  }

  /** Opens the create modal, fills a target (and optionally saved) amount that goalSchema's own
   * validation should reject, then submits — no network wait, since a genuinely invalid submission
   * never fires the POST (client-side zod validation blocks it before any request goes out). */
  async attemptCreateInvalid(input: { name: string; targetAmount: number; savedAmount?: number }): Promise<void> {
    await this.page.getByTestId(TEST_IDS.fab.toggle).click();
    await this.page.getByTestId(TEST_IDS.fab.addGoal).click();
    await this.page.getByTestId("goal-name-input").fill(input.name);
    await this.page.getByTestId("goal-target-amount-input").fill(String(input.targetAmount));
    if (input.savedAmount !== undefined) {
      await this.page.getByLabel("Amount Already Saved").fill(String(input.savedAmount));
    }
    await this.page.getByTestId(TEST_IDS.goalForm.submit).click();
  }

  /** GoalCard gives every card an accessible `aria-label="Edit <name> goal, <pct>% saved"` — no
   * dedicated testid needed to open it. */
  async openEditByName(name: string): Promise<void> {
    await this.page.getByRole("button", { name: new RegExp(`^Edit ${escapeRegExp(name)} goal`) }).click();
  }

  async editTargetAmount(name: string, newTargetAmount: number): Promise<void> {
    await this.openEditByName(name);
    await this.page.getByTestId("goal-target-amount-input").fill(String(newTargetAmount));
    await Promise.all([
      waitForApiResponse(this.page, "/goals", "PUT"),
      waitForApiResponse(this.page, /\/goals$/, "GET"),
      this.page.getByTestId(TEST_IDS.goalForm.submit).click(),
    ]);
    await waitForDialogClosed(this.page);
  }

  async deleteGoal(name: string): Promise<void> {
    await this.openEditByName(name);
    await this.page.getByRole("button", { name: "Delete", exact: true }).click();
    await Promise.all([
      waitForApiResponse(this.page, "/goals", "DELETE"),
      this.page.getByTestId(TEST_IDS.confirmDialog.confirm).click(),
    ]);
    await waitForDialogClosed(this.page);
  }

  async pauseGoal(name: string): Promise<void> {
    await this.openEditByName(name);
    // exact: true — a role-name match is substring by default, and a random goal name can
    // genuinely contain "Resume Goal"/"Pause Goal" as a substring (faker once generated "Sorrowful
    // presume Goal", which contains "resume Goal" literally) and collide with the still-visible
    // "Edit <name> goal" card button behind the modal.
    //
    // Also waits for the goals-list GET refetch, not just the PUT — a paused goal now moves into
    // a different, initially-collapsed section (see ensurePausedSectionExpanded), so a caller
    // checking that section's state right after this returns needs the list to have actually
    // finished re-rendering with paused=true, not just the mutation to have landed server-side.
    await Promise.all([
      waitForApiResponse(this.page, "/goals", "PUT"),
      waitForApiResponse(this.page, /\/goals$/, "GET"),
      this.page.getByRole("button", { name: "Pause Goal", exact: true }).click(),
    ]);
    await waitForDialogClosed(this.page);
  }

  async resumeGoal(name: string): Promise<void> {
    await this.ensurePausedSectionExpanded(name);
    await this.openEditByName(name);
    await Promise.all([
      waitForApiResponse(this.page, "/goals", "PUT"),
      waitForApiResponse(this.page, /\/goals$/, "GET"),
      this.page.getByRole("button", { name: "Resume Goal", exact: true }).click(),
    ]);
    await waitForDialogClosed(this.page);
  }

  /** Paused-but-incomplete goals live in their own collapsed-by-default "Paused Goals" section
   * (goals/page.tsx's `showPaused` state), same reveal-on-demand pattern as Completed Goals —
   * a card there isn't in the DOM at all until the section is expanded. Checks the card's own
   * visibility first (not just clicking unconditionally) since expectPaused and resumeGoal can
   * both run in the same test after one already expanded it — clicking the toggle again would
   * re-collapse it. */
  private async ensurePausedSectionExpanded(name: string): Promise<void> {
    if (await this.card(name).isVisible()) return;
    await this.page.getByRole("button", { name: /Paused Goals/ }).click();
  }

  /** "Add to Savings" only renders on a card with no linked account (see GoalCard.tsx) — the goal
   * this is used against must not have been created with an account link. */
  async addSavings(name: string, amount: number): Promise<void> {
    await this.card(name).getByRole("button", { name: "Add to Savings" }).click();
    await this.page.getByTestId("goal-savings-amount-input").fill(String(amount));
    await Promise.all([
      waitForApiResponse(this.page, "/goals", "PUT"),
      waitForApiResponse(this.page, /\/goals$/, "GET"),
      this.page.getByTestId("goal-savings-submit").click(),
    ]);
    await waitForDialogClosed(this.page);
  }

  /** Opens Add to Savings and submits an amount over what's left to reach the target — no network
   * wait, since AddSavingsModal's own client-side check should block the submit before any
   * request fires. */
  async attemptOvershootSavings(name: string, amount: number): Promise<void> {
    await this.card(name).getByRole("button", { name: "Add to Savings" }).click();
    await this.page.getByTestId("goal-savings-amount-input").fill(String(amount));
    await this.page.getByTestId("goal-savings-submit").click();
  }

  async withdrawSavings(name: string, amount: number): Promise<void> {
    await this.card(name).getByRole("button", { name: "Add to Savings" }).click();
    await this.page.getByTestId("goal-savings-mode-withdraw").click();
    await this.page.getByTestId("goal-savings-amount-input").fill(String(amount));
    await Promise.all([
      waitForApiResponse(this.page, "/goals", "PUT"),
      waitForApiResponse(this.page, /\/goals$/, "GET"),
      this.page.getByTestId("goal-savings-submit").click(),
    ]);
    await waitForDialogClosed(this.page);
  }

  async expectGoalVisible(name: string | RegExp): Promise<void> {
    await expect(this.page.getByText(name).first()).toBeVisible();
  }

  async expectGoalNotVisible(name: string): Promise<void> {
    await expect(this.page.getByRole("button", { name: new RegExp(`^Edit ${escapeRegExp(name)} goal`) })).toHaveCount(0);
  }

  /** A completed goal moves out of "Active Goals" into the collapsed-by-default "Completed Goals"
   * section (goals/page.tsx's `showDone` state) — expand it first or the card isn't rendered at
   * all. The section only mounts once the post-addSavings GET refetch has actually re-rendered,
   * so a one-shot `isVisible()` check here can catch that gap and return false right before the
   * button appears, permanently skipping the click. Plain `.click()` auto-retries against
   * actionability instead, which is what makes this reliable. */
  async expectComplete(name: string): Promise<void> {
    await this.page.getByRole("button", { name: /Completed Goals/ }).click();
    await expect(this.card(name).getByText("Completed!", { exact: true })).toBeVisible();
  }

  async expectPaused(name: string): Promise<void> {
    await this.ensurePausedSectionExpanded(name);
    await expect(this.card(name).getByText("PAUSED", { exact: true })).toBeVisible();
  }
}
