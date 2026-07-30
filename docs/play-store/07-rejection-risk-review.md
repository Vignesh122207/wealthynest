# Simulated Google Play Review — Rejection Risk Assessment

Written from the perspective of a Play reviewer looking at the installed APK/AAB cold, without
access to this repo or its reasoning — exactly how the real review works. Ranked most to least
likely to actually trigger a rejection or a hold.

## 1. "Minimum Functionality" / repackaged-website rejection — HIGHEST RISK

**What the reviewer sees**: an app that, on launch, shows a full-screen website with no visible
native chrome. This is the single most common automatic-flag pattern for WebView-wrapper submissions
(TWAs, Cordova/Capacitor server-mode apps, plain `WebView` wrappers) — Play's own policy explicitly
calls out apps that are "not sufficiently different from a mobile browser experience."

**Why WealthyNest is actually in better shape than it looks, but still needs to demonstrate it**:
- Native fingerprint/biometric unlock (`BiometricPrompt` via `@aparajita/capacitor-biometric-auth`)
  is a genuine native capability a browser tab cannot offer.
- Native push notifications via FCM (once `google-services.json` is live) are likewise something a
  plain website/PWA notification cannot fully replicate on Android's lock screen/tray in the same way.
- Native splash screen, adaptive launcher icon, no browser address bar/tabs, `singleTask` launch mode.

**How to fix / preempt**: 
- Make sure the biometric unlock and push notifications are actually **working on the reviewed
  build**, not just present in code — a reviewer testing "sign in, background the app, foreground it"
  and seeing the fingerprint prompt fire is the single strongest signal against this rejection.
  `google-services.json` must be present for the reviewed build if push is meant to demonstrate
  nativeness.
- Do not submit a build where `server.url` points at a staging/dev URL — reviewers do check that the
  domain resolves to a real, populated product, not a placeholder page.
- If flagged anyway on first submission, the appeal response should explicitly name the native
  capabilities above — Play's own appeal form has a free-text field for exactly this kind of
  clarification, and citing concrete native APIs used (not just "we use Capacitor") is what resolves
  these appeals in practice.

## 2. Data Safety form / Privacy Policy mismatch — HIGH RISK

**What the reviewer checks**: automated + manual cross-referencing of the Data Safety form's declared
data types against the linked Privacy Policy's actual text.

**Fixed already**: the Privacy Policy previously under-disclosed (only named the email provider, not
Google Sign-In or Firebase/FCM) — this is corrected in `privacy/page.tsx` (see
`03-legal-and-policy-pages.md` §1). As long as the Data Safety form answers in
`04-data-safety-compliance.md` are entered verbatim, this risk is closed.

**Residual risk**: if Firebase/push setup is *not* actually live for the reviewed build but the Data
Safety form declares it as collected, that's a harmless over-declaration, not a rejection. The
dangerous direction is the reverse — shipping live FCM collection later without ever updating the
form. Put a standing reminder in the release checklist (`06-checklists.md`) tying "enable a new data
collector" to "update Data Safety form same day."

## 3. Account deletion policy — MEDIUM RISK, now addressed

Play requires an in-app deletion option (exists: Settings → Close Account) plus a web resource
reachable without installing the app (now exists: `/delete-account`). The remaining nuance a
reviewer may probe: the in-app/web flow **deactivates**, it doesn't erase, and full erasure requires
emailing support. This is disclosed plainly on the new page and in the Privacy Policy, which is what
Play's policy actually requires (a clear, honest process, not necessarily instant hard-delete) — so
this should pass, but if flagged, point the reviewer at the retention table on `/delete-account`
directly.

## 4. Financial-app extra scrutiny — MEDIUM RISK, mitigated by accurate declarations

Finance-category apps get a closer manual look than most categories, especially around the
Financial Features declaration. The real risk here isn't the app's actual behavior (it's a clean
personal tracker, no lending/payments) — it's **answering that section inaccurately or leaving it
blank**, which reads as evasive to a manual reviewer even when the underlying app is fine. Fill out
every sub-question explicitly as "None"/"No" per `04-data-safety-compliance.md`, don't skip it.

## 5. Permissions appearing "excessive" for a finance app — LOW RISK

Reviewers are primed to scrutinize SMS/Contacts/Camera/Location permissions specifically in Finance
apps (common pattern in OTP-scraping loan-shark apps Play has cracked down on). WealthyNest declares
none of these — the permission set (INTERNET, biometric, FCM plumbing) is unusually clean for the
category, per the full audit in `05-manifest-and-technical-review.md`. Low risk, but worth a one-line
note in the reviewer-notes field of the submission proactively: "This app does not request SMS,
Contacts, Camera, or Location permissions" — pre-empting the question reviewers are trained to ask
for this category.

## 6. Broken/incomplete reviewer login path — MEDIUM RISK (process, not code)

If the reviewer can't get past login (e.g. required email verification with no test account
provided, or a passkey/PIN-only flow with no password fallback visible), that's an instant
"couldn't complete core functionality" rejection — not because anything is broken, but because the
reviewer has no way to get in. **Fix**: provide a working test account (email/password, already
verified, with `emailVerified=true`) in Play Console's "App access" instructions field, and confirm
that account isn't affected by any lockout/rate-limit state before submitting.

## 7. Stale/placeholder assets — LOW RISK but easy to trip

A generic-looking icon, a feature graphic that doesn't match the actual app UI, or screenshots from
an empty-state/dev build all read as low-effort to both automated scoring and manual reviewers, and
can factor into borderline "quality" holds even when no policy is technically violated. Addressed by
`02-graphics-and-screenshots.md`'s explicit demo-data seeding instructions — don't skip that step to
save time.

## 8. Target audience / age mismatch — LOW RISK, already handled correctly

Selecting an under-18 audience bucket for an app whose own Terms require users to be 18+ would create
a real, self-inflicted policy conflict (Families Policy requirements the app doesn't meet, e.g. ad
tracking restrictions and content requirements irrelevant here but suddenly in scope). Already
correctly scoped in `04-data-safety-compliance.md` to 18+ only — just don't let this get changed
later without re-checking the Terms first.

## 9. Keystore loss / signing continuity — NOT a review-time risk, but a permanent-failure risk

Not something Play's reviewers check, but worth stating in this document since it's the single
highest-consequence mistake possible at this stage: if `wealthynest-release.jks` is lost before or
after the first upload, **no future update can ever be pushed to this listing again** — Play would
require publishing under a brand-new app ID, losing all reviews/installs/history. Confirm the backup
exists in at least one location outside this git repo before the first upload, not as a "someday" task.

## Overall assessment

Given the mitigations already in the code (native biometric, FCM push, clean permission set, existing
Privacy/Terms pages, working account-deletion flow) plus the two fixes applied alongside this review
(Privacy Policy disclosure gap, dedicated delete-account page), **the realistic outcome is either a
clean first pass, or a single round of the Minimum Functionality flag with a straightforward,
evidence-backed appeal** — not a hard rejection requiring an architecture change. The process risk
(reviewer login access, missing screenshots/feature graphic) is currently higher than the policy risk.
