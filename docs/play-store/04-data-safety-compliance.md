# Data Safety, Permissions, Financial-App Compliance, Content Rating, Target Audience, Ads, Government Compliance

All answers below are grounded in what the code actually does — cross-check `05-manifest-and-technical-review.md`
for the permission-level evidence and `03-legal-and-policy-pages.md` for the privacy-policy text these
answers must stay consistent with.

## Data Safety form — section by section

### Does your app collect or share any of the required user data types?
**Yes.**

### Is all user data collected by your app encrypted in transit?
**Yes.** `capacitor.config.ts` sets `server.url` to an `https://` origin, `cleartext: false`, and
`android.allowMixedContent: false` — the WebView cannot load or submit anything over plain HTTP.
Backend confirmed running behind HTTPS (AWS EC2 origin in `ap-south-1`, Nginx + Cloudflare
proxied/Full-strict TLS in front, per `docs/architecture-diagram.md` — not a Cloudflare Tunnel, see
the correction in `05-manifest-and-technical-review.md` §4).

### Do you provide a way for users to request that their data be deleted?
**Yes.** In-app (Settings → Profile → Close Account) and via the public web page
`https://wealthynest.in/delete-account` (no login/app-install required to view the process and
request full erasure by email). Use that exact URL in the Data Safety form's account-deletion field.

### Data types collected

| Category | Type | Collected? | Shared? | Purpose | Notes |
|---|---|---|---|---|---|
| Personal info | Name | Yes | No | Account functionality | User-entered at signup |
| Personal info | Email address | Yes | Yes (Google, email provider) | Account functionality, account management | Shared only with Google Sign-In (if used) and the transactional email provider — never for advertising |
| Financial info | User payment info (cards, UPI IDs) | **No** | — | — | Confirmed: app never collects card numbers, UPI credentials, or bank passwords (Privacy Policy §2 explicit exclusion list) |
| Financial info | Purchase history | **No** | — | — | No purchases exist in the app |
| Financial info | Credit score | **No** | — | — | Not collected |
| Financial info | Other financial info | Yes | No | App functionality | User-entered expenses, income, budgets, investments, assets, liabilities, debts — this is the app's core purpose, entirely user-authored, never verified against real bank/brokerage accounts |
| App activity | App interactions | No | — | — | No analytics/telemetry SDK is present in the codebase (verified: no Firebase Analytics, no Mixpanel/Amplitude/Segment dependency) |
| App info and performance | Crash logs | Depends | No | Diagnostics | Only if Play's own built-in Android Vitals/crash reporting is enabled at the OS level — no third-party crash SDK (Crashlytics, Sentry) is integrated in this codebase; answer "No" unless you add one later, and update this form the same day you do |
| Device or other IDs | Device or other IDs | Yes | Yes (Google/Firebase) | App functionality (push notifications) | FCM device push token only, via `@capacitor/push-notifications` — no advertising ID, no device fingerprinting |
| Messages | — | No | — | — | No in-app messaging between users beyond the family expense-split notes and support tickets, neither of which Play's taxonomy treats as "Messages" |

### Data collection is always required (not optional) — is that true here?
**Yes** for account/financial info (the app is non-functional without it); **conditionally yes** for
the FCM device ID (only collected if the user grants notification permission, which is itself an
OS-level opt-in on Android 13+ per `POST_NOTIFICATIONS`).

