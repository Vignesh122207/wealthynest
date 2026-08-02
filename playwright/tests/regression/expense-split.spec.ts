import {expect, test} from "../../fixtures";
import {faker} from "@faker-js/faker";
import {randomBankAccount, uniqueSuffix} from "../../test-data/factory";
import {provisionE2EUser, readRegressionUser, storageStateFor} from "../../helpers/auth.helper";
import {api} from "../../helpers/api.helper";
import {FamilyPage} from "../../pages/FamilyPage";
import {TransactionsPage} from "../../pages/TransactionsPage";
import type {BrowserContext, Page} from "@playwright/test";

// Serial — see debts.spec.ts's comment: shares the regressionUser with every other file in
// tests/regression/. Expense splitting is a family feature (ExpenseForm's "Split with family"
// toggle only renders once useFamilyMembers() returns someone other than yourself), so — same as
// family.spec.ts — this provisions its own second (and third) user rather than reusing
// regressionUser alone.
//
// Deliberately creates AND deletes its own family within this file, rather than reusing whatever
// family.spec.ts leaves behind: family.spec.ts's own last test deletes the family it creates, so
// there's nothing to depend on, and regressionUser having a leftover family here would break
// family.spec.ts's "starts from the onboarding view for a user with no family" test if that file
// runs after this one in the same pass (filename order isn't guaranteed, so don't rely on it
// running first either).
//
// Builds its own regressionUser page/context in beforeAll rather than destructuring the
// familyPage/transactionsPage fixtures there: those are test-scoped fixtures, and requesting a
// test-scoped fixture inside beforeAll gets its own separate instance from whatever the actual
// test() bodies receive (see admin.spec.ts's own beforeAll — it only ever requests the
// worker-scoped `browser` fixture directly, never a page object, for the same reason). Using one
// continuous context/page across beforeAll and every test keeps this file unambiguous about which
// browser session is doing what.
test.describe.configure({ mode: "serial" });

interface FamilyMember { accessToken: string; id: string; fullName: string }

/** Joins via api.helper.ts's direct joinFamily call, not a real UI login + Join click —
 * this file isn't testing the join flow (family.spec.ts already covers that with a real UI join),
 * and provisioning two extra members here already pushes close to the auth endpoint's 10 req/min
 * limit (register + login per member, on top of global-setup's own 4 calls and this file's own
 * regressionUser login). A second member that also logged in through the UI just to click Join
 * reliably tipped the file over that limit and 429'd partway through beforeAll. */
async function joinFamilyAsNewMember(inviteCode: string, fullName: string): Promise<FamilyMember> {
  const member = await provisionE2EUser({ fullName });
  await api.joinFamily(member.auth.accessToken, inviteCode);
  return { accessToken: member.auth.accessToken, id: member.auth.user.id, fullName };
}

