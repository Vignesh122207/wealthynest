# WealthyNest — Android App Roadmap

## Decision: Capacitor (server mode), not a TWA

WealthyNest was originally packaged as a **Trusted Web Activity** (Bubblewrap-generated Chrome
shell). That project has been removed (its signing keystore was carried forward first — see
below); this history is recoverable from git if ever needed. The app is now packaged with
**[Capacitor](https://capacitorjs.com/)**, generated at `wealthynest-web/android`,
for three things a TWA can't give: a native biometric unlock path (`BiometricPrompt`, not just
Chrome's WebAuthn UI), first-party Capacitor plugin access for future native-only features, and a
foundation that supports offline app-shell behavior without depending on Chrome specifically being
the installed browser.

**This deliberately keeps the TWA's core trade-off intact rather than trading it away:**

- **Server mode, not a bundled build.** `capacitor.config.ts`'s `server.url` points at
  `https://wealthynest.in` — the native `WebView` loads the live site, exactly like the TWA did.
  `docker compose up -d --build wealthynest-web` remains the entire Android update story; there is
  no separate Play Store submission for ordinary feature/UI work. The alternative (bundling the
  `next build` output into the APK) would give true offline data access, but costs a Play review
  cycle per UI change — rejected for the same reason the TWA roadmap rejected a native rewrite:
  not justified without a hard requirement for it.
- **Offline stays shell-only.** `public/sw.js`'s decision not to cache API responses or
  financial data is unchanged and still applies inside the Capacitor WebView — see that file's own
  comment for why ("a finance app silently showing yesterday's balance while offline is worse than
  no offline support"). Capacitor's contribution here is a more resilient native shell (app icon,
  splash screen, no dependency on Chrome specifically), not a change to what data is available
  offline.
- **WebAuthn/passkeys are unchanged.** `WebAuthnConfig.getRpId()` is still bound to
  `wealthynest.in`; `androidScheme: "https"` in `capacitor.config.ts` keeps the WebView's origin
  matching that. A registered passkey still triggers Android's own fingerprint/face UI via
  Credential Manager — nothing new was built for passkey users.

## What's new: native biometric unlock for PIN-only accounts

Passkey accounts already get a native fingerprint prompt for free via WebAuthn — layering a
second, separate `BiometricPrompt` plugin in front of that would double-prompt them. So the new
native biometric path is scoped specifically to **PIN-only accounts** (`useNativeBiometric.ts`,
`nativeBiometric.ts`, wired into `settings/security/page.tsx`'s `BiometricPinToggle` and
`AppLockScreen`):

- `@aparajita/capacitor-biometric-auth` gates access to `capacitor-secure-storage-plugin`
  (Android Keystore-backed), which holds a copy of the PIN.
- A successful fingerprint check retrieves that PIN and submits it through the *same*
  server-verified `pinLogin` call a typed PIN uses — biometric success proves "this device," not
  "this account"; the server still has the final say, same as today's typed-PIN flow.
- Disabling PIN unlock also clears the securely-stored copy (`useDisablePin`), so nothing orphaned
  is left behind.
- Not available on web/desktop or inside a plain browser tab — `Capacitor.isNativePlatform()`
  gates all of it.

## Project layout

- `wealthynest-web/android` — the live Capacitor Android project (Gradle project, generated via
  `npx cap add android`, kept in source control like any other native project).
- `wealthynest-web/capacitor.config.ts` — `appId: in.wealthynest.app` (same identity the TWA
  used), `appName: WealthyNest`, server-mode URL, `androidScheme: https`.
- `wealthynest-web/android/keystore.properties.example` → copy to `keystore.properties`
  (git-ignored, never commit it) to build a signed release. Points at
  `wealthynest-web/android/keystore/wealthynest-release.jks` — the **same signing keystore** the
  TWA used, so this stays the same app identity if it's ever submitted to Play under that key.
  Back this keystore up somewhere durable outside git; losing it means losing the ability to ever
  update the Play Store listing.

## Known gap: push notifications need re-verifying

The TWA's notification path (`DelegationService`, Chrome's Trusted Web Activity notification
delegation) doesn't carry over to Capacitor — a WebView is not Chrome, and Web Push support inside
`android.webkit.WebView` is version-dependent and not guaranteed the way it is in a real Chrome
Custom Tab. If push notifications are needed, the correct fix is `@capacitor/push-notifications` +
Firebase Cloud Messaging (a real native plugin, not relying on the WebView's own Push API) — not
yet implemented. Treat this as unverified/likely-broken until tested on a real device, not
something this migration already solved.

## Phase 1 — Build & sign, verify on a real device

Nothing here can be verified in a sandboxed CI-style environment (no Android SDK/emulator
available where this was scaffolded) — do this locally in Android Studio or via `gradlew`:

- [ ] `cd wealthynest-web && npx cap sync android` after any dependency change.
- [ ] Copy `android/keystore.properties.example` → `android/keystore.properties`, fill in the
      real password (same one in `android/keystore/keystore.env`).
- [ ] `cd android && ./gradlew assembleRelease` (or open in Android Studio) — confirm it builds
      and installs on a real device or emulator.
- [ ] Confirm the app loads `https://wealthynest.in` full-screen with no browser chrome, and that
      the launcher icon/splash screen (regenerated via `npx @capacitor/assets generate --android`
      from `public/icons/icon-512.png`) look right.
- [ ] Manually verify the passkey unlock flow surfaces Android's native fingerprint/face UI
      correctly inside the Capacitor WebView — the existing
      `tests/regression/webauthn.spec.ts`/`app-lock.spec.ts` Playwright coverage only exercises
      this via a CDP virtual authenticator on desktop Chromium, not a real Android device.
- [ ] Manually verify the new PIN + fingerprint flow end-to-end: enable PIN unlock → enable
      fingerprint unlock in Settings → background the app → confirm the fingerprint button appears
      on `AppLockScreen` and successfully unlocks.

## Phase 2 — Play Store listing prep

Unchanged from the TWA plan — standalone from engineering, needs product/content decisions:

- [ ] Google Play Developer account (one-time $25 fee).
- [ ] Privacy Policy + Terms of Service pages.
- [ ] Play's Data Safety form — declare exactly what's collected (email, financial data entered by
      the user, no ad tracking).
- [ ] Screenshots/feature graphic — the existing Playwright visual-regression suite
      (`playwright/tests/visual/`) is a good starting point.
- [ ] Content rating questionnaire.

## Phase 3 — Testing before release

- [ ] Play Console's Internal testing track first, with a handful of real accounts.
- [ ] Real-device pass across a couple of screen sizes/Android versions.
- [ ] Confirm the rate-limiter fix (trusts `CF-Connecting-IP` behind the Cloudflare Tunnel) holds
      up with more than one concurrent real device hitting the API.

## Phase 4 — Release + ongoing

- [ ] Closed → Open testing track → Production rollout (staged percentage, not 100% on day one).
- [ ] Decide who monitors Play Console's crash/ANR reports post-launch.
- [ ] App updates are still just redeploying the website
      (`docker compose up -d --build wealthynest-web`) for anything that doesn't touch native
      Capacitor plugin code or `AndroidManifest.xml` — the same "ship to web = ship to Android"
      property the TWA had. A new Play submission is only needed when the native project itself
      changes (new plugin, permission, manifest entry).

## Open decisions (need your input, not further research)

- **Play Developer account owner** — personal vs. a dedicated organization account.
- **Launch scope** — family/invite-only soft launch via Internal/Closed testing first, or straight
  to Production. Given the app handles real financial data, a longer closed-testing window is the
  safer default.
- **Push notifications** — worth the FCM setup cost, or defer indefinitely given the app doesn't
  have one today even on web.

## Known infra ceiling (worth knowing, not a blocker)

The whole stack is self-hosted via a single Docker Compose host behind one Cloudflare Tunnel —
fine for family/small-scale usage, but it's a single point of failure and won't horizontally scale
past one machine. Not something Android packaging needs solved, but worth knowing before any wider
public push.
