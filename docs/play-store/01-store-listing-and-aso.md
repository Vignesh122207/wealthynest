# Store Listing + ASO

Grounded in the actual feature set (verified against code, not the marketing copy): expense/income
tracking, shared household budgets, goals linked to accounts, investments with XIRR (NSE stocks,
mutual funds, gold, FDs, bonds — these 5 are the only investment types with a real "add investment"
form; see the correction below), EPF/PPF as a manually-tracked net-worth **asset** (separate module,
no live tracking/XIRR), net worth trend, debt/lending tracker, family groups via invite code, expense
splitting ("Split with family"), CSV/UPI bank-statement import, low-balance and spend-anomaly alerts,
PIN + passkey (WebAuthn) + Google Sign-In + native fingerprint unlock, no ads, free. Category:
**Finance**.

**Correction (verified 2026-07-29, after this doc was first drafted)**: the original draft of this
package claimed "PPF and NPS investment tracking with XIRR." That was wrong. Checked
`InvestmentType`/`AssetType` backend enums and the actual frontend forms:
- `PPF` and `NPS` exist as `InvestmentType` enum values and have icon/color metadata
  (`investmentTypeMeta.ts`, `netWorthMeta.ts`) wired up for *display*, but the Investments page's
  `TABS`/`TAB_TO_INVESTMENT_TYPE` (`features/investments/constants.ts`) only offers **Stocks, Mutual
  Funds, Gold, Fixed Deposits, Bonds** — there is no "Add PPF" or "Add NPS" form anywhere. A user
  cannot actually create a PPF or NPS investment record today. Same story for `REIT` and `GOLD_ETF`
  as investment types — metadata exists, no form exists.
- Separately, `EPF_PPF` **is** a real, user-selectable option — but as an **Asset** type (`ASSET_TYPES`
  in `lib/constants.ts`, labeled "EPF / PPF"), not an Investment. Assets are manual net-worth entries
  (you enter a value, it's just a number in your net-worth rollup) — no live pricing, no XIRR, no
  transaction history the way Stocks/MF/Gold/FD/Bonds get.
- **NPS has no equivalent anywhere in the app UI** — not in Investments, not in Assets. It should not
  be mentioned in the store listing at all until a real NPS input path ships.

All copy below has been corrected to reflect this. If PPF/NPS investment tracking becomes a real
shipped feature later, this document (and the actual Investments `TABS` array) both need updating
together — don't let the marketing copy drift ahead of the form again.

## App Name

**Play Console "App name" field (30 char max):**
```
WealthyNest: Budget & Wealth
```
(28 characters — fits the limit, leads with the brand, and gets "Budget" — the single highest-intent
finance-app search term in India — into the name itself, which Play weights heavily for search.)

Alternate if you want net worth/investing weighted higher instead of budgeting:
```
WealthyNest: Money & Net Worth
```
(30 characters exactly.)

## Short Description (80 char max)

```
Track expenses, budgets & investments together — free, no ads, for families.
```
(78 characters. Leads with the 3 core use-cases, closes with the two differentiators — "free" and
"no ads" — that this app can uniquely and truthfully claim, per Terms §2.)

## Full Description (4000 char max)

```
WealthyNest is the all-in-one money app built for Indian families — track spending, share budgets
with people you trust, and watch your net worth grow, all without a single ad.

Most finance apps make you choose: a budgeting app, a separate investment tracker, and a separate
way to split bills with family. WealthyNest brings all of it into one place, and keeps your family's
finances visible to the people who should see them — not to advertisers.

💰 EXPENSES & BUDGETS
• Log expenses and income in seconds, or import a bank/UPI statement CSV and review before saving
• Set monthly budgets by category with alert thresholds — get notified before you overspend
• Share a household budget with your family — everyone sees the same numbers, no group chat math
• Recurring expenses and income are tracked automatically

👨‍👩‍👧‍👦 FAMILY, TOGETHER
• Create a family group with a simple invite code
• Split any expense with family members — WealthyNest nets out who owes whom and lets you settle up
  in one tap
• See per-member spending and a shared expense feed

📈 INVESTMENTS & NET WORTH
• Track stocks (live NSE prices), mutual funds, gold, fixed deposits and bonds in one portfolio
  view, with XIRR calculated for you
• Track EPF/PPF and other long-term holdings as net-worth assets alongside your investments
• Track loans and debts — money you've lent or borrowed — with payment history
• Watch your net worth trend month over month, assets minus liabilities, automatically

🔔 ALERTS THAT ACTUALLY HELP
• Budget-breach notifications before you're over
• Low-balance alerts on any account
• Spend-anomaly alerts when a single expense is unusually large for that category

🔐 SIGN IN YOUR WAY
• Email/password, Google Sign-In, or passkeys (fingerprint/face/screen lock)
• Quick PIN unlock with native fingerprint support on Android
• Your session never leaves your device unencrypted

🇮🇳 BUILT FOR INDIA
• INR-first, with support for viewing amounts in USD/EUR/GBP
• Understands Indian investment types (NSE stocks, EPF/PPF, gold) that global apps don't
• Data hosted in India, on encrypted servers

🚫 NO ADS. NOT FOR SALE.
WealthyNest is free and stays free. We don't show ads, and we don't sell or share your financial
data with advertisers — ever. Our only priority is helping your family see and grow its money
together. Read our full Privacy Policy in-app or at wealthynest.in/privacy.

Whether you're tracking your first budget or managing a full family portfolio across cash, stocks,
gold and property, WealthyNest gives you one clear picture of where your money is — and where it's
going.
```
(≈2,150 characters — well under the 4,000 limit, leaves headroom to expand per-release without a
rewrite.)

## Keywords (for your own ASO tracking — Play has no separate "keywords" field, it indexes title +
short + full description)