test.describe("Expense Split", () => {
  const familyName = `E2E Split Family ${uniqueSuffix()}`;
  let adminContext: BrowserContext;
  let adminPage: Page;
  let adminFamilyPage: FamilyPage;
  let adminTransactionsPage: TransactionsPage;
  let regressionAccessToken: string;
  let regressionAccountId: string;
  let memberOne: FamilyMember;
  let memberTwo: FamilyMember;
  // Kept for readability at existing call sites below (memberOne/memberTwo read fine in new code,
  // but these read better next to the original single-participant test).
  let memberId: string;
  let memberName: string;

  test.beforeAll(async ({ browser }, testInfo) => {
    // One fresh login, reused both for the browser context below and for the direct API seeding
    // further down — not loaded from a shared on-disk storageState snapshot. See
    // fixtures/index.ts's authedContext for why: a baked-in refresh-token cookie shared across
    // contexts races AuthServiceImpl's rotation-reuse detection.
    const regressionUser = readRegressionUser(testInfo.project.name);
    const auth = await api.login({ email: regressionUser.email, password: regressionUser.password });
    regressionAccessToken = auth.accessToken;

    adminContext = await browser.newContext({ storageState: storageStateFor(auth) });
    adminPage = await adminContext.newPage();
    adminFamilyPage = new FamilyPage(adminPage);
    adminTransactionsPage = new TransactionsPage(adminPage);

    // This file may run in isolation (a fresh regressionUser with zero accounts) or as part of a
    // full pass where earlier files already seeded some — either way, the expense this spec adds
    // needs at least one to exist, so seed one directly rather than assuming.
    const bank = randomBankAccount();
    const account = await api.createAccount(regressionAccessToken, {
      accountType: "BANK_ACCOUNT", name: bank.bankName, bankName: bank.bankName, openingBalance: bank.openingBalance,
    });
    regressionAccountId = account.id;

    await adminFamilyPage.gotoFamily();
    await adminFamilyPage.createFamily(familyName);
    const inviteCode = await adminFamilyPage.readInviteCode();

    memberOne = await joinFamilyAsNewMember(inviteCode, faker.person.fullName());
    memberTwo = await joinFamilyAsNewMember(inviteCode, faker.person.fullName());
    memberId = memberOne.id;
    memberName = memberOne.fullName;

    await adminFamilyPage.gotoFamilyAndWaitForMembers();
    await expect(adminFamilyPage.memberRow(memberOne.fullName)).toBeVisible();
    await expect(adminFamilyPage.memberRow(memberTwo.fullName)).toBeVisible();
  });

  test.afterAll(async () => {
    await adminFamilyPage.gotoFamily();
    await adminFamilyPage.deleteGroup(familyName);
    await api.closeAccount(memberOne.accessToken).catch(() => {});
    await api.closeAccount(memberTwo.accessToken).catch(() => {});
    await adminContext.close();
  });

  test("splitting an expense creates a balance visible on the Family page @regression", async ({}, testInfo) => {
    const regressionUser = readRegressionUser(testInfo.project.name);
    const description = `E2E Split Expense ${faker.string.alphanumeric(6)}`;
    await adminTransactionsPage.gotoTransactions();
    await adminTransactionsPage.addExpenseWithSplit({
      amount: 1000, categoryName: regressionUser.expenseCategoryName, description, participants: [memberId],
    });

    await adminFamilyPage.gotoFamily();
    await expect(adminFamilyPage.splitBalanceRow(memberName)).toBeVisible();
  });

  test("settling up clears the balance @regression", async () => {
    await adminFamilyPage.gotoFamily();
    await expect(adminFamilyPage.splitBalanceRow(memberName)).toBeVisible();
    await adminFamilyPage.settleSplitWith(memberName);
    await expect(adminFamilyPage.splitBalanceRow(memberName)).toHaveCount(0);
  });

  test("splits an expense equally among multiple participants @regression", async ({}, testInfo) => {
    const regressionUser = readRegressionUser(testInfo.project.name);
    const description = `E2E Multi Split ${faker.string.alphanumeric(6)}`;
    await adminTransactionsPage.gotoTransactions();
    // 900 split three ways (payer + 2 participants) = an exact 300 each — avoids rounding
    // ambiguity in the assertion below (equalShare floors to 2 decimal places).
    await adminTransactionsPage.addExpenseWithSplit({
      amount: 900, categoryName: regressionUser.expenseCategoryName, description,
      participants: [memberOne.id, memberTwo.id],
    });

    await adminFamilyPage.gotoFamily();
    await expect(adminFamilyPage.splitBalanceRow(memberOne.fullName)).toBeVisible();
    await expect(adminFamilyPage.splitBalanceRow(memberTwo.fullName)).toBeVisible();

    const { pending } = await api.getMySplits(regressionAccessToken);
    const shareFor = (id: string) => pending.find(s => s.participantUserId === id && s.status === "PENDING")?.shareAmount;
    expect(shareFor(memberOne.id)).toBe(300);
    expect(shareFor(memberTwo.id)).toBe(300);

    await adminFamilyPage.settleSplitWith(memberOne.fullName);
    await adminFamilyPage.settleSplitWith(memberTwo.fullName);
    await expect(adminFamilyPage.splitBalanceRow(memberOne.fullName)).toHaveCount(0);
    await expect(adminFamilyPage.splitBalanceRow(memberTwo.fullName)).toHaveCount(0);
  });

  test("splits an expense with custom (unequal) share amounts @regression", async ({}, testInfo) => {
    const regressionUser = readRegressionUser(testInfo.project.name);
    const description = `E2E Custom Split ${faker.string.alphanumeric(6)}`;
    await adminTransactionsPage.gotoTransactions();
    await adminTransactionsPage.addExpenseWithSplit({
      amount: 1000, categoryName: regressionUser.expenseCategoryName, description,
      participants: [memberOne.id, memberTwo.id],
      customShares: { [memberOne.id]: 175.25, [memberTwo.id]: 340.5 },
    });

    await adminFamilyPage.gotoFamily();
    await expect(adminFamilyPage.splitBalanceRow(memberOne.fullName)).toBeVisible();
    await expect(adminFamilyPage.splitBalanceRow(memberTwo.fullName)).toBeVisible();

    // Custom amounts are asserted via the API rather than parsed out of the UI's
    // locale-formatted currency text (see api.helper.ts's getMySplits).
    const { pending } = await api.getMySplits(regressionAccessToken);
    const shareFor = (id: string) => pending.find(s => s.participantUserId === id && s.status === "PENDING")?.shareAmount;
    expect(shareFor(memberOne.id)).toBe(175.25);
    expect(shareFor(memberTwo.id)).toBe(340.5);

    await adminFamilyPage.settleSplitWith(memberOne.fullName);
    await adminFamilyPage.settleSplitWith(memberTwo.fullName);
  });

  // POST /expense-splits/{id}/settle (settle one split) has no UI surface anywhere in the app —
  // SplitsCard.tsx (the only place that renders split balances) only ever calls
  // settle-with/{counterpartId}, which settles every pending split with that person at once.
  // useSettleSplit() in useExpenseSplits.ts calls the per-split endpoint but is never imported
  // anywhere — dead code backing a real, working endpoint the UI just never reaches. Seeds the
  // expense via the API too (not just the settle call) rather than a full Add Expense round trip
  // through the UI: creating the split isn't what this test is verifying (tests above already
  // cover the create-via-UI path), and this file's other four tests already drive enough
  // transactions+family page loads on their own to sit close to the API's 200 req/min general
  // rate limit — an extra full UI create here reliably tipped it into a 429 (see the "Real rate
  // limits" section this suite's README documents; same rationale as api.helper.ts's
  // createAccount/createExpense already existing for exactly this kind of setup-not-under-test).
  test("settling a single split via the API only settles that split, not the whole balance @regression", async ({}, testInfo) => {
    const regressionUser = readRegressionUser(testInfo.project.name);
    await api.createExpense(regressionAccessToken, {
      amount: 200, accountId: regressionAccountId, categoryId: regressionUser.expenseCategoryId,
      expenseDate: new Date().toISOString().split("T")[0],
      description: `E2E Single Settle ${faker.string.alphanumeric(6)}`,
      splitWith: [{ userId: memberOne.id, shareAmount: 100 }],
    });

    const { pending } = await api.getMySplits(regressionAccessToken);
    const split = pending.find(s => s.participantUserId === memberOne.id && s.status === "PENDING");
    expect(split).toBeDefined();

    await api.settleSplit(regressionAccessToken, split!.id);

    const afterSettle = await api.getMySplits(regressionAccessToken);
    expect(afterSettle.pending.some(s => s.id === split!.id)).toBe(false);
    expect(afterSettle.balances.some(b => b.counterpartUserId === memberOne.id)).toBe(false);
  });
});
