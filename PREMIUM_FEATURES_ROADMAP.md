# WealthyNest — Premium Features Roadmap

Scope: this document plans the **subscription tier only**. Embedded-finance
revenue (AMFI MF distribution, insurance referrals) stays in
`GROWTH_STRATEGY.md` Phase 2a/2c and isn't duplicated here. Billing route:
**Razorpay web billing** (subscriptions + UPI autopay), not Play Billing —
the Android app is a Capacitor WebView against the live site today, so store
billing isn't a constraint yet; revisit if/when the app becomes a real native
build (see `ANDROID_APP_ROADMAP.md`).

## Model: everything shipped stays free, forever

**No caps on anything that exists today.** Accounts, budgets, goals, vault,
analytics, reports, family features, manual CSV/CAS import — all unlimited,
free, no change. Manual entry is the product's foundation and paywalling it
would break trust in a finance app, and it's already what every competitor
(INDmoney, ET Money, Fi) gives away free too.

Premium is **new capability**, not a paywall on old capability: things that
are currently manual and become automatic, plus AI-driven analysis the app
doesn't do at all today. This mirrors how INDmoney/ET Money actually monetize
— free tracking, paid convenience/intelligence layered on top.

Three pillars, all genuinely new builds (not extensions of existing free
features), plus a set of concrete features slotted into them:

1. **Bank Auto-Sync** — bank transactions flow in automatically instead of
   manual CSV upload. Unlocks two downstream features once transaction data
   is flowing: **EMI/Loan Auto-Detection** and **Fraud/Price-Hike
   Detection**.
2. **Stock Portfolio Auto-Sync** — holdings/transactions flow in
   automatically instead of manual entry or CAS PDF upload.
3. **AI Insights** — analysis layer the app has no equivalent of today,
   including a flagship feature: **Family Financial Health Score**.

---

## Pillar 1: Bank Auto-Sync

Today: `statementimport` module — user manually exports a bank CSV, uploads,
maps columns, confirms rows into draft expenses. Real, but manual every time.

Premium: connect via India's **Account Aggregator (AA) framework** —
user consents once per bank via their AA app (or an embedded AA widget), and
transactions sync automatically going forward. This is the gap
`GROWTH_STRATEGY.md` already calls "the real gap" and "the one thing that
will make or break you" — it's the same underlying need, framed as a premium
feature rather than a base-tier blocker.

**Technical approach**
- Integrate with an AA-ecosystem **FIU (Financial Information User)**
  provider — Setu, Finvu, or OneMoney are the usual off-the-shelf options
  that handle the Sahamati/RBI compliance surface so WealthyNest doesn't
  have to become an AA itself. Pick one based on pricing + sandbox quality;
  needs a spike before committing.
- New `banksync` domain module: `ConsentRequest`/`ConsentArtifact` entities
  (track AA consent lifecycle — grant, active, revoked, expired), a
  scheduled/webhook-driven fetch job that pulls new transactions per
  connected account, and a mapper that feeds into the **same draft-expense
  pipeline `statementimport` already uses** (reuse `ParsedRow`/confirm-flow
  rather than building a parallel ingestion path).
- Reuse existing auto-categorization logic in `StatementImportServiceImpl`
  if any exists; if categorization is currently manual-per-row, this is the
  natural place to also introduce smarter categorization (ties into Pillar 3).
- Compliance/security note: AA data is regulated financial data under RBI's
  framework — this integration touches consent, encryption-at-rest for
  fetched data, and revocation handling. Treat with the same care as
  anything in `SecurityConfig`; get the FIU provider's compliance checklist
  before writing code, not after.

**Effort**: **L-XL** (4-8 weeks) — this is the single biggest lift in the
roadmap, mostly compliance/integration surface, not app logic.

### Downstream feature: EMI/Loan Auto-Detection

Today: `debt`/`liability` modules require manual entry — the user types in
each loan, its EMI amount, and due date.

Premium: once bank transactions are flowing automatically (Pillar 1),
detect recurring same-amount debits to known lender patterns (bank/NBFC
names, "EMI" in narration) and auto-populate a draft `Liability`/`Debt`
entry for the user to confirm — same confirm-before-commit UX as
`statementimport` already uses for expenses, applied to loans instead.
Once tracked, surface prepayment-opportunity nudges (e.g. "you have
₹50,000 idle in savings earning 3.5% while this loan costs 11%").

**Effort**: **M** (1-2 weeks) — detection logic + a new draft-liability
confirm flow, but it's pure app logic once Pillar 1's transaction stream
exists. Hard dependency on Pillar 1 shipping first.

### Downstream feature: Fraud/Price-Hike Detection

Today: nothing — there's no mechanism to notice a subscription silently
raised its price or a duplicate charge slipped through.

Premium: cross-check each new synced transaction against the
recurring-charge baseline already being built for subscription detection
(Pillar 3) — if a known recurring merchant charges a materially different
amount, or the same merchant+amount charges twice within an implausible
window, raise an alert via the existing `notification` module
(`NotificationService`) instead of a silent pass-through.

**Effort**: **S-M** (1 week) once both the transaction stream (Pillar 1)
and the recurring-charge baseline (Pillar 3) exist — this is mostly a
comparison rule sitting on top of two things already being built, not a
new subsystem. Sequence it after both dependencies, not in parallel.

---

## Pillar 2: Stock Portfolio Auto-Sync

Today: `investment` module — manual entry per holding, plus `casimport` —
manual CAS PDF upload/parse (per `PRODUCTION_PLAN.md`, the CAS parser itself
is still untuned against a real-world statement). Manual entry works;
staying current requires the user to remember to update it.

Premium: holdings and transactions sync automatically from source.

**Technical approach** — two independent tracks, can ship either first:
- **Depository auto-fetch**: CDSL/NSDL both expose CAS-equivalent data via
  API to registered consumers (not just PDF). This is the automated version
  of what `casimport` already does manually — same parsed-holding shape
  (`CasParsedHolding`), different ingestion path (API pull instead of PDF
  parse). Lower integration complexity than depository-direct broker APIs
  since it's investment-agnostic (covers any broker/demat account, not just
  one).