### Is data collected via secure connection? / Can users request data deletion outside account
deletion? / Committed to Play Families Policy?
Secure connection: **Yes** (see above). Data deletion outside full account closure: **Yes** — Settings
→ Download Data lets a user export, and closing the account followed by an erasure email deletes the
underlying rows (see `delete-account` page's retention table). Families Policy: **N/A** — target
audience is 18+ only (see below), app is not directed at children.

## Permissions explanation (for the Play Console "why does your app need this" prompts, and for your
own record of what's actually declared)

Per the full merged-manifest audit in `05-manifest-and-technical-review.md`, every permission present
is auto-merged from a real, in-use library — none are hand-added, none are unused:

| Permission | Source | Why it's needed |
|---|---|---|
| `INTERNET` | Hand-declared (`AndroidManifest.xml`) | The WebView loads `https://wealthynest.in` — required for the app to function at all |
| `ACCESS_NETWORK_STATE` | Firebase Messaging library | FCM uses this to detect connectivity changes and retry delivery |
| `POST_NOTIFICATIONS` | Firebase Messaging library (targets API 33+ behavior) | Required at runtime (Android 13+) before any push notification can be shown — the user sees an explicit OS permission dialog; this is not silently granted |
| `WAKE_LOCK` | Firebase Messaging library | Needed briefly by Google Play services to fetch an Instance ID token for push registration |
| `com.google.android.c2dm.permission.RECEIVE` | Firebase Messaging library | Standard permission every FCM-integrated app declares, needed to receive the actual push message broadcast |
| `USE_BIOMETRIC` / `USE_FINGERPRINT` | `@aparajita/capacitor-biometric-auth` (androidx.biometric) | Powers the native fingerprint/face unlock for PIN-only accounts (`nativeBiometric.ts`) — both are "normal" protection-level permissions, granted automatically at install, no runtime prompt beyond the biometric enrollment prompt itself |
| `in.wealthynest.app.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` | AndroidX (signature-level, auto-generated) | Internal AndroidX broadcast-receiver protection, not user-facing, not something you declare or explain in a store listing |

**No permission is requested that isn't tied to a real, already-shipped feature.** There is nothing to
prune here — this is one of the cleanest parts of the release.

## Financial-app compliance

Play Console's "Financial features" declaration (under App content → Financial features):
- **Personal loans**: No — the app has a debt/lending *tracker* (records loans between family members
  or informal lending you report yourself); it does not originate, underwrite, or service any loan.
  Answer **"None of the above"** on this section, but be ready to explain the Debt tracker feature in
  a reviewer note if asked — the wording matters (it tracks money owed, it does not lend money).
- **Cryptocurrency**: No — not a supported asset type.
- **Buy Now, Pay Later / Crypto exchange / Government ID/ Provident fund management on behalf of the
  user**: No to all — WealthyNest never touches real money movement; it's a read/write ledger the
  user maintains themselves.
- **Consequence of answering correctly**: none of Play's enhanced financial-app review requirements
  (extra developer verification, LSP/lending-license proof) apply, since this is a personal-finance
  tracker, not a lending or payments product. Answering the Financial Features section inaccurately
  (e.g. leaving it blank) is a more common rejection trigger for Finance-category apps than anything
  content-related — fill it out explicitly even though every answer is "no."

## Content rating (IARC questionnaire)

Expected outcome given the actual app content: no violence, no sexual content, no gambling, no
user-generated public content (family expense splitting and support tickets are private,
family/support-scoped, not public UGC), no alcohol/drugs/profanity references — this should rate at
the lowest tier on every regional system (ESRB Everyone / PEGI 3 / USK 0, etc.).

Answer the "does your app simulate gambling" question **No** — the debt tracker and investment
tracking are real personal-finance record-keeping, not simulated wagering, and this distinction is
exactly what the IARC questionnaire is designed to separate.

## Target audience and content

- **Target age group**: 18 and over only. This is a **business/legal restriction** (Terms §3: "You
  must be at least 18 years old to create an account"), separate from the IARC content rating itself —
  Play Console asks both, and they can legitimately differ (content is all-ages-safe, but the service
  itself is contractually adults-only because it's financial software).
- **Do not** select any child-directed age bucket (under-13 or 13-15) even though nothing in the app
  is objectionable to a minor — selecting a child-audience bucket triggers Play Families Policy
  requirements (COPPA-equivalent handling, ad/tracking restrictions specific to that program) which
  add compliance burden and are simply the wrong bucket for an 18+-gated financial product.
- **Store listing "Made for Families"**: leave off/unchecked.

## Ads declaration

**No ads.** Confirmed in code and copy — Terms §2 explicitly states "provided free of charge and
without advertisements," and no ad SDK (AdMob, Meta Audience Network, etc.) exists in
`wealthynest-web`'s dependencies or the Android project's `build.gradle`. Answer **"No, my app does not
contain ads"** — this is a clean, verifiable answer, not a judgment call.

## Government / India compliance checklist

- [ ] **Digital Personal Data Protection Act, 2023 (DPDP Act)** — India's data-protection law is now in
      force; the Privacy Policy's IT Act 2000 reference (§10) predates it. Recommend adding an explicit
      DPDP Act reference alongside the existing IT Act clause before a wide public launch — this is a
      legal-review item, not something to guess the exact wording of here.
- [ ] **RBI / NBFC applicability** — confirmed **not applicable**: the app doesn't lend, hold deposits,
      facilitate payments, or act as a payment aggregator, so it falls outside RBI's NBFC/PA regulatory
      perimeter. Keep it that way — don't add real money-movement features without re-checking this.
- [ ] **SEBI (investment advice) applicability** — confirmed **not applicable** as long as the app only
      tracks user-entered investment data and never issues buy/sell recommendations. The Disclaimer
      page (`03-legal-and-policy-pages.md` §3) exists specifically to keep this boundary explicit and
      visible to users.
- [ ] **Consumer Protection (E-Commerce) Rules** — not applicable, no e-commerce transactions occur in
      the app.
- [ ] **Google Play's own India-specific policies** (e.g. the Personal Loan apps policy) — not
      applicable per the Financial Features answers above.
- [ ] **GST / business registration for the developer account** — a Play Developer account can be
      individual or organizational; if registering as an organization for a India-based finance
      product, confirm business registration docs are ready before starting Play's identity
      verification (this can otherwise be the single slowest step in first-time publishing, often
      taking days, independent of app review itself).
