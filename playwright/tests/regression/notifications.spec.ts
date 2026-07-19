import {test} from "../../fixtures";

// Serial — see debts.spec.ts's comment. Notifications here are entirely derived from data other
// regression files create (budgets, goals, low balances, ...) — this file doesn't seed anything
// of its own, it only exercises the filter UI, which works identically whether the list is
// populated or empty.
test.describe.configure({ mode: "serial" });

test.describe("Notifications", () => {
  test("loads and filters switch the active tab @regression", async ({ notificationsPage }) => {
    await notificationsPage.gotoNotifications();
    await notificationsPage.expectLoaded();
    await notificationsPage.expectFilterActive("All");

    await notificationsPage.selectFilter("Budgets");
    await notificationsPage.expectFilterActive("Budgets");

    await notificationsPage.selectFilter("All");
    await notificationsPage.expectFilterActive("All");
  });
});
