# WealthyNest — Play Store Release Package

This directory is the complete first-production-release package for WealthyNest on Google Play.
Everything here was written against the **actual current state of the repo** (reviewed 2026-07-29),
not a generic template — file paths, code, and policy references below are real, not illustrative.

**App identity**: `in.wealthynest.app`, versionName `1.0.0`, versionCode `1`, minSdk 24 (Android 7.0),
targetSdk 36. Packaged with Capacitor in **server mode** — the native `WebView` loads the live site
`https://wealthynest.in/home` (`wealthynest-web/capacitor.config.ts`), it does not bundle a `next build`
into the APK. See `ANDROID_APP_ROADMAP.md` at the repo root for why this was chosen over a TWA or a
fully-native rewrite.

## Update: two real bugs found via emulator testing, both addressed — one still needs a real device

While implementing and verifying 4 planned improvements (R8/minify, App Links, DPDP Act privacy
reference, push-notification FAQ) on a real Android emulator, testing surfaced two issues more
serious than any of the four:

1. **The app was bouncing to Chrome on every single launch.** `wealthynest.in` (the domain
   `server.url` points at) now permanently redirects to `www.wealthynest.in`, and Capacitor's
   default WebView scoping treats that redirect target as an external site. **Fixed** via
   `capacitor.config.ts`'s `allowNavigation`, verified on-emulator.
2. **A WebView renderer OOM crash**, once that bounce was fixed and the WebView could actually load
   real content — reproducible consistently ~12–20s after launch. Investigated at length: ruled out
   R8, bundle size, and every plausible app-side polling/leak source; the emulator's Android System
   WebView turned out to be a stale Chromium 113 build (~2 years old) that couldn't be fully updated
   within this session's time budget, which is the leading suspect but **not confirmed** as the true
   root cause — no real device was available to get a clean answer. **Mitigated, not resolved**: a
   `ResilientWebViewClient` now recovers automatically from a renderer crash instead of taking the
   whole app down, verified working exactly as designed via `logcat`. **Do not submit to Play
   without checking this on a physical Android device first** — see
   `05-manifest-and-technical-review.md` §0 for the full RCA writeup, including everything that was
   ruled out and why.

## Read this first: the single biggest risk

