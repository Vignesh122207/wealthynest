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

## Push notifications (implemented, needs on-device verification)

The TWA's notification path (`DelegationService`, Chrome's Trusted Web Activity notification
delegation) didn't carry over to Capacitor — a WebView is not Chrome, and Web Push support inside
`android.webkit.WebView` is version-dependent and not guaranteed the way it is in a real Chrome
Custom Tab. Implemented with `@capacitor/push-notifications` + Firebase Cloud Messaging (a real
native plugin, not the WebView's own Push API):

- **Backend**: `device_tokens` table (`V48__device_tokens.sql`), `FcmPushNotificationSender`
  (`domain/notification/service/`) sends via the Firebase Admin SDK and self-heals by deleting a
  token on an `UNREGISTERED`/`INVALID_ARGUMENT` response. Wired into the same 5 alert types that
  already create in-app notifications (`NotificationServiceImpl`'s `create*Notification` methods)
  — push follows the exact same per-type preference toggles and once-per-day dedup, no separate
  push-specific settings. Opt-in infra: `FCM_SERVICE_ACCOUNT_JSON` unset means push is silently a
  no-op (app still starts fine), same fail-closed treatment as the native Google OAuth client id.
- **Frontend**: `features/notifications/utils/nativePush.ts` + `hooks/useNativePush.ts` request
  permission and register the FCM token once per authenticated session (`(dashboard)/layout.tsx`,
  same spot as `<NativeSplashReady />`); `useLogout()` best-effort unregisters the token. Tapping a
  notification opens `/notifications`, same destination as the Header bell.
- **Android project**: `google-services` Gradle plugin was already wired up in `build.gradle` /
  `app/build.gradle` (applies conditionally only if `google-services.json` is present — safe when
  it isn't, e.g. this repo before the file is dropped in). `npx cap sync android` registered the
  plugin; `AndroidManifest.xml` got the default notification icon/color `meta-data` entries.

**Setup required before this actually works** (can't be done from this repo alone):
1. Create a Firebase project, add an Android app with package name `in.wealthynest.app`.
2. Download `google-services.json` → `wealthynest-web/android/app/google-services.json`
   (git-ignored, never commit it — same treatment as `keystore.properties`).
3. Generate a service-account key (Firebase Console → Project Settings → Service Accounts →
   Generate new private key), base64-encode it, set as `FCM_SERVICE_ACCOUNT_JSON` in `.env`.
4. `npx cap sync android`, rebuild, install on a real device — see the Phase 1 checklist below.

Treat on-device push delivery as unverified until tested for real — nothing about it can be
checked from this sandboxed environment.

## Phase 1 — Build & sign, verify on a real device

Nothing here can be verified in a sandboxed CI-style environment (no Android SDK/emulator
available where this was scaffolded) — do this locally in Android Studio or via `gradlew`:

- [ ] `cd wealthynest-web && npx cap sync android` after any dependency change.
- [ ] Copy `android/keystore.properties.example` → `android/keystore.properties`, fill in the
      real password (same one in `android/keystore/keystore.env`).
- [ ] `cd android && ./gradlew assembleRelease` (or open in Android Studio) — confirm it builds
      and installs on a real device or emulator.
- [ ] Confirm the app loads full-screen with no browser chrome, and that the launcher icon looks
      sharp (not blurry) at every density.
      **Important**: any device testing done against a previously-installed APK is testing a stale
      build — `server.url` pointing at `/home`, the native Google button, and the icon fix below
      all require a fresh `./gradlew assembleRelease` (or reinstall from Android Studio) to actually
      reach the device. The bundled `capacitor.config.json`/resources are baked into the APK at
      build time, not fetched live.
- [ ] The launcher icon was blurry because the adaptive-icon foreground/background layers
      (`mipmap-*/ic_launcher_foreground.png`/`ic_launcher_background.png`) were generated at the
      *legacy* launcher-icon sizes (48–192px) instead of the larger sizes adaptive icons actually
      need (108–432px, since the OS composites them from a bigger 108dp canvas) — every density
      was silently upscaling a too-small image ~2.25x. Regenerated at the correct sizes from
      `public/icons/icon-512.png`; confirm on-device that the launcher icon is crisp, especially on
      a high-density (xxxhdpi) screen where the old bug was most visible.
- [ ] Manually verify the passkey unlock flow surfaces Android's native fingerprint/face UI
      correctly inside the Capacitor WebView — the existing
      `tests/regression/webauthn.spec.ts`/`app-lock.spec.ts` Playwright coverage only exercises
      this via a CDP virtual authenticator on desktop Chromium, not a real Android device.
- [ ] Manually verify the new PIN + fingerprint flow end-to-end: enable PIN unlock → enable
      fingerprint unlock in Settings → background the app → confirm the fingerprint button appears
      on `AppLockScreen` and successfully unlocks.
- [ ] Confirm the app opens straight to `/home` (or `/login` if signed out) — no flash of the
      marketing landing page — since `capacitor.config.ts`'s `server.url` now points there instead
      of `/`.
- [ ] Confirm the status bar and nav bar areas match the app's own background (light and dark) with
      no mismatched-color strip top or bottom — `colors.xml`/`values-night/colors.xml`,
      `AppTheme.NoActionBar`'s `windowBackground`, and `nativeStatusBar.ts`'s
      `StatusBar.setOverlaysWebView` are all new and unverified outside a real device.
- [ ] From Home (native, signed in, no PIN/fingerprint configured), confirm the new "Secure this
      device" prompt appears with PIN enabled and fingerprint visibly locked until PIN is set up,
      and that dismissing it or finishing both setup steps makes it stop reappearing.
- [ ] Confirm fingerprint fires automatically on `AppLockScreen` (no tap needed) when both PIN and
      fingerprint are enabled, with "Use PIN instead" as a working fallback if the prompt is
      cancelled or fails. The screen itself was redesigned to drop the "Welcome back, {name}" text
      (icon + blurred background only, matching how other apps treat this exact moment) and adds
      "Use password instead" as a real fallback option, not just a small "sign out" link.
- [ ] Confirm the mobile "More" nav overlay (Sidebar.tsx) no longer overlaps the status bar
      icons (clock/battery/wifi) when opened, and that the FAB no longer overlaps MobileNav's
      "More" button on devices with a large gesture-nav inset — both were missing
      `env(safe-area-inset-*)` padding, only caught once edge-to-edge was actually tested on a
      real device rather than a browser dev-tools device emulation.
- [ ] Confirm scrolling any dashboard page keeps Header pinned at the top instead of scrolling it
      away — a body-level `padding-top: env(safe-area-inset-top)` added earlier made `body` taller
      than one viewport, which broke Header's "not actually inside a scroll container" layout.
      Reverted in favor of padding the `(auth)` and `(dashboard)` layout roots individually instead.
- [ ] Native Google sign-in (`GoogleSignInButton.tsx`'s native branch, via
      `@capacitor-community/generic-oauth2`) needs, before it can work at all:
      1. A **new "Desktop app"-type OAuth 2.0 Client ID** in Google Cloud Console (same project as
         the existing Web client) — Google only allows custom-URI-scheme redirects on that client
         type, so the existing `GOOGLE_CLIENT_ID` (Web) can't be reused here.
      2. Its authorized redirect URI set to `in.wealthynest.app://oauth2redirect`, matching
         `app/build.gradle`'s `appAuthRedirectScheme` manifest placeholder and
         `GoogleSignInButton.tsx`'s `NATIVE_REDIRECT_URL` exactly. (No hand-written intent-filter
         for this in `AndroidManifest.xml` — the redirect-catching activity is contributed by
         `net.openid:appauth`, a transitive dependency of `generic-oauth2`; the placeholder is what
         wires our actual scheme into that library-provided activity.)
      3. That client ID set as `GOOGLE_NATIVE_CLIENT_ID` in `.env` (wired through
         `docker-compose.yml` → `Dockerfile` → `NEXT_PUBLIC_GOOGLE_NATIVE_CLIENT_ID`).
      Until all three are done the native Google button stays hidden (same fail-closed pattern the
      web button already uses when `GOOGLE_CLIENT_ID` is unset). Once configured, verify on a real
      device: tapping it opens a Custom Tab (not the embedded WebView), completes sign-in, and
      returns to the app signed in.
- [ ] Push notifications — after completing the Firebase setup steps above and rebuilding: confirm
      the OS permission prompt appears on first authenticated launch; trigger a real alert (e.g.
      drop a wallet account below its low-balance threshold) and confirm a notification arrives
      both foregrounded and backgrounded; confirm tapping it opens the app to `/notifications`;
      confirm the default notification icon/color don't render as a blank/wrong-color blob in the
      status bar (the `meta-data` entries reuse the launcher icon directly rather than a dedicated
      white/silhouette notification icon — may need a proper one if it looks wrong); confirm
      turning a per-type toggle off in Settings → Notifications actually stops that type's push,
      not just its in-app row.

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
- ~~**Push notifications** — worth the FCM setup cost, or defer indefinitely given the app doesn't
  have one today even on web.~~ Decided: implemented (see "Push notifications" section above) — the
  only remaining decision is *when* to actually create the Firebase project and drop in
  credentials, which is on you.

## Known infra ceiling (worth knowing, not a blocker)

The whole stack is self-hosted via a single Docker Compose host behind one Cloudflare Tunnel —
fine for family/small-scale usage, but it's a single point of failure and won't horizontally scale
past one machine. Not something Android packaging needs solved, but worth knowing before any wider
public push.
