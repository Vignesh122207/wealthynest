import {expect, test} from "../../fixtures";
import {ROUTES} from "../../constants/routes";
import {TEST_IDS} from "../../constants/testIds";
import type {Page} from "@playwright/test";

// Read-only, same rationale as responsive/a11y — no mutations, safe against the shared
// regressionUser. Thresholds here are deliberately generous: this is a catch-a-catastrophic-
// regression smoke check against a local Docker Compose stack on developer/CI hardware, not a real
// performance budget/gate — machine and network variance alone would make a tight threshold flaky.
// A real budget needs a dedicated, controlled environment (fixed hardware class, warm caches, no
// other containers competing for CPU), which this dev box isn't and can't fake into being — see
// Phase 24's own README section for why LCP/CLS/INP get generous thresholds here rather than the
// official "Good" Core Web Vitals cutoffs (LCP ≤2.5s, CLS ≤0.1, INP ≤200ms), which would need that
// controlled environment to be meaningful rather than flaky.
test.describe.configure({ mode: "serial" });

const MAX_LOAD_MS = 10_000;
// Deliberately above the official "Poor" cutoffs (LCP >4s, CLS >0.25, INP >500ms) — these exist to
// catch a genuine regression (a render-blocking resource added, a layout-shifting element with no
// reserved space, a synchronous long task on click), not to enforce the official "Good" bar, which
// needs the controlled environment above to be a meaningful gate rather than machine-variance noise.
const MAX_LCP_MS = 6_000;
const MAX_CLS = 0.5;
const MAX_INP_MS = 1_000;

interface CoreWebVitals {
  lcp: number;
  cls: number;
  inp: number;
}

/** Installs PerformanceObservers before any page script runs (addInitScript), so LCP/CLS entries
 * that fire early in the page lifecycle aren't missed — reading performance.getEntriesByType()
 * only after the page settles would race against exactly the entries this needs to capture. */
async function observeCoreWebVitals(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __cwv: { lcp: number; cls: number; inpDurations: number[] } };
    w.__cwv = { lcp: 0, cls: 0, inpDurations: [] };

    try {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1] as PerformanceEntry & { startTime: number };
        if (last) w.__cwv.lcp = last.startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
    } catch {
      // LCP observer type unsupported in this browser — leave lcp at 0 rather than fail the test;
      // WebKit/Firefox support for these entry types has historically lagged Chromium's.
    }

    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
          if (!entry.hadRecentInput) w.__cwv.cls += entry.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
    } catch {
      // Same fallback reasoning as LCP above.
    }

    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as (PerformanceEntry & { duration: number })[]) {
          w.__cwv.inpDurations.push(entry.duration);
        }
      }).observe({ type: "event", buffered: true, durationThreshold: 16 } as PerformanceObserverInit);
    } catch {
      // "event" timing entries (used to approximate INP) aren't observable in every engine either.
    }
  });
}

async function readCoreWebVitals(page: Page): Promise<CoreWebVitals> {
  return page.evaluate(() => {
    const w = window as unknown as { __cwv: { lcp: number; cls: number; inpDurations: number[] } };
    return {
      lcp: w.__cwv.lcp,
      cls: w.__cwv.cls,
      inp: w.__cwv.inpDurations.length ? Math.max(...w.__cwv.inpDurations) : 0,
    };
  });
}

async function loadEventEndMs(page: Page): Promise<number> {
  return page.evaluate(() => {
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
      await observeCoreWebVitals(accountsPage.rawPage);
      await accountsPage.goto(route);
      const loadMs = await loadEventEndMs(accountsPage.rawPage);
      expect(loadMs, `${name} took ${loadMs}ms to fire loadEventEnd`).toBeLessThan(MAX_LOAD_MS);
    });

    test(`${name} page's Core Web Vitals stay within smoke thresholds @performance`, async ({ accountsPage }) => {
      await observeCoreWebVitals(accountsPage.rawPage);
      await accountsPage.goto(route);
      // One real interaction (the FAB toggle exists on every page these tests already cover) so
      // there's at least one sample for the "event" PerformanceObserver INP approximates from —
      // otherwise inpDurations stays empty on a page nobody clicked, which isn't a real "0ms INP".
      await accountsPage.byTestId(TEST_IDS.fab.toggle).click();
      await accountsPage.rawPage.waitForTimeout(500);

      const { lcp, cls, inp } = await readCoreWebVitals(accountsPage.rawPage);
      expect(lcp, `${name} LCP was ${lcp}ms`).toBeLessThan(MAX_LCP_MS);
      expect(cls, `${name} CLS was ${cls}`).toBeLessThan(MAX_CLS);
      expect(inp, `${name} INP was ${inp}ms`).toBeLessThan(MAX_INP_MS);
    });
  }
});
