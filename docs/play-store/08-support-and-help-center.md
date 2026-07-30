# Support Documentation

This is a curation/organization pass, not new content invention — nearly all of this already exists
in the app (`/support`, `settings/support/faq`, `settings/support/contact`,
`settings/support/tickets`). What's below is how to present it for Play Console's "Support" fields
and for a standalone Help Center if you want one at launch.

## Help Center structure

Play Console asks for a support email, and optionally a website/Help Center URL. Use:
- **Support email**: `support@wealthynest.in` (already the consistent address used across Privacy,
  Terms, Support page, and the new Delete Account page — keep it this way, don't introduce a second
  address anywhere)
- **Website**: `https://wealthynest.in/support` — already public, already has FAQ + contact CTA, and
  is a legitimate Help Center in its current form. No new page is required to satisfy this field.

If a more formal, categorized Help Center is wanted later (post-launch), organize it into the same
groupings the existing FAQ already implicitly uses:
1. Getting started (family setup, sign-in options)
2. Expenses & budgets (recurring, CSV import, alerts)
3. Investments & net worth
4. Family & sharing (splits, invite codes)
5. Account & security (PIN, passkeys, deletion)
6. Data & privacy

## FAQ (current, from `/support/page.tsx` — already comprehensive, reuse as-is)

The existing 11-item FAQ already covers: family invite codes, recurring expenses, investment
tracking, data security, data export, bank/Account Aggregator status (honestly stated as
not-yet-available), budget alerts, account deletion, CSV/UPI import, sign-in options, and currency
display. This is genuinely solid, launch-ready content — no rewrite needed. One addition flagged in
`03-legal-and-policy-pages.md` §6: add a push-notification FAQ entry once Firebase setup is live,
not before.

## Contact Support

Already implemented end-to-end: public `/support` page's mailto CTA (immediate, no-login path) plus
the authenticated ticketing system (`settings/support/contact`, `settings/support/tickets`,
`settings/support/tickets/new`, `settings/support/tickets/[id]`) for logged-in users who want a
tracked conversation instead of email. Nothing missing here — this is more support infrastructure
than most first-release apps ship with.

## Known Issues (for a launch-day support doc / internal reference — be upfront about these rather
than letting users discover them as "bugs")

- **Bank/Account Aggregator sync is not yet available** — already disclosed honestly in the FAQ
  ("We are working on Account Aggregator integration"). Users import via CSV/manual entry today.
- **Reinstalling the app or moving to a new device requires signing in again** — this is intentional
  (`allowBackup="false"`, see `05-manifest-and-technical-review.md` §3), not a bug, but worth a
  proactive Known Issues line so it isn't reported as data loss.
- **Multi-currency is display-only** — changing the currency preference changes the symbol/rounding
  shown, not real FX conversion of underlying values (confirmed: no FX-rate logic exists in
  `lib/utils.ts`'s formatting helpers). Worth stating explicitly so a user switching from INR to USD
  doesn't expect converted totals.
- **Per-account statement download exists and works** — correcting this doc's own prior claim (and a
  now-doubly-wrong memory note before that): every account card on the Accounts page
  (`AccountCard.tsx`) has a "Download statement" button (`downloadAccountStatement.ts`), which
  generates a branded **PDF** (not CSV, and not via any `/accounts/{id}/statement` backend endpoint —
  that endpoint genuinely doesn't exist) entirely client-side, pulling expenses via the existing
  expenses API filtered by `accountId` and transfers via `/accounts/transfers`, then rendering
  through the shared PDF report builder (`lib/pdf/reportPdf`). Confirmed passing test suite
  (`downloadAccountStatement.test.ts`, 7 tests) and confirmed visually on a live screenshot of
  `/accounts`. Safe to mention in the store listing/screenshots after all — just describe it
  accurately as a PDF statement, not a CSV export, and not tied to the old backend route.
- **WebAuthn/passkey login has not been manually verified end-to-end on a real Android device** —
  flagged already in the codebase's own session notes; the Capacitor WebView's passkey ceremony
  needs a real-device pass (`ANDROID_APP_ROADMAP.md` Phase 1) before being called fully verified.
  Track any early passkey-related support tickets closely post-launch as the first real signal on
  this.

## Troubleshooting (common first-week support scenarios, drafted for a support macro/canned-response
library)

**"I can't sign in after reinstalling the app"**
→ Expected — Android Auto Backup is intentionally disabled for security reasons on this app. Sign in
again with email/password, Google, or set up a passkey/PIN fresh on the new install.

**"My push notifications aren't arriving"**
→ Check: (1) OS notification permission granted (Android 13+ requires an explicit prompt-accept),
(2) the specific alert type isn't turned off in Settings → Notifications, (3) confirm this is after
Firebase setup was completed for that build (see README gap #6) — if FCM isn't configured server-side
yet, push is silently a no-op by design, not a bug to chase.

**"My investment prices look delayed/wrong"**
→ NSE live prices are for reference tracking, not real-time trade execution (see the Disclaimer,
`03-legal-and-policy-pages.md` §3) — some delay is expected and disclosed.

**"I closed my account by mistake"**
→ Deactivation is reversible by an admin — email support@wealthynest.in to request reactivation; this
is different from the permanent-erasure path on `/delete-account`, so confirm with the user which one
they actually want before acting.

**"The currency amounts don't match what I expected after switching currency"**
→ Currency preference is a display symbol/rounding choice only, not a converter — see Known Issues
above. Point users at this explicitly rather than treating it as a calculation bug.
