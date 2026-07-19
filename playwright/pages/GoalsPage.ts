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
    await Promise.all([
      waitForApiResponse(this.page, "/goals", "PUT"),
      this.page.getByRole("button", { name: "Pause Goal", exact: true }).click(),
    ]);
    await waitForDialogClosed(this.page);
  }

  async resumeGoal(name: string): Promise<void> {
    await this.openEditByName(name);
    await Promise.all([
      waitForApiResponse(this.page, "/goals", "PUT"),
      this.page.getByRole("button", { name: "Resume Goal", exact: true }).click(),
    ]);
    await waitForDialogClosed(this.page);
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
    await expect(this.card(name).getByText("PAUSED", { exact: true })).toBeVisible();
  }
}
