import {expect, test} from "../../fixtures";
import {faker} from "@faker-js/faker";
import {uniqueSuffix} from "../../test-data/factory";
import {provisionE2EUser} from "../../helpers/auth.helper";
import {api} from "../../helpers/api.helper";
import {LoginPage} from "../../pages/auth/LoginPage";
import {FamilyPage} from "../../pages/FamilyPage";

// Serial — see debts.spec.ts's comment: shares the regressionUser with every other file in
// tests/regression/. Family is inherently one-per-user (a user either has a family or doesn't),
// so unlike most regression files these tests deliberately build on each other's state within
// the file — create once, exercise it, delete it at the end — rather than each test creating and
// tearing down its own isolated row.
test.describe.configure({ mode: "serial" });

test.describe("Family", () => {
  const familyName = `E2E Family ${uniqueSuffix()}`;
  let inviteCode: string;

  test("starts from the onboarding view for a user with no family @regression", async ({ familyPage }) => {
    await familyPage.gotoFamily();
    await familyPage.expectOnboardingVisible();
  });

  test("creates a family and renames it @regression", async ({ familyPage }) => {
    await familyPage.gotoFamily();
    await familyPage.createFamily(familyName);
    await familyPage.expectFamilyNameVisible(familyName);

    inviteCode = await familyPage.readInviteCode();
    expect(inviteCode.length).toBeGreaterThanOrEqual(4);

    const renamed = `${familyName} Renamed`;
    await familyPage.renameFamily(renamed);
    await familyPage.expectFamilyNameVisible(renamed);
  });

  test("a second user can join via the invite code, and the admin can remove them @regression", async ({ authedPage }) => {
    // A second, independently provisioned user — joining a family is fundamentally a two-user
    // interaction that the single shared regressionUser can't exercise alone. Provisioned here
    // rather than through global-setup since it's the only spec in the suite that needs one.
    // A distinct fullName is required: provisionE2EUser() defaults to the same hardcoded
    // "E2E Test User" every time, which is also regressionUser's own name — an unnamed member
    // here would collide with the admin's own row when scoping memberRow() by name.
    const member = await provisionE2EUser({ fullName: faker.person.fullName() });
    const context = await authedPage.context().browser()!.newContext();
    const memberPage = await context.newPage();
    const memberLogin = new LoginPage(memberPage);
    const memberFamily = new FamilyPage(memberPage);

    await memberLogin.goto();
    await memberLogin.loginWithPassword(member.email, member.password);
    await memberLogin.expectRedirectedToDashboard();
    await memberFamily.gotoFamily();
    await memberFamily.joinFamily(inviteCode);
    await expect(memberPage.getByText(`${familyName} Renamed`)).toBeVisible();
    await context.close();

    // Back on the admin's page — the new member should now be listed and removable.
    const adminFamily = new FamilyPage(authedPage);
    await adminFamily.gotoFamilyAndWaitForMembers();
    await expect(adminFamily.memberRow(member.fullName)).toBeVisible();
    await adminFamily.removeMember(member.fullName);
    await expect(adminFamily.memberRow(member.fullName)).toHaveCount(0);

    await api.closeAccount(member.auth.accessToken);
  });

  test("deletes the group @regression", async ({ familyPage }) => {
    await familyPage.gotoFamily();
    await familyPage.deleteGroup(`${familyName} Renamed`);
    await familyPage.expectOnboardingVisible();
  });
});
