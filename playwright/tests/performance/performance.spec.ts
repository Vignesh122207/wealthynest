import {expect, test} from "../../fixtures";
import {ROUTES} from "../../constants/routes";

// Read-only, same rationale as responsive/a11y — no mutations, safe against the shared
// regressionUser. Thresholds here are deliberately generous (seconds, not milliseconds): this is
// a catch-a-catastrophic-regression smoke check against a local Docker Compose stack on
// developer/CI hardware, not a real performance budget/gate — machine and network variance alone
// would make a tight threshold flaky. Tightening these needs a dedicated, controlled environment
// (fixed hardware class, warm caches, no other containers competing for CPU), not attempted here.
test.describe.configure({ mode: "serial" });

const MAX_LOAD_MS = 10_000;

async function loadEventEndMs(pageObjPage: import("@playwright/test").Page): Promise<number> {
  return pageObjPage.evaluate(() => {
    const [nav] = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
    return nav.loadEventEnd;
  });
}

test.describe("Performance (smoke thresholds)", () => {
  for (const [name, route] of [
    ["dashboard", ROUTES.dashboard],
    ["accounts", ROUTES.accounts],
    ["transactions", ROUTES.transactions],
    ["investments", ROUTES.investments],
  ] as const) {
    test(`${name} page finishes loading within ${MAX_LOAD_MS}ms @performance`, async ({ accountsPage }) => {
      await accountsPage.goto(route);
      const loadMs = await loadEventEndMs(accountsPage.rawPage);
      expect(loadMs, `${name} took ${loadMs}ms to fire loadEventEnd`).toBeLessThan(MAX_LOAD_MS);
    });
  }
});
