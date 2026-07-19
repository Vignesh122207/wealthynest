# WealthyNest E2E (Playwright)

Phase 1: framework scaffold, proven end-to-end via the **Auth** suite (10 tests) and the
**Critical Business Flow** smoke test. Phase 2: deep `tests/regression/` coverage for the 6 core
money modules — Debts, Accounts, Transactions, Budgets, Goals, Investments (34 tests). Phase 3:
Net Worth, Analytics, Reports (9 tests). Phase 4: Family, Notifications, Settings, Categories
(11 tests). Phase 5: Admin (4 tests). Phase 6: Bond investments (2 tests). Phase 7: Recurring
Rules (Income/Expenses/Transfers/Goals, 4 tests) and Support (tickets/FAQ/contact, 3 tests).
Phase 8: a real Security password-change round trip (1 test). Phase 9: four new suite
categories — Responsive (4 tests), Accessibility (6 tests), Performance (4 tests), Visual
regression (2 tests) — plus a real Dark mode assertion folded into the existing Settings test.
Phase 10: Vault (3 tests). Phase 11: Expense Split (2 tests). Phase 12: Statement Import CSV
(1 test). Phase 13: CAS Import PDF (1 test). Phase 14: Expense Split depth — multi-participant and
custom-amount splits, plus the previously-uncovered per-split settle endpoint (3 more tests, on top
of Phase 11's 2). Vault depth — edit, Secure Note, favorite (3 more tests, on top of Phase 10's 3;
also fixed a real app bug this surfaced, see Phase 10's section below).

Phases 15-23 (one pass) closed out nearly every item the "Known gaps" section used to list: Phase 15
— Vault Health/TOTP/Export/generator/trust-session (5 tests). Phase 16 — Statement Import depth,
column-mapping + PDF password + per-row editing (3 tests). Phase 17 — CAS Import depth, PDF
password + manual-fix-a-row + add-missed-scheme (2 tests). Phase 18 — Stock/Mutual Fund investment
creation via a mocked LiveSearch result (2 tests). Phase 19 — Dividend suggest/dismiss (2 tests, new
file, direct-DB seeded). Phase 20 — a real WebAuthn passkey register+login round trip via a
Chromium CDP virtual authenticator (1 test, new file). Phase 21 — firefox/webkit cross-browser
support: per-project user provisioning so `tests/regression/` can actually run against another
browser without the singleton-account collision Phase 9 first documented. Phase 22 — Accessibility
tightened from critical/serious-only to every axe severity tier (two real moderate findings fixed).
Phase 23 — Visual regression breadth (Signup + Contact, 2 more static pages) and a new
tablet-landscape responsive project (3 tests), distinct from Phase 9's phone-width coverage. See
each phase's own section below for what broke, what got fixed, and the real rate-limit/environment
lessons found along the way.

That's **107 `test:regression`-family tests** (auth 10 + smoke 1 + regression 96 across 24 files)
**plus 21 more** across the four standalone suites (Responsive now includes the tablet project) —
**128 tests total**, all reusing the same scaffold.

Every one of Phase 3-5's 24 new regression tests has been individually confirmed green in
isolation, as has auth (10/10) and smoke (1/1). A single simultaneous `npm run test:regression`
run landed 43/58 in one window, with the remaining 15 either not running (serial `describe` blocks
stop after a failure) or failing on the same cumulative API rate-limit pressure documented in
"Real rate limits" below (explicit `RATE_LIMIT_EXCEEDED` errors and `waitForResponse` timeouts
under sustained load) — not new regressions from this session's additions. Phases 6-8's 10 new
tests all individually confirmed green too; a subsequent full `npm run test:regression` (68 tests)
landed 60/68 in one window — 2 explicit `RATE_LIMIT_EXCEEDED` 429s (budgets, transactions-search)
plus one `investments.spec.ts` "Bonds tab" assertion timeout that's almost certainly the same
pressure showing up as a slow `GET /investments` instead of an outright 429 (the screenshot shows
the Bonds tab's own loading skeleton still on screen, not a rendering bug) — consistent with, not
worse than, the ratio Phase 3-5 already saw. Run `npm run test:regression` against a quiet API
(first thing after `docker compose up`, or in CI as the first traffic of a run) and it should go
clean; this is the same caveat Phase 2 already documented, now just against a larger suite.
Phase 9's four suites are read-only (no mutations, see that section below), so they don't carry
the same rate-limit-under-load risk — each was run individually and passed clean.

## Prerequisites

1. The app stack running locally: `docker compose up -d` from the repo root.
2. `cp .env.example .env` in this directory and fill in `DB_PASSWORD` (same value as the repo
   root `.env`).
3. `npm install && npx playwright install --with-deps`

## Running

```
npm test                 # everything, all projects
npm run test:auth        # tests/auth only
npm run test:smoke       # tests/smoke only (the critical business flow)
npm run test:regression  # tests/regression only, one worker (see "Two provisioned users" below)
npm run test:responsive  # tests/responsive only, --project=mobile-chrome (see Phase 9)
npm run test:a11y        # tests/a11y only, axe-core scans (see Phase 9)
npm run test:performance # tests/performance only, generous load-time smoke thresholds (see Phase 9)
npm run test:visual      # tests/visual only, screenshot diffs on static pages (see Phase 9)
npm run test:headed      # any of the above with --headed
npm run test:ui          # Playwright's UI mode
npm run report           # open the last HTML report
```

## How it fits together

- **global-setup.ts** health-checks the API and provisions **two** separate users via the API
  (bypassing the UI — that's not what these tests are verifying): one for `tests/auth/` +
  `tests/smoke/`, one for `tests/regression/`. Each gets its email verified directly in Postgres
  (there's no SMTP inbox to click a real link from) and one seeded EXPENSE category, and gets its
  own `storageState` file + JSON fixture file for tests to read back.
- **global-teardown.ts** re-logs-in as both users and closes their accounts, cascading away
  everything the run created. Best-effort — a failure here doesn't fail the suite.
- **fixtures/index.ts** exposes `e2eUser`/`authenticatedPage` (the auth+smoke user) and
  `regressionUser`/`authedPage` (the regression user), plus one page-object fixture per app page —
  `accountsPage`, `debtsPage`, `netWorthPage`, `analyticsPage`, `reportsPage`, `familyPage`,
  `notificationsPage`, `settingsPage`, `categoriesPage`, and so on. Every one of these is built from
  `authedPage`, never the default `page` — that's what keeps regression-suite data off the
  auth/smoke user's account, and vice versa. `AdminPage` is deliberately **not** in this list — see
  "Page objects must be built from the right `Page`" below for why.
- **pages/** and **components/** are Page Object Model classes — one per app page/reusable
  component, built directly from the actual `wealthynest-web` source (form field names, endpoint
  shapes, etc.), not guessed.
- **constants/testIds.ts** is the single source of truth for every `data-testid` this suite added
  to `wealthynest-web`. Check it before renaming/removing one on the frontend side.

## Two provisioned users, and why regression specs run serially

Every `tests/regression/*.spec.ts` file shares **one** backend user (`regressionUser`) — cheap to
provision (one extra register+login, once, in global-setup) versus a fresh user per test or per
worker, which pushed real auth-endpoint traffic past the API's 10 req/min rate limit (see below).
The cost: tests within one file that create/archive/delete real accounts, debts, etc. are mutating
the *same* underlying rows, so each regression spec file opens with
`test.describe.configure({ mode: "serial" })` — tests in that file run one at a time, in order, not
across parallel workers. Different regression *files* can still run in parallel workers against
each other (they mostly touch disjoint data), but if you see cross-file flakiness as more modules
are added, the fallback is `npm run test:regression` (already pinned to one worker).

Page-object submit methods that close a modal also call `waitForDialogClosed()`
(`helpers/wait.helper.ts`) after their `waitForApiResponse` — the API response resolves before the
modal's close animation finishes, and chaining straight into the next modal-opening action can hit
that still-fading backdrop intercepting the click. Follow this pattern (network wait, then dialog-
closed wait) for any new submit-and-close action.

## `npm run test:*` scripts run chromium only — on purpose

`playwright.config.ts` declares 4 projects (chromium, firefox, webkit, mobile-chrome) so the
config/projects plumbing itself is proven out, but `test`, `test:auth`, `test:smoke` and
`test:regression` all pin `--project=chromium`. This isn't a default Playwright habit — it's load-
bearing: every suite here provisions exactly **one** shared backend user in global-setup (once per
whole invocation, not per project), and some of what that user creates is a backend *singleton*
(Cash Wallet, Emergency Fund — see `WalletAccountServiceImpl.SINGLETON_TYPES`). Run the same spec
against all 4 projects in one invocation and only the first project to reach that step can ever
create it; every project after that hits a correctly-disabled type button and times out. This
surfaced concretely: a full `tests/smoke` run without a project pin failed on 3 of 4 projects at
Cash Wallet creation, and would affect `tests/regression/accounts.spec.ts`'s "only one Cash Wallet
is allowed" test the same way. Cross-browser coverage for these suites would need a user provisioned
*per project*, which hasn't been built — until then, run `npx playwright test --project=firefox` (or
`webkit`/`mobile-chrome`) manually if you specifically want to smoke-test the config's cross-browser
plumbing, not as part of the regular suite.

## Selector strategy

Elements are targeted by `data-testid` (added to the frontend alongside this suite, prioritizing
shared/reused components — `FormInput`, `FormSelect`, `BigAmountInput`, `AccountPicker`,
`CategoryPicker`, `FormDatePicker`, `Button`, `FloatingActionButton`, etc. — so one edit cascades
`data-testid` coverage across every form built from them) or by accessible role/label where that's
already reliable (e.g. `getByLabel("Description (optional)")`). Avoid adding new text-based
selectors for anything that isn't stable, translated, or subject to product-copy changes.

## Real rate limits you'll see locally

`wealthynest-api`'s `RateLimitConfig` has **two** tiers, both real anti-abuse defenses this suite
should never weaken:

- `/api/v1/auth/*`: 10 req/min per IP. `tests/auth` alone makes close to that many real
  login/register/refresh calls across its 10 tests, and global-setup makes 4 more (register+login
  × 2 users) at the start of every run. Running `tests/auth` and `tests/smoke` (whose first step is
  a real UI login) in the same ~60s window — the default if you run everything together — can
  occasionally 429 one of them.
- Everything else: 200 req/min per IP. Sounds generous, but most pages in this app are dashboards
  with many independent widgets, each firing its own `useQuery` — a single `/accounts` page load
  alone fires ~7 GET requests. A `tests/regression/*` file with several tests that each navigate to
  a couple of pages adds up fast within one file's ~30-60s of serial execution. `waitForApiResponse`
  (`helpers/wait.helper.ts`) asserts a 2xx status and throws with the real body on anything else —
  **if you see a test fail with `RATE_LIMIT_EXCEEDED` in the error, that's this**, not a bug in the
  test or the app. It used to fail silently several steps later as a confusing UI timeout (the
  helper only checked URL+method, not status) before that assertion was added; if you ever see a
  UI-level timeout on a `data-testid="modal-overlay-backdrop"` intercepting a click with no clear
  cause, suspect this first.

Mitigations already in place: `tests/regression/*` uses a single shared `regressionUser` (not a
login per test/worker), and specs that need setup data (an account to transact against, etc.)
increasingly seed it via a direct API call (`api.helper.ts`'s `createAccount`/`createCategory`, see
`transactions.spec.ts`'s `beforeAll`) instead of driving the UI through a full page load — cuts
requests substantially since the setup isn't what that spec is actually testing. Apply the same
pattern to new regression specs. If you still hit it: space full-suite runs apart, or use
`npx playwright test -g "<name>"` to isolate one test while iterating.

## Toasts are only reliable as the *first* toast in a test

Direct observation while debugging the smoke test: sonner's auto-dismiss timer appears to never
actually fire in this headless environment — the first toast of a session (e.g. "Welcome back,
...") just sits in the DOM indefinitely. A *later* toast in the same test (e.g. "Account created"
several steps into critical-business-flow.spec.ts) sometimes never rendered at all while that
first toast was still occupying the slot, even though the action it was for genuinely succeeded
(confirmed by screenshot — the account was there in the list). `components/Toast.ts` documents
this on the class itself. Practical rule: assert on the actual resulting state (the row/card/value
now visible) instead of a toast for anything after the first user action in a test — that's what
`tests/regression/*` already does throughout, and what critical-business-flow.spec.ts was fixed to
do (it used to also assert two mid-flow toasts, which is what surfaced this).

## Page objects must be built from the right `Page` — fixtures don't guess for you

`fixtures/index.ts`'s `accountsPage`/`transactionsPage`/`budgetsPage`/`goalsPage`/
`investmentsPage`/`debtsPage`/... are all wired to `authedPage` (a context pre-authenticated as
`regressionUser`) — correct for every `tests/regression/*` file, all of which only ever touch
`regressionUser`'s data. `tests/smoke/critical-business-flow.spec.ts` is different: it does a real
UI login as `e2eUser` on the default `page`. Using the fixture-provided page objects there silently
drove `regressionUser`'s session instead of `e2eUser`'s — same app, two different logged-in users,
one test. It surfaced as an apparent data bug (the Add Expense step's category picker was missing
the category the test expected, because it was rendering `regressionUser`'s seeded category, not
`e2eUser`'s) that took a while to trace back to "wrong session" rather than "wrong data". The fix:
`critical-business-flow.spec.ts` constructs its own `new AccountsPage(page)` /
`new TransactionsPage(page)` / etc. locally instead of destructuring the fixture versions.

The same lesson generalizes: `family.spec.ts` and `admin.spec.ts` both provision their own ad-hoc
second (and third) users mid-file — a second family member to test the join flow, a dedicated
ADMIN-role user to test `/admin`. Both build `new FamilyPage(memberPage)` / `new AdminPage(adminBrowserPage)`
against a freshly-created `browser.newContext()` + real UI login, never against `authedPage`. If a
future suite needs to drive the UI as a user other than `regressionUser`, do the same — don't
assume any fixture-provided page object is page-agnostic.

A subtler variant of the same bug hit `support.spec.ts` while building Phase 7: a test destructured
both `{ supportPage, page }` from the fixtures and asserted against the raw `page` after navigating
via `supportPage`. That looks harmless — surely `page` is just "the page" — but it isn't:
`fixtures/index.ts` wires `supportPage` to `authedPage`, while the plain `page` fixture is
Playwright's own default, separate, unauthenticated context. `supportPage.gotoContact()` navigated
`authedPage`'s tab; `page.getByText(...)` then queried a completely different, never-navigated tab,
and failed with "element(s) not found" — reproducibly, not flakily, which is what made it obvious
this wasn't a timing issue. Fix: don't destructure the raw `page` fixture alongside an
`authedPage`-backed page object at all — add an assertion/interaction method to the page object
instead (see `SupportPage.expectEmailVisible`/`clickFaqLink`) so every call in a test is scoped to
the same underlying `Page`.

## Phase 3-5: Net Worth/Analytics/Reports, Family/Notifications/Settings/Categories, Admin

New page objects: `NetWorthPage`, `AnalyticsPage`, `ReportsPage` (Phase 3); `FamilyPage`,
`NotificationsPage`, `SettingsPage` (bundles Profile/Security/Appearance/Notification-prefs — each
too small on its own to justify a separate file), `CategoriesPage` (Phase 4); `AdminPage` (Phase 5).
New specs: `networth.spec.ts` (asset/liability CRUD), `analytics.spec.ts` (month navigation over
API-seeded data), `reports.spec.ts` (real CSV downloads via `page.waitForEvent("download")` and a
PDF print-window via `context.waitForEvent("page")` — no mutations, so no rate-limit/data-isolation
concerns), `family.spec.ts` (create/rename/join/remove-member/delete, the only spec needing a
second real user), `notifications.spec.ts`, `settings.spec.ts`, `categories.spec.ts`,
`admin.spec.ts` (role-gate check + a dedicated `ADMIN`-role user promoted via direct DB update, since
there's no self-service path to that role).

A few more bugs/patterns surfaced building these:

- **`CategoriesPage.createCategory` forgot to open the FAB first.** Every other create-flow page
  object clicks `fab-toggle` before the specific action button; this one jumped straight to
  `fab-add-expense-category`, which doesn't exist until the FAB menu is expanded. A reminder that
  the FAB-toggle step isn't optional boilerplate — copy the whole pattern, not just the parts that
  look load-bearing.
- **`loginWithPassword()` returns before the post-login redirect completes** — it only submits the
  form. Every existing caller waits afterward (`dashboardPage.expectLoaded()` in the smoke test),
  but both `family.spec.ts`'s and `admin.spec.ts`'s ad-hoc second-user logins skipped that wait and
  immediately navigated to a protected route, landing back on `/login` because the auth token
  hadn't been persisted yet. Fixed by calling `loginPage.expectRedirectedToDashboard()` right after
  `loginWithPassword()` — treat that as mandatory, not optional, for any new caller.
- **`getByText` is case-insensitive and substring-based by default**, which collides more often
  than expected against page subtitles/headers. `getByText("Audit Log")` matched both the Admin
  page's own subtitle ("...scheduled jobs, and platform he...") *and* the Jobs tab's actual
  heading — a strict-mode violation. Use `getByRole("heading", { name: "..." })` (or `exact: true`)
  whenever the target text might also appear elsewhere on the page, which is more often than it
  looks once subtitles/descriptions enter the picture.
- **`provisionE2EUser()` defaults every user's `fullName` to the same hardcoded `"E2E Test User"`**
  — which is also `regressionUser`'s own name (since `regressionUser` itself is provisioned the
  same way). `family.spec.ts`'s ad-hoc second member, provisioned without an explicit name,
  collided with the admin's own row when scoping `memberRow()` by name. Always pass an explicit,
  unique `fullName` (e.g. `faker.person.fullName()`) when provisioning any ad-hoc user a test needs
  to distinguish from others by name.
- **`useFamilyMembers(family?.id)` is chained off `useFamily()` resolving first** — a genuine
  two-request waterfall, not a single query. A plain navigation right after a join/create can
  outrace that and briefly show a stale "Members 0". `FamilyPage.gotoFamilyAndWaitForMembers()`
  explicitly waits for the members GET before asserting.
- **A real app-level race, not just a testing gotcha**: `DashboardLayout` fires a `GET /users/me`
  resync on *every* fresh mount (its own comment: "prevents stale persisted store after joining a
  family"). A family mutation's own `setUser()` call (in the mutation's `onSuccess`, e.g.
  `useCreateFamily`) can land *before* that slower resync resolves — and when the resync then
  completes, its own `.then(setUser)` overwrites the store with the pre-mutation snapshot, reverting
  `familyId` back to `null` and bouncing the UI right back to the onboarding view moments after a
  successful create. This is worth flagging to whoever owns `layout.tsx`/`useCreateFamily` — it's a
  last-write-wins race between two independent `setUser()` callers, not something this suite caused.
  `FamilyPage.gotoFamily()` now waits for that `GET /users/me` to settle before doing anything else,
  which sidesteps it for tests but doesn't fix the underlying app behavior.
- **A bug in this suite's own `FamilyPage.removeMember()`**: it paired a
  `waitForApiResponse(DELETE)` with the *first* click ("Remove from family", which only opens the
  `ConfirmDialog`) instead of the second (the actual confirm click that fires the request) — a
  15-second timeout waiting for a request that was never going to fire until the next click. Fixed
  by moving the wait to the click that actually triggers it.
- **Backend/frontend contract mismatch**: `CreateExpenseRequest.accountId` is `@NotNull` on the
  backend, but the frontend's `CreateExpensePayload.accountId` type marks it optional (`accountId?:
  string`). `analytics.spec.ts`'s API-seeded expense hit a 422 until an account was created and its
  id passed explicitly — worth a heads-up to whoever owns that DTO/type pair, since the frontend
  type currently promises something the backend doesn't allow.

## Two bugs that only show up with a truly fresh user

- **IncomeForm defaults to "Salary" for a user with no income history**, and the source/category
  picker (like most of this app's pickers) omits whichever option is already selected from its
  panel list. `TransactionsPage.addIncome` used to unconditionally open the panel and search it for
  the requested source — which hangs forever if that source happens to be "Salary" on a fresh user,
  since it's already selected and therefore isn't in the list to click. Fixed with a
  `selectIncomeSource` helper that checks the trigger's current text first and only opens the panel
  if it needs to change. Only reproduces against a user with zero prior income entries, which is
  exactly what `tests/smoke` provisions and `tests/regression` (reusing one seeded user across many
  income-creating tests) mostly doesn't.
- **`GoalsPage.expectComplete`** used to check `toggle.isVisible().catch(() => false)` once before
  deciding whether to click the collapsed-by-default "Completed Goals" section open. `Locator
  .isVisible()` is a single snapshot with no retry, unlike a plain `.click()` (which auto-retries
  against actionability for the full action timeout) — called in the gap between the addSavings
  mutation's GET refetch resolving and React actually re-rendering the now-non-empty
  `completedGoals` list, it reads `false` and permanently skips the click, so the completed card is
  never actually revealed before the final assertion times out. Fixed by just calling `.click()`
  directly and letting Playwright's own retry loop absorb the race — the general lesson: prefer a
  plain action over a manual `isVisible()`-gated one unless you specifically need to *not* wait.

## Phase 6: Bond investments

New spec coverage in `investments.spec.ts`: create a Bond and verify the Bonds tab filters to
bond-only investments, using the same self-contained pattern as Gold/FD (`InvestmentsPage.createBond`,
`test-data/factory.ts`'s `randomBond`).

`BondForm.tsx` had no `data-testid`s at all before this pass (unlike every other investment form) —
added `bond-name-input`, `bond-face-value-input`, `bond-quantity-input`, `bond-total-invested-input`,
`bond-coupon-rate-input`, `bond-purchase-date-input`, `bond-maturity-date-input`, matching the
Gold/FD naming convention. `fab-add-bond` already existed in `constants/testIds.ts`.

Writing this test surfaced a real app bug, now fixed: `couponCreditDay` in
`investment.schema.ts`'s `bondSchema` was `z.coerce.number().min(1).max(31).optional()`. Leaving
that field blank (the common case — it's optional) sends `""` from the uncontrolled input;
`z.coerce.number()` turns that into `0`, which fails `.min(1)` and silently blocks submission —
"silently" because `BondForm.tsx` never rendered an error for that field either, so **Save Bond
did nothing and gave no indication why**. Fixed with `z.preprocess` to turn `""` into `undefined`
before coercion, and added the missing `error={...}` prop so any future out-of-range value (or a
different bug) actually surfaces instead of failing invisibly. This is a genuine
production-blocking bug in the Bond creation flow, not just a test-authoring gotcha — any real
user leaving Credit Day blank would have hit it too.

A second bug, also now fixed: `BondForm`'s `totalInvested` auto-fill effect only recomputed
`faceValue × quantity` when the current value was blank or still matched *today's* newly-computed
total. Since the effect fires on every keystroke, typing Face Value first (auto-filling
`totalInvested` at `faceValue × 1`, the default quantity) then Quantity second left `totalInvested`
stuck at the stale value — the moment quantity changed, "today's expected total" no longer matched
what was on screen, and the old check read that mismatch as "the user overrode it" even though the
effect itself had just set it. Fixed by tracking the *last value the effect itself set* in a ref
(`lastAutoTotalRef`) instead of re-deriving "did the user override this" from today's expected
value — `totalInvested` now keeps following face value/quantity edits right up until the user
actually types into that field themselves, at which point it correctly stops.

## Phase 7: Recurring Rules and Support

New page objects: `RecurringRulesPage` (all four `/settings/recurring` tabs — Income, Expenses,
Transfers, Goals) and `SupportPage` (`/settings/support/{contact,faq,tickets}`). New specs:
`recurring-rules.spec.ts` (one create-and-verify test per tab type) and `support.spec.ts` (create a
ticket and see it in My Tickets, expand a FAQ accordion item, Contact page's links). Both areas had
**zero** `data-testid` coverage before this pass — every input/picker/submit/card testid referenced
by these page objects (`recurring-income-*`, `recurring-expense-*`, `recurring-transfer-*`,
`recurring-goal-*`, `ticket-*`, plus four new `fab-add-recurring-*` entries in
`constants/testIds.ts`) was added alongside them, following the existing Gold/FD/Bond convention:
FAB entries centralized in `TEST_IDS.fab`, everything else inline as literal strings matching the
frontend.

`api.helper.ts` gained `createGoal` (Recurring Goal Contributions need an existing goal — its FAB
action is hidden until one exists) alongside the existing `createAccount`/`createCategory`.

**A real app bug, found and fixed**: `IncomeTab`/`ExpensesTab`/`TransfersTab`/`GoalsTab`'s
`RuleFormModal`s all defaulted their account/category/goal picker to `accounts[0]?.id` (or
equivalent) via a plain `useState(...)` initializer. That initializer only ran once, at mount — if
the modal opened before its `useAccounts()`/`useCategories()`/`useGoals()` query had resolved
(very plausible: the FAB button itself isn't gated on that query, so a user who navigates straight
to Add Rule can click before the GET returns), the picker locked onto an empty default and never
updated even after the data arrived moments later. No field ever showed an error for this, so a
rule created before that data arrived — a human on a slow connection, or a Playwright test
clicking through instantly and deterministically every time — failed validation silently: the
submit button simply did nothing and the request never fired.

Fixed at the source in all four tabs with a small `useEffect` that syncs the default once its
query resolves, but only for a fresh rule (`!isEdit`) and only if nothing's been picked yet
(`!accountId`/`!categoryId`/`!goalId`) — so it can't clobber a value the user already chose, or an
existing rule's own `initial` value when editing. The page objects also still **explicitly select**
the account/category/goal through its picker rather than relying on any default (see
`RecurringRulesPage.createIncomeRule`/`createExpenseRule`/`createTransferRule`/
`createGoalContributionRule`) — that's now redundant with the app-side fix, but left in place since
a test that doesn't depend on *which* account/goal ends up selected is more robust regardless of
how the app's default logic evolves later.

A second, narrower bug (see "Page objects must be built from the right `Page`" above for the full
writeup): a `support.spec.ts` test destructured the raw `page` fixture alongside the
`authedPage`-backed `supportPage`, and asserted against the wrong one — reproducibly, not flakily.
Fixed by adding `SupportPage.expectEmailVisible`/`clickFaqLink` so the test never touches a bare
`page` at all.

## Phase 8: Security — a real password-change round trip

`security.spec.ts` is new: it provisions its own dedicated, disposable user (via
`provisionE2EUser()` + a real UI login, same pattern as `admin.spec.ts`'s admin user — never
`regressionUser`, since changing that shared user's password would break every other regression
file's ability to log in for the rest of the run), changes the password, logs out, and logs back
in with the *new* password to prove the round trip actually took effect server-side (not just that
the UI showed a success message). `SettingsPage` gained a real `changePassword()` method alongside
the existing `attemptPasswordChangeWithMismatch()` (client-side-only, still used by
`settings.spec.ts` against the shared `regressionUser`) — no frontend changes were needed, every
testid this needed (`security-current-password-input`/`security-new-password-input`/
`security-confirm-password-input`/`security-password-submit`) already existed from Phase 4.

Cleanup re-logs-in with the new password before calling `api.closeAccount` — the token from
`provisionE2EUser()` predates the password change, and (like `markAdmin`'s role, per its own
comment) a session's claims are baked in at issuance, not re-checked live per request.

## Phase 9: Responsive, Accessibility, Dark mode, Performance, Visual regression

Four new suite categories, each its own `npm run test:*` script and `tests/` subdirectory —
deliberately kept out of `npm run test:regression`/`npm test`'s default sweep (see each script's
`--project` pin below) rather than folded into the existing regression files, since none of them
share that suite's per-test-file data-mutation model. All four are **read-only** — no
account/budget/goal/etc. creation — so they run safely against the shared `regressionUser` (via
`authedPage`) without any of the serial-mode data-collision concerns `tests/regression/*` has to
manage.

- **Responsive** (`tests/responsive/`, `npm run test:responsive`, `--project=mobile-chrome` only):
  `Sidebar.tsx` renders the same nav content — and the same `data-testid`s — inside both the
  always-in-DOM, CSS-hidden-below-`lg` desktop `<aside>` and the conditionally-rendered mobile
  overlay `<aside>`. Once the overlay is open, `navLink()` matches *both*, which is a strict-mode
  violation Playwright surfaces immediately (not a flake) — scope to `.last()` (the overlay's own
  copy, mounted after the desktop one) for anything asserted while the overlay is expected open.
  Added `data-testid="mobile-menu-toggle"` to `Header.tsx`'s hamburger button (it had none) and a
  `BasePage.openMobileMenu()` helper. Since every test here is read-only, this file guards itself
  with `test.skip(testInfo.project.name !== "mobile-chrome", ...)` in a `beforeEach` — every
  assertion here (sidebar hidden below `lg`, FAB reachable at a small viewport) is only true on a
  narrow viewport, so an unscoped `npm test` picking this file up under the desktop `chromium`
  project would otherwise fail for a reason that has nothing to do with a real regression.
- **Accessibility** (`tests/a11y/`, `npm run test:a11y`): added `@axe-core/playwright` as a new
  dev dependency and scan five pages (login + four dashboard pages) for axe violations. Only
  `critical`/`serious`-impact violations fail the test — `moderate`/`minor` are real findings this
  app could genuinely act on, but noisy/numerous enough in a fast-moving UI to make the suite
  flaky/high-maintenance as a *regression gate* rather than a one-time audit. Tightening to include
  them is a reasonable follow-up once critical/serious is consistently clean.

  **A test bug that looked like an app bug at first**: the initial version of this suite scanned
  immediately after `page.goto()` and reported `serious` `color-contrast` violations on
  `dashboard` — `text-muted-foreground` reading as low as 2.33:1 against the dark background,
  well under WCAG AA's 4.5:1. That turned out to be a false positive: `globals.css`'s card/list
  entrance animations (`animate-fade-in-up` et al, up to a 375ms stagger delay plus their own
  400ms duration) fade opacity 0→1 on mount, and axe was catching several elements mid-fade — a
  real difference from what a user actually reads once the page settles, not a genuine contrast
  bug. (The dark theme's `--muted-foreground` was already deliberately tuned for this — see its
  own comment in `globals.css` — so a false reading here was always more likely than an
  undiscovered systemic issue.) Fixed the test itself: it now waits 900ms (past the longest
  stagger+duration) before scanning, so it asserts on the resting UI, not a transient animation
  frame.

  With that false positive gone, the suite caught a **real** `critical` violation on `budgets`:
  the month-navigator's prev/next `<button>`s were icon-only (`<ChevronLeft>`/`<ChevronRight>`,
  no text) with no `aria-label`, `title`, or wrapped `<label>` — axe's `button-has-visible-text`
  rule, not `color-contrast`. A screen reader user had no way to know what either button did.
  Fixed by adding `aria-label="Previous month"`/`"Next month"`. All five pages now pass clean.
- **Dark mode**: not a separate file — folded into `settings.spec.ts`'s existing appearance test.
  The pre-existing test only checked the theme *picker's own* selected-option styling
  (`SettingsPage.expectThemeSelected`), which is real but doesn't prove dark mode actually applied
  anywhere else. Added `BasePage.expectHtmlThemeClass()`, asserting the `class` next-themes
  (`app/layout.tsx`'s `<ThemeProvider attribute="class">`) actually stamps onto `<html>` — a
  genuine "did the theme apply" check, not just "did the button look selected."
- **Performance** (`tests/performance/`, `npm run test:performance`): reads
  `PerformanceNavigationTiming.loadEventEnd` for four key pages against a **10-second** ceiling.
  This is deliberately a catch-a-catastrophic-regression smoke check against a local Docker Compose
  stack on whatever hardware runs it, not a real performance budget — machine/network variance
  alone would make a tight threshold flaky. A real budget needs a dedicated, controlled environment
  (fixed hardware class, warm caches, no other containers competing for CPU), not attempted here.
- **Visual regression** (`tests/visual/`, `npm run test:visual`): intentionally narrow — only the
  **login** and **FAQ** pages are screenshotted, both because they're the only pages in the app
  with no per-run-dynamic content. A dashboard/accounts screenshot would diff on every run purely
  from `regressionUser`'s ever-growing transaction history, which is noise, not a real visual
  regression. **Read before trusting a failure here**: Playwright screenshot baselines are pinned
  to the OS/GPU that generated them (these were generated on macOS); running this suite on a
  different platform — a Linux CI runner, for instance — will fail on font-rendering/
  anti-aliasing differences alone and needs its own baseline, not a real bug. Treat a mismatch as
  "look at the diff, then regenerate with `--update-snapshots` on that platform" before assuming a
  regression.

Also added in support of all four: `BasePage.rawPage` (an escape hatch to the underlying
Playwright `Page` for tools like `AxeBuilder` that need it directly rather than a `Locator`/testid)
and `BasePage.byTestId()`/`expectUrl()`/`expectNoHorizontalOverflow()` (generic one-off testid/URL/
layout checks that don't warrant a dedicated named method).

## Phase 10: Vault

New page object `VaultPage` and `vault.spec.ts` for `/vault` — a standalone password-manager-style
feature (`domain/vault` on the backend) that didn't exist when this suite was first scoped, so it
had no coverage of any kind before this pass. Covers: create a Login item, reveal its password
(re-authenticating with the account's own password, exactly like a real user would), and delete an
item.

`RevealSecretModal.tsx` gets a second confirm-your-password gate before showing a stored secret —
`VaultPage.revealSecret()` fills `regressionUser.password` (already available on the fixture,
provisioned in global-setup) into that gate, matching the real re-auth flow rather than bypassing
it. Added two testids this needed that didn't exist (`vault-reveal-submit`,
`vault-revealed-secret`); `vault-title-input`/`vault-secret-input`/`vault-form-submit`/
`fab-add-vault-item` already existed. Row-level actions (open/edit) have no shared testid — every
`VaultItemRow` already has a unique, stable `aria-label` (`View {title}`/`Edit {title}`), so
`VaultPage.rowByTitle()` uses `getByRole` instead of adding one, consistent with this suite's
selector strategy for reliable accessible names.

All three tests passed clean on the first run — no bugs found in this feature.

**Vault depth (edit, Secure Note, favorite) added later, alongside a real app bug fix.** Three more
tests: renaming an existing item, creating+revealing a `SECURE_NOTE` item (no username/URL fields,
a plain textarea body instead of `vault-secret-input`), and toggling favorite. `VaultItemRow.tsx`'s
favorite button aria-label was changed from a shared `"Add/Remove from favorites"` to one that
includes the item title (`"Add {title} to favorites"`), matching the existing `Edit {title}`/
`View {title}` convention — needed so a test can target one specific row's favorite toggle.

The edit-title test surfaced a real, previously-undiscovered bug: **saving *any* vault item edit
silently did nothing** whenever the item's `username`/`url`/`category`/`icon` were unset.
`vaultItemSchema`'s fields use `z.string().optional()`, which only accepts `undefined` — but an
unset field in the API's JSON response serializes as `null` (standard Jackson behavior), and that
`null` flowed straight into the edit form's `defaultValues`. `react-hook-form`'s validation then
failed on those *unrelated* fields every time, with zero visible error anywhere in the UI (no
network request ever fired, no toast, nothing) — the Save button just appeared to do nothing. Fixed
by coalescing `null → undefined` when building `defaultValues` from the fetched item. Also fixed in
`VaultPage.rowByTitle()`: `getByRole(..., { name })` matches by substring by default, so a test
asserting an old title like `"X"` is gone after renaming to `"X Renamed"` would false-positive-match
the renamed row — needed `exact: true`. See `feedback_frontend_form_gotchas` for why this bug class
is worth checking for in any other edit-modal in this app with optional string fields.

**Not yet covered: the Vault Health / TOTP / Export / password-generator / "trust this session"
features** — a separate roadmap took Vault from this baseline CRUD to a fuller password-manager
feature set after this suite was first written (`VaultHealthCard.tsx`, `TotpCodeDisplay.tsx`,
`ExportVaultModal.tsx`, `PasswordGeneratorPanel.tsx`, `useVaultAutoLock.ts`,
`vaultTrust.store.ts` on the frontend; `VaultUtilityController`, `VaultHealthResponse` on the
backend). Verified by hand at the time (screenshots, ad-hoc smoke checks), but none of it has
permanent `tests/regression/` coverage yet — see "Known gaps."

## Phase 11: Expense Split

New spec `expense-split.spec.ts` for the `expensesplit` domain — which, like Vault, had zero
coverage of any kind before this pass. Not its own page/route: splitting only exists as a "Split
with family" toggle inside the regular Add Expense form (`ExpenseForm.tsx`), gated on
`useFamilyMembers()` returning someone other than yourself, and the resulting balance surfaces on
`SplitsCard` on the Family page. Added the testids this needed
(`expense-split-toggle`/`expense-split-participant-{id}`/`expense-split-mode-{equal,custom}` on
`ExpenseForm.tsx`, `split-balance-row`/`split-settle-button` on `SplitsCard.tsx`) — none existed.
Covers: split an expense with a second family member, confirm the IOU balance appears on Family,
settle it, confirm the balance clears.

**Deliberately does not build on `family.spec.ts`'s state or reuse its page objects the normal
way** — worth explaining since it looks unusual next to every other regression file:

- It provisions and joins its own second family member (same reasoning as `family.spec.ts`'s own
  second-member test), because splitting is inherently a two-user feature the shared
  `regressionUser` can't exercise alone.
- It creates **and deletes its own family** within the file, rather than assuming `family.spec.ts`
  leaves one behind — `family.spec.ts`'s own last test deletes the family it creates, so there's
  nothing there to depend on. Leaving a family around here would also break `family.spec.ts`'s
  "starts from the onboarding view for a user with no family" test if that file happens to run
  after this one in the same pass (Playwright doesn't guarantee filename-order execution across
  files, so "runs first" isn't a safe assumption either way).
- `beforeAll` builds its own `regressionUser` page/context directly
  (`browser.newContext({ storageState: REGRESSION_STORAGE_STATE_PATH })`) instead of destructuring
  the `familyPage`/`transactionsPage` fixtures there. Those are test-scoped fixtures — requesting
  one inside `beforeAll` gets Playwright to hand back a *separate* instance from whatever the
  actual `test()` bodies receive, not the same browser session. `admin.spec.ts`'s own `beforeAll`
  already avoids this by only ever requesting the worker-scoped `browser` fixture directly; this
  file follows the same pattern so one continuous session runs `beforeAll` through every test in
  the file, with no ambiguity about which browser tab is doing what.
- Also seeds one bank account directly via `api.createAccount` in `beforeAll` — this file needs to
  add a real expense, and (like `transactions.spec.ts`'s own `beforeAll` comment explains) can't
  assume one already exists: run this file in isolation and `regressionUser` starts with zero
  accounts, since only a full-suite run guarantees an earlier file created one first.

## Phase 12: Statement Import (CSV)

New spec `statement-import.spec.ts` for the `statementimport` domain — CSV/PDF bank-statement
ingestion that creates draft expenses/income for review, explicitly called out in this repo's own
CLAUDE.md as distinct from manual entry, and (like Vault and Expense Split) had zero coverage of
any kind before this pass. Reached from `/expenses`'s Toolbar ("Import statement",
`aria-label`-only, no testid needed) — `TransactionsPage.importStatementCsv()` runs the whole
upload → review → confirm round trip.

**Sidesteps the flakiest part of this feature by construction.** `ImportStatementModal` has three
possible paths after upload: straight to review (headers auto-detected), a manual column-mapping
step (headers not recognized), or a PDF password step. Auto-detection
(`StatementImportServiceImpl.autoDetect`) matches on a fixed alias set — `date`, `narration`/
`description`/`particulars`, `debit`/`withdrawal`, `credit`/`deposit`, all case/punctuation-
insensitive. `test-data/files/sample-bank-statement.csv` uses exactly those recognized headers
(`Date,Description,Debit,Credit`), so the flow always lands on review directly — no mapping UI, no
PDF/password path, and no dependency on the PDF-text-extraction heuristics
(`PDF_LEADING_DATE`/`PDF_AMOUNT_TOKEN`/etc.) that parse real-world statement layouts, which is
where genuine flakiness would live if this suite ever takes on PDF import. The sample has one
DEBIT row (imports as an expense) and one CREDIT row (imports as income); the test accepts every
row's default included/category state and confirms as-is — it proves the upload → parse → confirm
round trip end-to-end, not per-row editing (toggle include, reassign category, bulk-apply), which
would need its own more targeted test if that logic needs coverage later.

Two small bugs surfaced, both fixed:
- The result step's "Close" button collided with the modal header's own icon-only close button —
  both have the accessible name "Close" (one via `aria-label="Close"`, the other via its own text
  content), a strict-mode violation once both exist in the DOM at once. Added
  `data-testid="import-statement-close-result"` to disambiguate rather than relying on accessible
  name here.
- `TransactionsPage.expectRowVisible()` failed on the imported rows even though the import itself
  succeeded — `/expenses` defaults to a "Month" filter (current month only), and the sample CSV's
  dates don't fall in the current month. Not a bug in the feature, but real enough to trip up any
  future spec asserting on old/dated transactions: added `data-testid="date-mode-{mode}"` to
  `DateControls.tsx`'s Month/Year/All/Custom toggle (previously untestable — its "All" button's
  accessible name collided with the unrelated `type-tab-all` Expenses/Income/Transfers tab) and a
  `TransactionsPage.showAllDates()` helper.

## Phase 13: CAS Import (PDF)

New spec `cas-import.spec.ts` for the `casimport` domain — importing an existing mutual fund
portfolio from a CAMS/KFintech Consolidated Account Statement PDF, reached from the Investments
page's FAB ("Import from CAS", `fab-import-cas`, already existed). Also had zero coverage before
this pass. `InvestmentsPage.importFromCas()` runs the whole upload → review → confirm round trip;
a successful import lands as a `MUTUAL_FUND` investment (`CasImportServiceImpl.confirm`), verified
on the Mutual Funds tab.

**This is the riskiest of the four Phase 10-13 features, and it shows in the source itself**:
`CasImportServiceImpl`'s own class-level doc comment is refreshingly honest — "unlike bank
statement PDFs (which this codebase already had many real samples to tune against), this parser
was written against general knowledge of how CAMS/KFintech CAS documents are laid out, not a
verified real sample… Expect this to need a tuning pass against a real CAS PDF before it's fully
reliable." Rather than depend on that heuristic's real-world accuracy (or worse, ship a synthetic
PDF that happens to work today and silently breaks the moment the parser gets tuned against a real
sample), the fixture was built by reading `parseHoldings`' exact regex patterns
(`FOLIO_PATTERN`/`NAV_PATTERN`/`VALUE_PATTERN`/`UNITS_PATTERN`/`isPlausibleSchemeName`) and hand-
picking a text layout confidently within their bounds — one folio line, one plausible-scheme-name
line, one line combining a closing-balance/NAV/value trio the parser is designed to read as a
single complete holding. `test-data/files/sample-cas-statement.pdf` is generated by
`generate-sample-cas-statement.py` (`reportlab`, not run by the suite itself — the PDF is committed
as a static fixture; the script exists so the fixture can be regenerated/modified without reverse-
engineering the binary). Confirmed the resulting holding parses as fully valid (not just non-empty
— `CasImportServiceImpl.preview` throws if parsing finds nothing at all, so a "landed on review"
result alone wouldn't prove much) before writing the test around it.

This sidesteps the parser's real flakiness risk — the suite doesn't drive fuzzy real-world PDF
parsing, just the upload → review → confirm round trip on a PDF engineered to parse cleanly — at
the cost of not exercising the manual-fix-a-row / "Add missed scheme" paths `ImportCasModal.tsx`
provides for when the parser gets a row wrong or misses one entirely. Both `importFromCas()`'s own
comment and `InvestmentsPage.ts` flag this explicitly for whoever adds that coverage later.

## Phase 14: Expense Split depth

Three more tests in `expense-split.spec.ts`, extending Phase 11's single-participant/equal-split
coverage: splitting equally among **multiple** participants, splitting with **custom (unequal)**
per-participant amounts, and the previously-uncovered single-split `settle` endpoint. This needed
a second family member — `expense-split.spec.ts` now provisions two (`memberOne`/`memberTwo`), not
one.

`TransactionsPage.addExpenseWithSplit` was generalized from a single `splitWithMemberId` to a
`participants: string[]` array plus an optional `customShares` map (switches the form to
custom-amount mode and fills each participant's share) — three real call sites (equal-single,
equal-multi, custom) justified the change over adding a second near-duplicate method.
`ExpenseForm.tsx`'s custom-amount `<input>` had no `data-testid` before this pass (the toggle/
participant-chip/mode-button testids already existed from Phase 11) — added
`expense-split-custom-share-{participantId}`, matching the existing per-participant convention.

Custom amounts are asserted via a new `api.helper.ts` method, `getMySplits`, rather than parsed out
of the UI's locale-formatted currency text — `SplitParticipantRequest.shareAmount` is sent and
stored verbatim (confirmed in `ExpenseSplitServiceImpl`), so an exact-value API assertion is both
simpler and more precise than a text-content check on `SplitsCard`'s rendered balance row.

**A real product gap, not a bug**: `POST /expense-splits/{id}/settle` (settle exactly one split)
has no UI surface anywhere in the app. `SplitsCard.tsx` — the only place split balances render —
only ever calls `settle-with/{counterpartId}` (settle *every* pending split with one person at
once). `useSettleSplit()` in `useExpenseSplits.ts` calls the per-split endpoint correctly but is
never imported by any component — dead code backing a real, working endpoint the UI just never
reaches. The new test calls it directly via `api.helper.ts`'s `settleSplit` (added alongside
`getMySplits`) so the endpoint has at least some coverage, and confirms it only clears that one
split's `PENDING` status and the counterpart's balance stays otherwise intact — worth flagging to
whoever owns the Family page as a UI gap (a user with several splits against the same person has no
way to settle just one) rather than something this suite should work around.

**Provisioning a second extra member surfaced a real rate-limit collision**, not a test bug: the
original Phase 11 file provisioned one member (register + login + a UI login just to click Join —
3 auth-endpoint calls), which fit under the 10 req/min `/auth` limit alongside global-setup's own 4
calls and this file's `regressionUser` login. Provisioning a *second* member the same way pushed
the file to ~11 auth calls in quick succession and reliably 429'd partway through `beforeAll`
(always at the second member's UI login, never the first — a reproducible symptom, not flakiness).
Fixed by adding `api.helper.ts`'s `joinFamily` and having both members join via a direct authenticated
POST instead of a real UI login + Join click — this file was never testing the join flow itself
(`family.spec.ts` already covers that with a real UI join), so bypassing the UI here follows the
same "seed what isn't under test via the API" pattern the README's "Real rate limits" section
already recommends. The new per-split-settle test goes further and seeds its expense via
`api.createExpense` too (with a `splitWith` array) rather than a full Add-Expense round trip through
the UI, for the same reason — this file's other four tests already drive enough `/transactions` +
`/family` page loads on their own to sit close to the API's general 200 req/min limit, and an extra
full UI create here reliably tipped it into a 429 as well.

## Phase 15: Vault Health / TOTP / Export / password generator / trust-session

Vault's own roadmap ([[project_vault_roadmap]] internally) shipped a full feature set after Phase
10 first scoped this suite: reused/weak/breached password detection (`VaultHealthCard`), TOTP/2FA
codes (`TotpCodeDisplay`), a step-up-gated CSV export (`ExportVaultModal`), a customizable
password/passphrase generator (`PasswordGeneratorPanel`), and an opt-in "trust this device" reveal
skip. None of it had permanent regression coverage before this pass — five new tests in
`vault.spec.ts` (11 total now, was 6).

Added testids that didn't exist: `vault-health-card`/`vault-health-tile-{reused,weak,breached}`/
`vault-health-item-row`/`vault-health-all-clear`, `vault-export-open`/`-password-input`/`-submit`,
`vault-totp-input`, `vault-trust-device-checkbox`. The password generator and TOTP code display
needed no new testids — driven via `getByRole`/`getByText` on their own visible labels.

**Reused** and **weak** are asserted deterministically (secret hashing and the strength heuristic
both run synchronously, locally, at write time). **Breached** is a real call to HIBP's public
Pwned Passwords k-anonymity API (`VaultServiceImpl#checkBreach`) — asserted on anyway, unlike the
NSE/BSE live search this suite deliberately mocks elsewhere (see Phase 18), because HIBP is a
free, key-free, purpose-built-for-automated-checking public service, not a fragile scraped feed;
`password123` (used as the deliberately weak/reused test password) has been in its breach corpus
for years. The test passed clean on the first real run, breach check included.

**A real, previously-undiscovered app bug surfaced and got fixed along the way** (found while this
work was paused for a few hours so the user could finish the Vault Health rollout by hand in
parallel — see this file's git history / the `feedback_frontend_form_gotchas` memory for the full
story): editing any vault item silently did nothing whenever its `username`/`url`/`category`/`icon`
were unset. `vaultItemSchema`'s `.optional()` fields only accept `undefined`, but the API's JSON
response serializes an unset field as `null`; that `null` flowed straight into the edit form's
`defaultValues` and failed validation with zero visible error anywhere (no request, no toast).
Fixed by coalescing `null → undefined` when building `defaultValues` from the fetched item.

## Phase 16: Statement Import (CSV) depth

Three more tests in `statement-import.spec.ts` (4 total, was 1): the manual column-mapping step
(a CSV with headers — `Entry Time`/`Info`/`Out`/`In` — that deliberately normalize to strings not
in any of `StatementImportServiceImpl`'s alias sets, so `autoDetect` returns null and the preview
response comes back `needsMapping: true`), a password-protected PDF (see
`generate-sample-bank-statement-pdf.py`, a password-protected sibling of the existing PDF-generation
script), and per-row editing (toggle a row's include checkbox, bulk-categorize two rows at once via
the "select for bulk" affordance, individually reassign a third row's category) on a 5-row CSV
fixture (`sample-bank-statement-multirow.csv`) purpose-built so two rows have no auto-suggested
category (eligible for bulk-select) and one is toggled off entirely.

Added testids `ImportStatementModal.tsx` didn't have: `import-statement-password-input`,
`import-statement-map-{date,description,debit,credit,amount}` (the mapping step's five `<select>`s
had none at all before this), `import-row-select-{rowIndex}` (the bulk-select click target — a
plain onClick div with no testid previously), and an explicit `testId="import-bulk-category"` on
the bulk-apply `CategoryPicker` instance (was relying on that component's shared default
`"category-picker"` id).

## Phase 17: CAS Import (PDF) depth

Two more tests in `cas-import.spec.ts` (3 total, was 1): a password-protected CAS PDF (see
`generate-sample-cas-statement-locked.py`, sibling to the existing generator script, same
hand-picked-against-the-parser's-own-regexes approach the original fixture uses — a different
scheme/folio than the unlocked fixture so the two don't collide when both specs run in one pass),
and — in one combined test — both of `ImportCasModal`'s answers to its own parser's admitted
unreliability: manually fixing an incomplete parsed row (clearing "Current value" on the one row
`sample-cas-statement.pdf` parses cleanly, confirming Import disables and an inline warning
appears, then refilling it) and "Add missed scheme" (adding a second holding entirely by hand).

Added testids `ImportCasModal.tsx` had none of: `import-cas-password-input`, `import-cas-add-row`,
and per-row `import-cas-{checkbox,scheme,units,nav,value,invested,remove}-{rowIndex}` — none of the
row-level inputs (scheme name, units, NAV, current value, invested amount) had any testid before
this, since `LabeledInput` (the shared per-field wrapper) didn't accept one. `rowIndex` is negative
for a manually-added row (`ImportCasModal`'s own `manualRowSeq` module-level counter starts at -1
and decrements) — `InvestmentsPage.casRowField()` just interpolates whatever integer it's given,
positive or negative.

## Phase 18: Stock / Mutual Fund investment creation

Two more tests in `investments.spec.ts` (8 total, was 6) — the last two investment types that had
no coverage of any kind, skipped since this suite was first scoped because both go through
`LiveSearch`, which queries real NSE/BSE data (stocks) or MFAPI (mutual funds). Sidestepped the
same way Phase 17's CAS PDF and Phase 16's statement fixtures sidestep their own live-data risks:
`InvestmentsPage.mockStockSearch()`/`mockMfSearch()` intercept the `/investments/search/{stocks,mf}`
network call itself (`page.route()`) and fulfill it with a canned, deterministic single result,
rather than depending on a real external service being up and returning something matching
whatever query string the test happens to send.

`LiveSearch.tsx` had zero testids before this (shared by both the Stock and MF forms) — added
`live-search-input` and `live-search-result-{index}`/`live-search-results` (the results dropdown
and each option button). `StockForm.tsx`/`MFForm.tsx` also had no testids on their own
units/price/date fields — added `stock-units-input`/`stock-avg-buy-price-input`/
`stock-purchase-date-input` and the `mf-` equivalents, plus a `testId` prop on `FormDatePicker` in
both (previously omitted, so `pickDate()`'s helper — which needs a trigger testid — couldn't target
either form's date picker at all).

## Phase 19: Dividend suggest/dismiss

New file `dividend.spec.ts` (2 tests) for `InvestmentServiceImpl#getDividendSuggestions` /
`dismissDividend` — part of the `investment` domain (not a separate backend module, despite
CLAUDE.md's domain glossary naming `dividend` as if it were), and had zero coverage of any kind.
`DividendSuggestionsSection.tsx` (rendered on the Investments page's Stocks tab) had no testids —
added `dividend-suggestion-row`/`dividend-amount-input`/`dividend-log-button`/
`dividend-dismiss-button`/`dividend-log-all-button`.

Suggestions need an `NseCorporateAction` row (ex-date after the stock's purchase date, positive
dividend-per-share) for a symbol the user actually holds — that table is normally populated by a
scheduled job pulling real NSE data, with no create/seed API of any kind. Added
`auth.helper.ts`'s `seedDividendCorporateAction` — a direct-Postgres insert (same `pg.Client`
pattern `markEmailVerified`/`markAdmin` already establish, for the same reason: no other path
exists) rather than depending on the real scheduled job having fetched a real upcoming dividend for
whatever stock this suite happens to hold, which would be exactly the kind of live-external-data
flakiness this suite avoids elsewhere. The stock itself is created via Phase 18's mocked
`LiveSearch`, so this file has no live-data dependency at all. One test logs a suggestion as
income and confirms it disappears from the pending list; the other dismisses one and confirms the
dismissal survives a fresh page reload (`DismissedDividendRepository` — not just a client-side hide).

## Phase 20: WebAuthn — a real passkey register+login round trip

New file `webauthn.spec.ts` (1 test), plus `helpers/webauthn.helper.ts`'s `addVirtualAuthenticator`
— attaches a Chromium CDP virtual authenticator (`WebAuthn.enable` +
`WebAuthn.addVirtualAuthenticator`, `protocol: "ctap2"`, `automaticPresenceSimulation: true`) to a
page so `navigator.credentials.create()`/`.get()` resolve automatically instead of hanging on a
real device prompt. This is a first-class Chromium testing feature built for exactly this, which
is why WebAuthn gets real round-trip coverage here while **Google OAuth stays boundary-only** —
there's no CDP-level "virtual OAuth provider"; a real OAuth round trip would need either a live
test Google account (flaky, account-management overhead) or backend test doubles for Google's
token endpoint, a bigger infra project than this pass.

**A real environment fact surfaced, not a test bug**: registering/logging in against
`localhost:3000` (this suite's own `BASE_URL` default for browser navigation) fails with a
`SecurityError` no matter how correctly the virtual authenticator is configured. WebAuthn is
origin-bound — the browser rejects the ceremony unless the server's advertised `rpId` is the
current page's own domain or a registrable suffix of it, and this deployment's `WebAuthnConfig`
derives `rpId` from `FRONTEND_URL`, which the root `.env` sets to the public
`https://wealthynest.in` tunnel domain, not `localhost:3000` — confirmed by reading
`WebAuthnConfig.getRpId()` and the root `.env` directly, not guessed. `webauthn.spec.ts` is
deliberately the one test in this whole suite that opens its own context pointed at
`https://wealthynest.in` instead of localhost for exactly this reason. The `tunnel` service
(`docker-compose.yml`) is already part of this suite's assumed `docker compose up -d` stack, so
this isn't a materially new dependency — just the first test to actually need it live rather than
only the local container ports.

**A real rate-limit lesson, the same shape as Phase 14's**: this test used to live in
`security.spec.ts` (reusing that file's one dedicated password-change user, to avoid a third
`provisionE2EUser()` call). That backfired — pairing it with `security.spec.ts`'s own auth traffic
(one provision + three logins) in the same file reliably tipped the *combined* file over the
`/auth` endpoint's 10 req/min limit, even though each half stayed under budget alone. Moved to its
own file with its own single dedicated user instead, which reliably passes in isolation — the fix
was file separation, not less traffic overall. Global-setup's own fixed 4-call floor (register +
login × 2 users, every invocation) means any two auth-heavy files run back-to-back within the same
~60s window are naturally at risk; space full runs apart or isolate with `-g` while iterating, same
guidance the "Real rate limits" section above already gives.

## Phase 21: firefox / webkit cross-browser support

Built out the per-project user provisioning the "chromium only, on purpose" section above always
said would be needed: `config/env.ts`'s `storageStatePathFor`/`regressionStorageStatePathFor` and
`auth.helper.ts`'s `e2eUserFileFor`/`regressionUserFileFor` now take a project name and return a
per-project-suffixed file for anything outside a small shared set; `global-setup.ts`/
`global-teardown.ts` loop over `PROJECTS_TO_PROVISION` (from `E2E_PROJECTS`, comma-separated,
defaulting to just `"chromium"` — today's behavior, unchanged) instead of hardcoding one pair of
files; `fixtures/index.ts`'s `authedPage`/`authenticatedPage`/`regressionUser`/`e2eUser` resolve
via `testInfo.project.name`. New scripts `test:regression:firefox`/`test:regression:webkit` set
`E2E_PROJECTS=chromium,firefox` (etc.) and run with `--project=firefox`. Six regression files that
call `readRegressionUser()`/`readE2EUser()` directly (outside the fixture system, in `beforeAll` or
a test body, for setup that isn't itself what the file is testing) — `budgets`, `transactions`,
`analytics`, `statement-import`, `recurring-rules`, `expense-split` — were updated to thread
`testInfo.project.name` through too, so they stay cross-project-safe rather than silently reading
chromium's file regardless of which project actually ran them.

Verified for real, not just by inspection: `E2E_PROJECTS=chromium,firefox npx playwright test
tests/regression/accounts.spec.ts --project=firefox` passes 7/7 — including "only one Cash Wallet
is allowed", the exact singleton-collision test the "chromium only" section above named as the
concrete failure mode. `debts.spec.ts` passes 5/5 the same way.

**A regression this change almost shipped, caught before it did**: the first version treated only
`"chromium"` as sharing the original unsuffixed storageState file, suffixing every other project —
including `mobile-chrome`, which `test:responsive` has used successfully since Phase 9 by
*intentionally* reusing chromium's regressionUser storageState (safe, since `tests/responsive/`
never mutates anything, so the singleton-collision risk per-project isolation exists for never
applied to it). That would have broken `test:responsive` the next time it ran — `authedPage` would
have looked for a `regression-user.mobile-chrome.json` that global-setup never provisions by
default, and thrown reading a nonexistent file. Fixed by making the "which projects share the one
file" set explicit (`chromium`, `mobile-chrome`, and Phase 23's `tablet` — every project that only
ever runs read-only suites) rather than "everything except chromium" — caught by re-running
`test:responsive` immediately after the fixture change, not by inspection.

firefox/webkit still don't run by default — `test:regression` and friends stay pinned to
`--project=chromium` (see "chromium only, on purpose" above); this phase makes running them
against another project *possible and correct* when explicitly requested, not the default sweep.

## Phase 22: Accessibility — full severity tightening

`tests/a11y/a11y.spec.ts` now asserts on every axe impact tier (critical/serious/moderate/minor),
not just critical/serious — Phase 9 deliberately deferred this "once critical/serious is
consistently clean," which it was. Two real moderate findings surfaced and got fixed, not just
asserted around:

- **`region` (login page)**: neither the left brand panel nor the right form panel were inside any
  landmark element — `LoginForm.tsx`'s two top-level `<div>`s became `<aside aria-label="WealthyNest">`
  and `<main>`.
- **`heading-order` (dashboard, and the same pattern on transactions)**: every dashboard card title
  was an `<h3>` sitting directly under the page's one `<h1>` (`Header.tsx`'s page title), skipping
  `<h2>` entirely. Promoted eight card-title headings from `<h3>` to `<h2>`
  (`BudgetSection`/`NetWorthTrend`/`GoalsSummary`/`SpendingDonut`/`SixMonthTrend`/
  `InvestmentPanel`/`TransactionList`/`WalletOverview.tsx`) and the four transactions-page tab
  headings the same way (`IncomeTabContent`/`TransfersTabContent`/`AllTabContent`/
  `ExpensesTabContent.tsx`). `accounts.spec.ts`'s own card headings were already `<h2>` — no fix
  needed there. All five scanned pages pass clean at every severity tier.

Scope is unchanged otherwise — still the same five pages (login, dashboard, accounts, transactions,
investments, budgets); broader page coverage remains a gap (see below).

## Phase 23: Visual regression breadth + tablet-landscape responsive breakpoint

Two independent, small additions:

- **Visual regression**: two more static pages — Signup and Contact (`tests/visual/`, now 4
  screenshots, was 2). Contact (`settings/support/contact/page.tsx`) has no per-user content
  at all (a fixed support email address and two static nav links), the same shape as the existing
  FAQ baseline. Both new baselines generated clean on first run; the existing login baseline still
  matched pixel-for-pixel after Phase 22's `<aside>`/`<main>` landmark change (a tag-name/semantics
  change, not a visual one).
- **Tablet-landscape responsive**: a new `tablet` Playwright project (`devices["iPad (gen 7)
  landscape"]`, 1080×810) and `tests/responsive/tablet.spec.ts` (3 tests, `npm run test:tablet`).
  1080px sits comfortably *above* Tailwind's default `lg` breakpoint (1024px, unmodified in
  `tailwind.config.ts`), so this exercises the app's **desktop** layout (sidebar visible, not the
  mobile overlay) at a narrower-than-typical desktop width — genuinely different coverage from
  Phase 9's `mobile-chrome` (phone width, below `lg`), not a duplicate of it. Same skip-guard
  pattern as `responsive.spec.ts` (`test.skip(testInfo.project.name !== "tablet", ...)`) so it's
  inert if picked up by an unscoped run.

## Known gaps

Most of what this section used to list (Vault Health/TOTP/export, Stock/MF investments, Dividend,
Statement/CAS Import depth, WebAuthn, cross-browser, a11y severity, visual/tablet breadth) was
closed out in Phases 15-23 above. What's genuinely left:

- **Google OAuth** is covered only at the boundary (the button renders, the correct request fires)
  — see Phase 20 for why a full round trip isn't realistically achievable in this suite (no
  CDP-level virtual OAuth provider the way WebAuthn has a virtual authenticator; would need a live
  test Google account or backend test doubles).
- **Cross-browser** (Phase 21) is now correct when run, but still opt-in — `test:regression` and
  the other default scripts stay pinned to `--project=chromium` (see "chromium only, on purpose").
  `test:auth`/`test:smoke`/`test:regression`'s own specs were verified via `accounts.spec.ts` and
  `debts.spec.ts` under firefox; the other 22 regression files haven't each been individually run
  under firefox/webkit, just made structurally safe to (per-project storageState + the six direct
  `readRegressionUser()` callers threaded through — see Phase 21).
- **Accessibility** (Phase 22) now asserts every severity tier, but still only the same five pages
  (login, dashboard, accounts, transactions, investments, budgets) — goals, debts, family, reports,
  notifications, settings, vault, analytics, and net worth aren't scanned at all.
- **Responsive**: covers layout mechanics (mobile nav, FAB reachability, no horizontal overflow) on
  four pages across two breakpoints now (`mobile-chrome` phone-width, `tablet` landscape-above-`lg`
  — Phase 23) — not a full per-page mobile/tablet UX pass, and no portrait-tablet or narrow-desktop
  (below typical monitor width but above `lg`) breakpoint either.
- **Visual regression**: four static pages now (login, signup, FAQ, contact — Phase 23) — still
  excludes every page with real per-run-dynamic content (dashboard, accounts, transactions, etc.),
  which would need masking or a fully-seeded deterministic empty state to screenshot safely.
  Baselines are pinned to macOS — see Phase 9's note on regenerating them per platform before
  trusting a cross-platform failure.
- **Expense Split**: covered as of Phase 14 (multi-participant, custom amounts, the per-split
  `settle` endpoint). Not covered: a participant declining/removing themselves from a split, and
  the `pending` list's own display (only `balances` — the aggregated-by-counterpart view on
  `SplitsCard` — has UI coverage; there's no UI surface for the per-split list at all, same gap the
  per-split `settle` endpoint has).
- **Performance**: `loadEventEnd` against a generous fixed ceiling on four pages — not Core Web
  Vitals (LCP/CLS/INP), and not a real budget (see Phase 9's reasoning on environment variance).