- **Broker API sync** (optional, later): Zerodha Kite Connect, Upstox, or
  Groww's API for users who want live-ish portfolio sync including intraday
  transactions, not just periodic CAS-equivalent snapshots. Higher value,
  higher cost (each broker is a separate integration, and users are split
  across brokers) — treat as backlog beyond the initial depository-sync
  launch.
- Feeds into existing `investment`/`asset` entities and the XIRR
  (`computeXirr`/`computePortfolioXirr`) and dividend
  (`getDividendSuggestions`) logic that already exists — no new analytics
  needed, just an automated data source instead of manual entry.

**Effort**: **L** for depository auto-fetch (3-5 weeks), **XL** for
broker-API sync if pursued (each broker integration is its own project).
Recommend depository auto-fetch only for v1.

---

## Pillar 3: AI Insights

Today: `SmartAlerts.tsx` + `NotificationPreference` give rule-based alerts
(low balance, budget breach). `analytics` module gives dashboards/trends but
no narrative or prediction. There's no LLM/AI integration anywhere in the
codebase today (confirmed — no AI/LLM client, no `anthropic`/`openai` deps).

Premium: an actual intelligence layer on top of the data the app already
collects.

**Candidate features** (pick 2-3 for v1, don't build all at once):
- **Personalized spending narrative** — monthly/weekly plain-language
  summary ("You spent 22% more on dining this month, mostly in the last
  week — three orders over ₹800"), generated from existing
  `CategorySpendingResponse`/`MonthlyTrendResponse` data.
- **Recurring-charge/subscription detection** — flag expenses with a
  repeating amount+merchant pattern the user hasn't marked as recurring;
  this was flagged as a candidate before and fits naturally here since
  "detect and explain" is inherently an AI-shaped task, not just a gate.
- **Financial Q&A chat** — ask questions against the user's own data
  ("how much did I spend on groceries last quarter", "am I on track for my
  vacation goal") — needs a tool-use pattern (LLM calls into existing
  analytics/query endpoints, not a raw data dump) to keep it accurate and
  cheap.
- **Goal-achievement forecasting** — given current contribution rate and
  goal deadline, plain-language likelihood + a concrete suggestion ("add
  ₹2,000/month to hit this by December").

**Flagship feature: Family Financial Health Score**

A single composite score (0-100), computed from data that already exists
across modules — no sync dependency, ships independently of Pillar 1/2:
- Savings rate (income vs. expense, from `income`/`expense`)
- Debt-to-income ratio (from `liability`/`debt`)
- Emergency-fund coverage (liquid `WalletAccount` balance vs. average
  monthly expense)
- Net-worth trend direction (from `NetWorthSnapshot`)
- Budget adherence (from existing `BudgetSummaryResponse`)

Weighted into one number + a trend line, with the AI narrative layer
explaining *why* it moved month to month ("your score dropped 4 points —
dining spend outpaced income growth"). This is the strongest "premium
hook" of the whole roadmap: it's a single glanceable metric, easy to
market ("What's your Family Financial Health Score?"), and needs no
external integration — pure computation over data already in Postgres.

**Effort**: **M** (2 weeks) — the scoring formula is deterministic
(no LLM needed for the number itself), only the narrative explanation
uses the LLM layer. Lowest-risk, highest-visibility feature in the
roadmap — good candidate to ship first within Phase 1.

**Technical approach**
- Use the Claude API (Messages API + tool use) rather than a local model —
  matches the stack's general direction and the tool-use pattern fits the
  Q&A/forecasting features well (the model calls into existing
  `AnalyticsService`/`InvestmentService` methods as tools rather than being
  handed a raw data export).
- **Privacy is the design constraint, not an afterthought**: decide up
  front what leaves the server — aggregated numbers (category totals,
  trend deltas) are far lower-risk to send to an LLM API than raw
  transaction-level data with merchant names. Default to aggregates;
  only send row-level detail when a feature genuinely needs it (e.g.
  subscription detection needs merchant strings) and disclose that in the
  privacy policy before shipping.
- New `insights` domain module: an `InsightService` that assembles the
  aggregated context, calls the LLM, and caches the result (these are
  expensive calls — don't regenerate on every dashboard load; generate
  on a schedule or on-demand with a cache TTL).
- Frontend: a new insights panel/tab, reusing existing chart/card primitives
  from `src/components/ui/`.

**Effort**: **M-L** per feature (2-3 weeks each) once the LLM integration
scaffolding exists; the scaffolding itself (Claude API client, tool-use
wiring, aggregation-layer privacy boundary) is **M** (1-2 weeks) and only
needs building once.

---

## Technical foundation (Phase 0 — still needed regardless of feature order)

**Subscription scope: Family, not User.** Almost all data (`WalletAccount`,
`Asset`, `Budget`, `Goal`) is family-scoped per the domain glossary in
`CLAUDE.md`. The subscription must attach to `Family` — one `FamilyAdmin`
purchases, the whole family inherits Auto-Sync/AI access. A per-user
subscription would create broken half-synced-family states, especially for
Bank Auto-Sync where the synced account is genuinely shared data.

**Backend**
- New `billing` domain module: `Subscription` entity (`familyId`, `plan`,
  `status`, `razorpaySubscriptionId`, `currentPeriodEnd`).
- Razorpay integration: create-subscription endpoint, webhook handler
  (`payment.captured`, `subscription.charged`, `subscription.cancelled`) —
  webhook signature verification is a security boundary, same care as
  `SecurityConfig`.
- An `@RequiresPlan(Plan.PREMIUM)` method-level check (AOP aspect) gating
  the Auto-Sync connect endpoints and the Insights endpoints specifically
  — not a blanket check scattered through existing free-feature code, since
  nothing existing gets gated.

**Frontend**
- `usePlan()` hook (TanStack Query, reads current family's subscription
  status).
- Settings → Billing page: plan status, upgrade/downgrade, Razorpay checkout
  embed, invoice history.
- Upgrade entry points live *inside* the three new features themselves
  (e.g. "Connect your bank automatically — Premium" card in the existing
  statement-import flow) rather than a generic sitewide paywall, since
  there's nothing else to gate.

**Testing** (per `CLAUDE.md`)
- Unit tests for `SubscriptionService`, the `@RequiresPlan` aspect.
- `@WebMvcTest` for billing controller + webhook endpoint (mock Razorpay
  client).
- Playwright spec for the upgrade flow (money-movement flow per the E2E
  criteria in `CLAUDE.md`).

Effort: **L** (2-3 weeks).

---

## Phasing

**Phase 0 — Billing infrastructure (2-3 weeks)**
Subscription module, Razorpay integration, `@RequiresPlan` gating, billing
settings page. Nothing user-facing changes yet — no existing feature gets
capped.

**Phase 1 — AI Insights scaffolding + flagship feature (4-5 weeks)**
Fastest path to a sellable premium feature: no external compliance
dependency (unlike Pillar 1/2), pure build. Ship LLM scaffolding, then the
**Family Financial Health Score** first (lowest risk, highest visibility,
deterministic core), then spending narrative + recurring-charge detection.

**Phase 2 — Stock Portfolio Auto-Sync, depository track (3-5 weeks)**
One integration (CDSL/NSDL), not a multi-broker fan-out, and reuses the
CAS parsing work that already exists.

**Phase 3 — Bank Auto-Sync via Account Aggregator (4-8 weeks)**
Biggest lift, highest ultimate value (this is the gap that actually blocks
scale per `GROWTH_STRATEGY.md`). Do this last so Phases 1-2 are already
generating revenue to justify the FIU provider cost + compliance work.

**Phase 4 — Bank-Sync downstream features (2-3 weeks)**
**EMI/Loan Auto-Detection** then **Fraud/Price-Hike Detection** — both are
cheap once Phase 3 (transaction stream) and the Phase 1 recurring-charge
baseline exist, so they ride immediately after Phase 3 rather than
competing with it for priority.

**Backlog**
Broker-API live sync (Pillar 2 extension), Q&A chat + goal forecasting
(Pillar 3 extensions) — sequence by which Phase 1-2 features actually drive
upgrades.

---

## Pricing

Single premium tier, ~₹299/mo or ₹2,999/yr, per family — same reasoning as
before: not enough distinct premium surface to sustain multiple tiers yet.
Worth reconsidering once Auto-Sync and AI Insights are both live, since
"just AI" and "AI + full auto-sync" are a plausible two-tier split at that
point.

## Open decisions

- **AA/FIU provider** (Setu vs Finvu vs OneMoney) — needs a sandbox spike
  before Phase 3 starts, pricing and integration quality vary.
- **Depository API access** (CDSL vs NSDL vs both) — confirm which one(s)
  offer the API tier needed vs just bulk/registered-entity access.
- **LLM data policy**: confirm the aggregates-only default above before
  Phase 1 ships — this needs a privacy-policy update either way.
- **Trial**: free trial length for new Premium subscribers (7/14 days) —
  not decided.
- **Refund/cancellation policy**: needed before Razorpay integration goes
  live (Razorpay requires a stated policy for subscription products).