**Google Play's "Minimum Functionality" policy targets exactly this shape of app** — a WebView that
mostly displays a website is the textbook rejection pattern ("your app appears to be a repackaged
website" / "webview app"). This is not a hypothetical; it is the most common first-review rejection
for Capacitor/Cordova/TWA-style apps. WealthyNest has real mitigating factors already built
(native biometric unlock via `BiometricPrompt`, native FCM push notifications, native splash/icon,
`allowBackup="false"` handled deliberately, no browser chrome), but the reviewer doesn't see the
source — they see the installed APK. Section 7 (`07-rejection-risk-review.md`) covers exactly how to
present this app so it reads as "a mobile app with a companion web experience," not "a website in a
frame," plus the concrete pre-submission checks to run.

## What's already in good shape (confirmed by reading the code, not assumed)

- Privacy Policy (`wealthynest-web/src/app/privacy/page.tsx`) and Terms of Service
  (`wealthynest-web/src/app/terms/page.tsx`) already exist, are substantive, and are India-law-aware
  (IT Act 2000 governing law clause, 18+ age gate, financial-advice disclaimer in Terms §5).
- Support infrastructure exists: `/support` (public), `settings/support/faq`, `settings/support/contact`,
  and a full ticketing system (`settings/support/tickets`).
- Account deletion exists end-to-end: `UserController#closeAccount` (`DELETE /me`) →
  `UserServiceImpl.closeAccount` sets `user.active = false` and revokes all refresh tokens. This is a
  **deactivation**, not erasure — matches what the Privacy Policy already discloses (§6: "email us if
  you need it permanently erased instead"). Data Safety and the Delete Account page must describe this
  distinction accurately — see `03-legal-and-policy-pages.md`.
- No ads anywhere in the codebase or copy (confirmed: Terms §2 states "provided free of charge and
  without advertisements"). Ads declaration is a clean "No ads."
- `AndroidManifest.xml` is minimal and clean — see `05-manifest-and-technical-review.md` for the full
  merged-manifest audit (permissions all justified, nothing missing).
- App icons (`public/icons/icon-512.png`, maskable variants) and native splash screens already exist
  and are wired into the Android resource tree correctly.

## Real gaps found — fix before/alongside submission

| # | Gap | Why it matters | Where it's addressed |
|---|-----|-----------------|----------------------|
| 1 | Privacy Policy doesn't disclose Firebase Cloud Messaging or Google Sign-In as data processors — it only names "a transactional email provider." Both now exist in the codebase (`@capacitor/push-notifications` + FCM, `@capacitor-community/generic-oauth2` + Google OAuth). | Play's Data Safety form must match the privacy policy. A mismatch here is a real, common rejection/appeal reason, not a formality. | Fixed directly — see the diff in `03-legal-and-policy-pages.md` §1, applied to `privacy/page.tsx`. |
| 2 | No standalone, no-login-required "Delete your account" page. Deletion today lives behind auth at Settings → Profile. | Play's Account Deletion policy (in effect since Dec 2023) requires a web resource describing/initiating deletion that doesn't require reinstalling the app; the cleanest way to satisfy the Data Safety form's "Account deletion URL" field is a dedicated public page. | New page implemented at `/delete-account` — see `03-legal-and-policy-pages.md` §2. |
| 3 | No standalone Disclaimer or Refund Policy page (Refund Policy is arguably N/A since there's no paid tier, but Play/UPI-adjacent finance apps get flagged if the word "free" isn't backed by an explicit no-payments statement). | Reviewers checking a Finance-category app look for this explicitly. | Copy provided in `03-legal-and-policy-pages.md` §3–4, ready to drop into a new route each. |
| 4 | **FIXED (2026-07-29)** — No Android App Links / deep linking. Password reset and email verification links (`EmailServiceImpl`, `wealthynest.mail.frontend-url`) were plain `https://wealthynest.in/...` URLs that opened in the phone's default browser, not the installed app. | Not a rejection reason — purely a UX gap. | `autoVerify` intent-filter added to `AndroidManifest.xml`; `assetlinks.json` (already existed) verified to match the real release keystore fingerprint and confirmed live via `logcat` on a real emulator. See `05-manifest-and-technical-review.md` §5. |
| 5 | **FIXED (2026-07-29)** — `minifyEnabled false` in the release build type (`android/app/build.gradle`). | Larger APK, no R8 shrinking/obfuscation. | Enabled `minifyEnabled true` + `shrinkResources true`; verified safe with a real signed build installed and launched on an emulator, no R8 missing-rules. See `05-manifest-and-technical-review.md` §2. |
| 6 | No `google-services.json` / Firebase project committed (correctly gitignored) — push notifications are wired in code but inert until this is dropped in per `ANDROID_APP_ROADMAP.md`'s setup steps. | If Data Safety declares "push notifications" as a data-collection purpose before FCM is actually live, that's a harmless over-declaration; if it's *not* declared and then turned on post-launch without updating the form, that's a real policy violation. | Covered in `04-data-safety-compliance.md` — the form answers below already assume FCM is live, matching the code, on the (confirmed-by-you) assumption you'll finish Firebase setup before this exact build ships. |

## Directory map

| File | Covers |
|---|---|
| `01-store-listing-and-aso.md` | App name, short/full description, keywords, SEO description, What's New (v1.0.0), ASO strategy |
| `02-graphics-and-screenshots.md` | Icon, feature graphic, phone/tablet screenshots, promo graphic specs; screenshot order + captions |
| `03-legal-and-policy-pages.md` | Privacy Policy fix, Delete Account page, Disclaimer, Refund Policy, Contact Page, FAQ additions |
| `04-data-safety-compliance.md` | Data Safety form answers, permissions explanation, financial-app compliance, content rating, target audience, ads declaration, India government compliance checklist |
| `05-manifest-and-technical-review.md` | Full AndroidManifest audit: permissions, backup, network security, deep links/App Links, intent filters, security issues |
| `06-checklists.md` | Play Store assets checklist (Required/Recommended/Optional) + release checklist (Before Upload / Before Review / Before Production / After Production) |
| `07-rejection-risk-review.md` | Simulated Google reviewer pass — every plausible rejection reason and the fix for each |
| `08-support-and-help-center.md` | Help Center structure, FAQ content, Contact Support, Known Issues, Troubleshooting |
| `09-launch-plan.md` | Day -14 → Month 1 |
| `10-production-readiness-audit.md` | Scored audit: UI, UX, Performance, Security, Compliance, Accessibility, Play readiness, overall |

Two code changes were made alongside this package (both small, both fixing real gaps above):
`wealthynest-web/src/app/privacy/page.tsx` (gap #1) and a new `wealthynest-web/src/app/delete-account/page.tsx`
(gap #2). Everything else in this directory is documentation/copy for you to paste into Play Console —
none of it required further app code changes to be accurate.
