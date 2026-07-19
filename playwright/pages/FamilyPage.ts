import {expect, type Locator} from "@playwright/test";
import {BasePage} from "./BasePage";
import {ROUTES} from "../constants/routes";
import {waitForApiResponse, waitForDialogClosed} from "../helpers/wait.helper";

/** Models wealthynest-web's /family route. Every regressionUser starts with no family (a fresh
 * user's `familyId` is null), so every spec here begins from the NoFamilyOnboarding view, not the
 * dashboard — createFamily/joinFamily are the only ways in. */
export class FamilyPage extends BasePage {
  // DashboardLayout fires a GET /users/me resync on every fresh mount (layout.tsx: "prevents
  // stale persisted store after joining a family") — a real double-edged fix, since a family
  // mutation's own setUser() call (create/join/leave/etc.) can land BEFORE that resync resolves,
  // and the resync's own .then(setUser) then overwrites it with the pre-mutation snapshot,
  // reverting familyId right back to null. Waiting for it to settle before doing anything makes
  // sure any later mutation's setUser() is the one that wins.
  async gotoFamily(): Promise<void> {
    await Promise.all([
      waitForApiResponse(this.page, /\/users\/me$/, "GET"),
      this.goto(ROUTES.family),
    ]);
  }

  /** useFamilyMembers(family?.id) only enables once useFamily() itself has resolved (the members
   * query is chained off the family query's data, not the auth store's familyId) — a plain
   * gotoFamily() can outrace that two-request waterfall right after a join/create, showing a
   * stale "Members 0" until the second request lands. Use this instead of gotoFamily() whenever
   * the page is expected to already have a family with members to show (e.g. checking who just
   * joined) — the wait has to be registered before navigation fires, per waitForApiResponse's own
   * contract. */
  async gotoFamilyAndWaitForMembers(): Promise<void> {
    await Promise.all([
      waitForApiResponse(this.page, /\/users\/me$/, "GET"),
      waitForApiResponse(this.page, /\/families\/[^/]+\/members$/, "GET"),
      this.goto(ROUTES.family),
    ]);
  }

  async createFamily(name: string): Promise<void> {
    await this.page.getByTestId("family-create-card").click();
    await this.page.getByTestId("family-name-input").fill(name);
    await Promise.all([
      waitForApiResponse(this.page, "/families", "POST"),
      this.page.getByTestId("family-create-submit").click(),
    ]);
  }

  async joinFamily(inviteCode: string): Promise<void> {
    await this.page.getByTestId("family-join-card").click();
    await this.page.getByTestId("family-invite-code-input").fill(inviteCode);
    await Promise.all([
      waitForApiResponse(this.page, "/families/join", "POST"),
      this.page.getByTestId("family-join-submit").click(),
    ]);
  }

  get inviteCode(): Locator {
    return this.page.getByTestId("family-invite-code-display");
  }

  async readInviteCode(): Promise<string> {
    await expect(this.inviteCode).toBeVisible();
    return (await this.inviteCode.textContent())?.trim() ?? "";
  }

  async renameFamily(newName: string): Promise<void> {
    await this.page.getByTestId("family-rename-trigger").click();
    await this.page.getByTestId("family-rename-input").fill(newName);
    await Promise.all([
      waitForApiResponse(this.page, /\/families\/[^/]+$/, "PUT"),
      this.page.getByTestId("family-rename-submit").click(),
    ]);
  }

  memberRow(name: string): Locator {
    return this.page.getByTestId("member-row").filter({ hasText: name });
  }

  async removeMember(name: string): Promise<void> {
    // "Remove from family" only opens the ConfirmDialog (family/page.tsx's onRemove ->
    // setMode("confirmRemove")) — the DELETE only actually fires on the confirm click.
    await this.memberRow(name).getByRole("button", { name: "Remove from family" }).click();
    await Promise.all([
      waitForApiResponse(this.page, /\/families\/[^/]+\/members\//, "DELETE"),
      this.page.getByTestId("confirm-dialog-confirm").click(),
    ]);
    await waitForDialogClosed(this.page);
  }

  async makeAdmin(name: string): Promise<void> {
    await this.memberRow(name).getByRole("button", { name: "Make admin" }).click();
    await Promise.all([
      waitForApiResponse(this.page, /\/transfer-admin$/, "POST"),
      this.page.getByTestId("confirm-dialog-confirm").click(),
    ]);
    await waitForDialogClosed(this.page);
  }

  async leaveGroup(): Promise<void> {
    await this.page.getByTestId("family-leave-trigger").click();
    await Promise.all([
      waitForApiResponse(this.page, "/families/leave", "POST"),
      this.page.getByTestId("family-confirm-leave").click(),
    ]);
  }

  async deleteGroup(familyName: string): Promise<void> {
    await this.page.getByTestId("family-delete-trigger").click();
    await this.page.getByTestId("family-delete-confirm-input").fill(familyName);
    await Promise.all([
      waitForApiResponse(this.page, /\/families\/[^/]+$/, "DELETE"),
      this.page.getByTestId("family-confirm-delete").click(),
    ]);
  }

  splitBalanceRow(counterpartName: string): Locator {
    return this.page.getByTestId("split-balance-row").filter({ hasText: counterpartName });
  }

  async settleSplitWith(counterpartName: string): Promise<void> {
    await Promise.all([
      waitForApiResponse(this.page, "/expense-splits/settle-with/", "POST"),
      this.splitBalanceRow(counterpartName).getByTestId("split-settle-button").click(),
    ]);
  }

  async expectOnboardingVisible(): Promise<void> {
    await expect(this.page.getByTestId("family-create-card")).toBeVisible();
  }

  async expectFamilyNameVisible(name: string): Promise<void> {
    await expect(this.page.getByTestId("family-name-display")).toHaveText(name);
  }
}
