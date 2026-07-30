# Legal & Policy Pages

Status check against what already exists in the codebase before generating anything new:

| Document | Status | Location |
|---|---|---|
| Privacy Policy | **Exists, now fixed** | `wealthynest-web/src/app/privacy/page.tsx` — added disclosure of Firebase Cloud Messaging + Google Sign-In as processors (was previously only naming "a transactional email provider"), and linked the deactivation bullet to the new `/delete-account` page |
| Terms of Service | **Exists, solid** | `wealthynest-web/src/app/terms/page.tsx` — already has a financial-advice disclaimer (§5), 18+ age gate (§3), India governing-law clause (§12). No changes needed. |
| Support Page | **Exists** | `wealthynest-web/src/app/support/page.tsx` — public FAQ + contact, already covers account deletion; updated the deletion FAQ answer to point at the new dedicated page. |
| FAQ (in-app) | **Exists** | `settings/support/faq/page.tsx` |
| Contact Page | **Exists** | `settings/support/contact/page.tsx` + the ticketing system under `settings/support/tickets/` |
| Delete Account instructions | **Built new** | `wealthynest-web/src/app/delete-account/page.tsx` — public, no-login-required page (see §2 below) |
| Disclaimer | **Missing as standalone** | Financial disclaimer content already exists inline in Terms §5 — copy below is for a dedicated page if you want one linkable independently (e.g. from the Play "Financial features" declaration) |
| Refund Policy | **Missing** | The app has no paid tier today, so this is a short, honest "there is nothing to refund" page — copy below |

## §1. Privacy Policy — the fix already applied

Diff applied to `privacy/page.tsx`, Section 4 ("Data sharing"):

**Before**: named only "a transactional email provider."

**After**: explicitly names three processors — the email provider, Google Sign-In (name + email only,
no password), and Firebase Cloud Messaging (device push token only, no financial data) — because both
Google Sign-In (`@capacitor-community/generic-oauth2`, backend `GoogleIdTokenVerifier`) and FCM
(`@capacitor/push-notifications`, backend `FcmPushNotificationSender`) are real, already-shipped
features that were undisclosed. This must stay in sync with whatever you answer on the Data Safety
form (`04-data-safety-compliance.md`) — a mismatch between the two is a real, reported rejection
pattern for finance-category apps specifically, since reviewers cross-check Data Safety claims
against the linked privacy policy for finance apps more often than for other categories.

Also updated Section 6 ("Your rights") to link the deactivation bullet to `/delete-account`.

## §2. Delete Account Instructions — new public page

Built at `wealthynest-web/src/app/delete-account/page.tsx`, reusing the existing `LegalPageChrome` +
`PremiumIcon` components (no new UI primitives introduced). Content:

- Step-by-step in-app deletion path (Settings → Profile → Close Account)
- An explicit, accurate distinction between **deactivation** (immediate, reversible, what the in-app
  button does — confirmed against `UserServiceImpl.closeAccount`: sets `active = false`, revokes all
  refresh tokens, does not delete rows) and **permanent erasure** (on request, 30-day SLA, via email)
- A data-retention table (what's deleted vs. retained) so the page itself answers Play's Data Safety
  "data deletion" question, not just the deactivation flow
- A direct `mailto:` CTA pre-filled with an erasure-request subject line

**Why a dedicated page instead of relying on the existing `/support` FAQ accordion**: Play's Data
Safety form has a specific "Account deletion" URL field reviewers check by visiting it directly — a
single unambiguous URL that states the policy in prose (not one collapsed accordion item among a
dozen FAQs) is what that field expects, and is what most approved finance apps use. Use
`https://wealthynest.in/delete-account` as the Data Safety form's answer for that field.

## §3. Disclaimer (standalone page — optional, content already exists in Terms §5)

Suggested route: `wealthynest-web/src/app/disclaimer/page.tsx`, same `LegalPageChrome` pattern as
`privacy`/`terms`. Copy (expands on Terms §5, doesn't contradict it):

```
# Financial Disclaimer

WealthyNest is a personal finance tracking and planning tool. It is not a registered investment
advisor, broker, tax consultant, or financial institution, and nothing shown in the app constitutes
financial, investment, tax, or legal advice.

- All figures (net worth, XIRR, budget projections, spend-anomaly flags) are calculated purely from
  data you enter or import — WealthyNest does not verify this data against your actual bank or
  brokerage records, and accuracy depends entirely on what you've entered.
- Live NSE stock prices are provided for reference tracking only and may be delayed; do not use them
  as the basis for a trade execution decision.
- WealthyNest does not hold, move, or have access to your actual money, bank accounts, or brokerage
  accounts. It is a tracking layer only — no payment initiation, no fund transfer, no brokerage
  integration exists in this app.
- Always consult a SEBI-registered investment advisor or a qualified tax professional (e.g. a
  Chartered Accountant) before making financial decisions. WealthyNest and its developers accept no
  liability for financial outcomes resulting from use of the app.

Last updated: [ship date].
```

## §4. Refund Policy (new — short, since there's no paid tier)

Suggested route: `wealthynest-web/src/app/refund-policy/page.tsx`. Copy:

```
# Refund Policy

WealthyNest is free to use, with no subscriptions, in-app purchases, or paid tiers. Because no
payment is ever collected through the app, there is nothing to refund.

If you have supported WealthyNest's development voluntarily (e.g. via the "Support the Developer"
page), these are one-way, non-refundable contributions, not payments for a service or feature —
they do not unlock anything and are not linked to your account status in any way.

If WealthyNest ever introduces a paid tier in the future, this page will be updated first, before
that tier ships, with a clear refund window and process.

Questions? support@wealthynest.in
```

**Note**: confirmed via `(dashboard)/support-wealthynest/page.tsx` (per prior session notes) that
this voluntary-support UPI page exists and is intentionally separate from any account feature — the
refund copy above reflects that it's a donation, not a purchase, which is the important legal
distinction for this policy to get right.

## §5. Contact Page (already exists — no changes needed, listed for completeness)

`settings/support/contact/page.tsx` + the full ticketing flow under `settings/support/tickets/`
already cover this. The public `/support` page's email CTA (`support@wealthynest.in`, "we reply
within 48 hours") is the right one to also list as the **Play Console developer contact email** and
on the Data Safety form's "contact us" field — keep these three in sync (Play Console listing,
Data Safety form, in-app copy) since a mismatched support email across surfaces is a common,
avoidable rejection-appeal delay.

## §6. FAQ — one addition worth making

The existing `/support` FAQ (11 items) is strong and already covers account deletion, data safety,
sign-in options, CSV import, and Account Aggregator status honestly ("Not yet — we are working on
it"). One gap worth adding once push notifications go live (see README gap #6): an FAQ entry
explaining what push notifications are used for and how to turn them off per-type, matching
Settings → Notifications — add this only after `google-services.json`/Firebase setup is actually
live, so the FAQ doesn't describe a feature that silently isn't working yet.
