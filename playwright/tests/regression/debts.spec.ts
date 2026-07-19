import {test} from "../../fixtures";
import {faker} from "@faker-js/faker";

// debtsPage is backed by `authedPage`, a fresh context using this worker's own dedicated user
// (see fixtures/index.ts's `workerUser`) — not a real UI login (this suite is testing Debts, not
// Auth; see tests/auth/ for that) and not the shared global-setup user either, so parallel workers
// never see each other's debt records.

// Serial: every test in tests/regression/ shares one backend user (regressionUser) so parallel
// workers don't see each other's rows across FILES — but tests within a single file still hit the
// SAME account/debt list, and the app's own account/debt pages fetch each other's data (e.g. the
// Debt form's account picker calls GET /accounts too), so parallel tests within this file raced on
// shared UI state (toasts, modals, list contents) even though each ran in its own browser tab.
test.describe.configure({ mode: "serial" });

test.describe("Debts", () => {
  test("records money lent and marks it received @regression", async ({ debtsPage }) => {
    const name = faker.person.fullName();
    await debtsPage.gotoDebts();
    await debtsPage.createDebt({ type: "LENT", contactName: name, amount: 5000, note: "Dinner split" });
    await debtsPage.expectDebtVisible(name);
    await debtsPage.expectStatus(name, "Active");

    await debtsPage.recordPayment(name, 5000);
    await debtsPage.expectStatus(name, "Settled");
  });

  test("records money borrowed and a partial payment @regression", async ({ debtsPage }) => {
    const name = faker.person.fullName();
    await debtsPage.gotoDebts();
    await debtsPage.createDebt({ type: "BORROWED", contactName: name, amount: 10000 });
    await debtsPage.expectDebtVisible(name);

    await debtsPage.recordPayment(name, 4000);
    await debtsPage.expectStatus(name, "Partial");
  });

  test("deletes a debt record @regression", async ({ debtsPage }) => {
    const name = faker.person.fullName();
    await debtsPage.gotoDebts();
    await debtsPage.createDebt({ type: "LENT", contactName: name, amount: 1500 });
    await debtsPage.expectDebtVisible(name);

    await debtsPage.deleteDebt(name);
    await debtsPage.expectDebtNotVisible(name);
  });

  test("contact name is required @regression", async ({ debtsPage }) => {
    await debtsPage.gotoDebts();
    await debtsPage.attemptCreateWithoutContactName("LENT", 1000);
    await debtsPage.expectValidationError("Name is required");
  });

  // ─── Validation depth (debt.schema.ts) ──────────────────────────────────────

  test("a due date before the debt date is rejected client-side @regression", async ({ debtsPage }) => {
    const name = faker.person.fullName();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await debtsPage.gotoDebts();
    // debtDate defaults to today (DebtFormModal.tsx) — a due date of yesterday is always earlier
    // regardless of what day the suite runs, no need to also set an explicit debtDate.
    await debtsPage.attemptCreateWithDueDateBeforeDebtDate("LENT", name, 1000, yesterday);

    await debtsPage.expectValidationError("Due date can't be before the debt date");
    await debtsPage.expectDebtNotVisible(name);
  });

  test("Lent/Borrowed tabs filter the list @regression", async ({ debtsPage }) => {
    const lentName = faker.person.fullName();
    const borrowedName = faker.person.fullName();
    await debtsPage.gotoDebts();
    await debtsPage.createDebt({ type: "LENT", contactName: lentName, amount: 2000 });
    await debtsPage.createDebt({ type: "BORROWED", contactName: borrowedName, amount: 3000 });

    await debtsPage.tab("LENT").click();
    await debtsPage.expectDebtVisible(lentName);
    await debtsPage.expectDebtNotVisible(borrowedName);

    await debtsPage.tab("BORROWED").click();
    await debtsPage.expectDebtVisible(borrowedName);
    await debtsPage.expectDebtNotVisible(lentName);

    await debtsPage.tab("ALL").click();
    await debtsPage.expectDebtVisible(lentName);
    await debtsPage.expectDebtVisible(borrowedName);
  });
});