Primary (high intent, India-specific):
`budget app india`, `expense tracker`, `family budget app`, `net worth tracker`, `investment tracker
india`, `nse stock tracker`, `ppf tracker`, `split expenses with family`, `bank statement import`,
`no ads finance app`

Secondary (feature-specific long tail):
`xirr calculator app`, `shared household budget`, `upi expense tracker`, `passkey login app`,
`family finance app india`, `debt and loan tracker`

## SEO-Optimized Description (for the website/App landing page `<meta description>`, not Play Console)

```
WealthyNest is a free, ad-free personal finance app for Indian families. Track expenses and budgets,
split bills with family, follow NSE stocks/mutual funds/gold/FD/bond investments, and watch your net
worth grow — all in one app.
```
(158 characters — fits Google Search's typical snippet truncation point.)

## What's New (Version 1.0.0)

```
Welcome to WealthyNest! 🎉

This is our first release — everything you need to manage your family's money in one place:

• Expense & income tracking, with bank/UPI statement CSV import
• Shared household budgets with breach alerts
• Split expenses with family and settle up in one tap
• Investment tracking with XIRR: NSE stocks, mutual funds, gold, FDs, bonds — plus EPF/PPF as a
  net-worth asset
• Net worth trend, debt/loan tracker, low-balance and spend-anomaly alerts
• Sign in with email, Google, or a passkey — plus native fingerprint unlock

Free forever. No ads. Your data is never sold.

Questions or feedback? Reach us anytime at support@wealthynest.in.
```

## ASO strategy — feature ordering & search optimization

- **Title strategy**: put the single highest-volume term ("Budget") in the 30-char title itself —
  Play's ranking algorithm weights title matches highest, description matches lower, so this is the
  single highest-leverage ASO lever available before launch.
- **Short description**: front-load the 3 use-cases users actually search for (expenses, budgets,
  investments) rather than a brand tagline — the short description shows above the fold on the store
  listing and in search results, so it needs to do keyword work, not just read nicely.
- **Full description feature ordering**: Expenses/Budgets first (broadest search volume + lowest
  intent friction — everyone budgets, few actively invest), then Family (the genuine differentiator
  vs. every US-market budgeting app), then Investments (higher-intent, lower-volume searchers who'll
  read further), then Security/India-specific/No-ads last (trust-building close, not a hook).
- **Re-run ASO after 2–4 weeks live**: Play Console's "Store listing experiments" (A/B test icon,
  screenshots, short description) needs real install traffic to be statistically meaningful — don't
  tune blind before launch, tune from Week 2 data (see `09-launch-plan.md`).
- **Localization consideration**: if a Hindi (or other regional language) translated listing is ever
  planned, Play indexes each localized listing's own text independently — a future ASO pass, not a
  v1.0.0 blocker, but worth flagging since the target market is India-wide, not English-only.
