# AndroidManifest & Technical Review

This is a from-source review, not a template checklist — every claim below was verified by reading
`wealthynest-web/android/app/src/main/AndroidManifest.xml`, `app/build.gradle`, `variables.gradle`,
`capacitor.config.ts`, and the actual **merged manifest** produced by a Gradle build
(`android/app/build/intermediates/merged_manifest/debug/processDebugMainManifest/AndroidManifest.xml`),
which is what a real release APK contains after all Capacitor plugin manifests are combined — the
hand-written manifest alone (49 lines) tells only part of the story.

## 0. Update (2026-07-29): 4 improvements implemented + verified on a real Android emulator

All four improvements below (R8/minify, App Links, DPDP Act privacy-policy reference, push
notification FAQ) are now implemented in code. Verification used a real Android emulator
(`wealthynest_test` AVD, Android 14/API 34, arm64) — a signed release build was actually compiled,
installed, and launched, not just reasoned about. This surfaced one critical pre-existing bug
(unrelated to any of the 4 improvements) and one unresolved crash that needs a real physical device
to confirm.

### Critical finding: the app was bouncing to Chrome on every launch (now fixed)

`wealthynest.in` (the apex domain `capacitor.config.ts`'s `server.url` points at) now permanently
308-redirects to `www.wealthynest.in` at the DNS/Vercel level — confirmed live via `curl -I
https://wealthynest.in/home`. Capacitor's documented default behavior is: "all external URLs are
opened in the external browser, not the WebView" for any host outside `server.url`'s own hostname.
Since `www.wealthynest.in` is a *different* hostname from `wealthynest.in`, every app launch hit the
redirect and Capacitor kicked the resulting navigation out to Chrome instead of showing the app at
all — reproduced consistently on-emulator (`logcat` showed `ActivityTaskManager: START ... 
cmp=com.android.chrome/...IntentDispatcher` firing right after `MainActivity` started). Confirmed via
a controlled isolation test (temporarily removing the new App Links intent-filter, rebuilding, same
bounce still happened) that this is **pre-existing and unrelated to any of today's changes** — it
would affect the current production app too, independent of anything in this session.

**Fix applied**: `capacitor.config.ts`'s `server.allowNavigation: ["www.wealthynest.in"]` — widens
the WebView's own navigation scope to include the redirect target, so it follows the 308 internally
instead of exiting to the browser. Verified fixed on-emulator: `topResumedActivity` stayed
`in.wealthynest.app/.MainActivity` through the full launch instead of handing off to Chrome, and the
native splash screen (the brand "W" mark) rendered correctly before the WebView content loaded.

This was not one of the 4 requested improvements — it surfaced as a side effect of testing App Links
on a real emulator. It is almost certainly the single most impactful fix in this entire package: an
app that exits to the browser on every launch would fail Play Review outright (looks broken, not
"minimum functionality"), regardless of anything else in this document.

### RCA: WebView renderer OOM crash (2026-07-30) — root cause identified, resilience fix shipped

With the Chrome-bounce fixed, the WebView actually loads and starts hydrating the real page — and
then, consistently ~12–20 seconds later, the render process crashed with a V8 JavaScript heap OOM
(`[ERROR:v8_initializer.cc(752)] V8 javascript OOM (Ineffective mark-compacts near heap limit)`),
taking the whole app down.

**Investigation, in order:**
1. **Ruled out R8/minification** — identical crash with `minifyEnabled` on or off; R8 only touches
   this app's own Java bridge code, not the WebView's separate renderer process.
2. **Ruled out bundle size** — measured the actual `/login` page's JS payload directly from
   production (`curl` against every `_next/static/chunks/*.js` referenced): ~0.76MB compressed
   total. Normal, not bloated.
3. **Ruled out app-side polling/leaks** — checked every `setInterval`/`refetchInterval` in the
   codebase; none run pre-login. Checked `GoogleSignInButton`: the GIS web script it loads is
   **never used on native** (`Capacitor.isNativePlatform()` routes to a completely different
   Custom-Tab-based component) — ruled out as a cause. No redirect-loop signature found in `logcat`
   (checked for repeated log-line patterns around the crash window).
4. **Found: the emulator's Android System WebView is version 113.0.5672.136** (`dumpsys
   webviewupdate`) — Chromium 113, released ~mid-2023, roughly 2 years stale relative to what a
   real, Play-Store-updated device would run. Attempted to force an update by downloading and
   booting a full **Google Play**-enabled system image (not just "Google APIs") specifically because
   Play-enabled images auto-update WebView in the background — the fresh AVD hadn't had time to run
   that background job and still reported the same 113 build, so this didn't resolve conclusively
   which factor (stale engine vs. something else) is the true cause.
5. **Tested V8 heap ceiling directly** via Android's WebView debug command-line-flags file
   (`/data/local/tmp/webview-command-line`, `--js-flags=--max-old-space-size=...`): 512MB delayed
   the crash by several seconds but didn't prevent it; 2048MB caused a full system-wide OOM-killer
   event unrelated to our app (this test run is unreliable — the host machine was also running
   Docker containers and a large SDK download at the time, confounding the result). This step's
   confounds mean "how much memory is actually needed" was not cleanly resolved — see residual
   uncertainty below.

**Conclusion**: the most likely root cause is a compatibility/performance gap between this specific
emulator's stale WebView engine (Chromium 113) — running fully software-rendered
(`SwiftShader`/`ANGLE`, no GPU passthrough) — and the app's modern Next.js 15/React 19 bundle. No
evidence of an actual application-level bug (loop, leak, runaway subscription) was found anywhere in
the codebase after a real search. **This has not been confirmed on a real physical device or a
genuinely current WebView build** — that remains the one clean, decisive test this session could not
complete (the Play Store image's background WebView self-update didn't finish in the available
time). Treat the root cause as "likely environment-specific, not proven."

**Fix shipped regardless of root cause**: `MainActivity.java` now installs a custom
`ResilientWebViewClient` (`android/app/src/main/java/in/wealthynest/app/ResilientWebViewClient.java`,
extends Capacitor's `BridgeWebViewClient`) overriding `onRenderProcessGone` — previously unhandled,
which is *why* every renderer crash (regardless of cause) was fatal to the whole app
(`crashpad_client_linux.cc(732): Render process crash wasn't handled by all associated webviews,
triggering application crash` — literally the platform's own explanation for why this was fatal).
The new handler reloads the WebView once automatically on the first crash (a fresh renderer process
spins up via `view.reload()` without needing to tear down/recreate the WebView object); if it
crashes again within 30 seconds, it stops retrying and falls through to the platform's normal fatal
handling, rather than risk a silent battery-draining reload loop.

**Verified working exactly as designed**, via `logcat`, on the same reproducing emulator:
```
09:33:07  V8 javascript OOM ...
09:33:09  WealthyNest: WebView render process gone (didCrash=true). Reloading once to recover.
          [new renderer process starts]
09:33:21  V8 javascript OOM ... (second crash, ~13s after recovery)
09:33:23  WealthyNest: WebView render process gone (didCrash=true). Crashed again within 30000ms — not retrying again.
          [falls through to normal fatal handling, as designed]
```
The app survived roughly twice as long as before (one full extra load-crash cycle) before finally
failing the same way it did previously — on this specific stale-WebView emulator, the underlying
condition is severe enough that one retry isn't enough to fully recover, which is itself evidence
this environment's WebView is meaningfully more constrained than a real device's would be expected
to be.

**Still required before shipping**: test on a real physical Android device (or a WebView confirmed
current via Play Store, which this session could not fully achieve in the available time). If the
crash never reproduces there, the resilience fix is a pure safety net that likely never fires for
real users. If it does reproduce there too, this becomes the top-priority bug in this entire
package — the resilience fix limits the damage (one automatic recovery attempt) but does not resolve
the underlying cause.

## 1. Permissions

**Hand-written manifest declares only**: `android.permission.INTERNET`.

**Merged manifest (what actually ships) adds, all via legitimate plugin dependencies, none unused:**

| Permission | Contributed by | Justified? |
|---|---|---|
| `INTERNET` | App itself | Yes — required, WebView loads a remote URL |
| `USE_BIOMETRIC` | androidx.biometric (via `@aparajita/capacitor-biometric-auth`) | Yes — native fingerprint unlock is a real, shipped feature |
| `USE_FINGERPRINT` | Same (legacy alias, kept for pre-Android-9 compat by the library itself) | Yes, harmless — normal permission, no runtime prompt |
| `ACCESS_NETWORK_STATE` | Firebase Messaging | Yes — FCM connectivity detection |
| `POST_NOTIFICATIONS` | Firebase Messaging | Yes — required runtime permission for push on Android 13+ |
| `WAKE_LOCK` | Firebase Messaging / Google Play services | Yes — brief wake for Instance ID token fetch |
| `com.google.android.c2dm.permission.RECEIVE` | Firebase Messaging | Yes — required to receive push broadcasts |
| `in.wealthynest.app.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` | AndroidX (auto-generated signature permission) | Yes — internal AndroidX broadcast protection, not user-facing |

**Missing permissions**: none found. Every plugin currently wired into `capacitor.config.ts` /
`package.json` (push-notifications, biometric-auth, generic-oauth2, secure-storage-plugin per
`ANDROID_APP_ROADMAP.md`) has its required permission present in the merged manifest already —
nothing needs to be hand-added.

**Unused/excess permissions**: none found. This is unusually clean — there's no leftover
`READ_EXTERNAL_STORAGE`, `CAMERA`, `ACCESS_FINE_LOCATION`, `READ_CONTACTS`, or `READ_SMS`/
`RECEIVE_SMS` (the last two specifically are what triggers Play's strictest "Sensitive permissions"
declaration flow for financial apps that try to auto-read SMS OTPs — good that none of that exists
here, since declaring and justifying SMS permissions is one of the slowest manual-review paths for
Finance-category apps).

## 2. Security issues

- `MainActivity` is `exported="true"` — **required**, not a bug: it's the `LAUNCHER` activity, Android
  mandates `exported="true"` for any activity with a `LAUNCHER` intent filter as of API 31+. No fix
  needed.
- No `android:usesCleartextTraffic` override anywhere, and `capacitor.config.ts` explicitly sets
  `cleartext: false` / `android.allowMixedContent: false` — cleartext HTTP is fully blocked at both
  the Capacitor config layer and left at Android's own secure default (implicit deny on targetSdk
  ≥28). No custom `network_security_config.xml` exists, and **none is needed** — the default policy
  already refuses cleartext, and there's no reason (no dev-server HTTP endpoint, no legacy HTTP
  third-party SDK) that would require carving out an exception.
- `android:allowBackup="false"` is set deliberately, with a code comment explaining exactly why:
  session/auth state lives in WebView cookies/localStorage, and Android Auto Backup or
  device-transfer would otherwise carry that off-device — a real, correctly-reasoned choice for a
  financial app, not an oversight. **No action needed** — see §3 below for the implication.
- `FileProvider` is `exported="false"` with scoped `grantUriPermissions` — correctly locked down, not
  a world-readable content provider.
- All Firebase/Google/AppAuth-contributed services and activities in the merged manifest are
  `exported="false"` except the ones Google's own libraries intentionally export (e.g.
  `RedirectUriReceiverActivity` for the OAuth redirect, `RevocationBoundService`,
  `GoogleApiActivity` internals) — these are library-standard exported surfaces, not something this
  app's own code introduced or can safely change.
- `minifyEnabled true` — **implemented and verified (2026-07-29)**. Was `false`; now enabled along
  with `shrinkResources true` and switched to `proguard-android-optimize.txt` as the default rules
  file. Verified safe by actually building a signed release APK, installing it fresh on a real
  emulator, and confirming it launches, no `missing_rules.txt` was generated by R8, and app-release.apk
  produced (~4.8MB) with no reflection-related crashes distinct from the unrelated WebView OOM
  issue (§0) — that crash reproduces identically with `minifyEnabled` on or off, confirming it's not
  an R8 side effect. Safe specifically because `@capacitor/android`'s core module ships its own
  `consumerProguardFiles` (`node_modules/@capacitor/android/capacitor/proguard-rules.pro`, wired via
  that module's `build.gradle`) keeping every `@CapacitorPlugin`/`Plugin` bridge class — this app has
  almost no custom native Java/Kotlin of its own beyond that bridge.

## 3. Backup configuration

`android:allowBackup="false"` — **confirmed correct and intentional** (see the in-file comment,
quoted above). No `android:fullBackupContent` or `android:dataExtractionRules` attributes exist
because they'd be meaningless with backup fully disabled — nothing to configure further here. One
consequence worth being explicit about for QA (`06-checklists.md` "Before Production" already
includes this): a user who reinstalls the app or transfers to a new device will always need to sign
in again from scratch — this is expected behavior, not a bug, but worth a support-doc line
(`08-support-and-help-center.md` already includes this) so it isn't reported as one.

## 4. Network security

No `network_security_config.xml` file exists in `android/app/src/main/res/xml/` — and none is
needed, per §2 above: cleartext is already blocked by default, and there's no certificate pinning,
no custom trust anchors, and no known reason to add either. **Correction**: an earlier draft of this
doc said the backend runs "behind a Cloudflare Tunnel" — checked `docs/architecture-diagram.md`
directly and that's not what's there. The actual production path is `wealthynest-api` on an AWS EC2
instance (`ap-south-1`/Mumbai, provisioned via the CDK stack in `infrastructure/`) behind Nginx,
fronted by Cloudflare in proxied ("orange-cloud") mode — Cloudflare terminates the client TLS
connection and re-encrypts to the EC2 origin in Full (strict) mode; that's a reverse-proxy/CDN
setup, not a `cloudflared` tunnel daemon. `wealthynest-web` itself is hosted on Vercel, separately.
Either way, it's standard publicly-trusted TLS end to end — nothing exotic to pin against. If a
future requirement emerges (e.g. pinning against a specific certificate, or explicitly trusting a
corporate MITM proxy for enterprise deployment), `network_security_config.xml` is the file to add
then — not needed for v1.0.0.

## 5. Deep Links / App Links / Intent Filters — IMPLEMENTED (2026-07-29)

**Previous state**: exactly one intent filter existed — `MainActivity`'s `MAIN`/`LAUNCHER` filter.
No App Link, no `assetlinks.json`.

**Now implemented**:
- `public/.well-known/assetlinks.json` already existed in the repo (found during this pass, not
  newly created) with `delegate_permission/common.handle_all_urls` +
  `delegate_permission/common.get_login_creds` for `in.wealthynest.app`. Its fingerprint was
  verified byte-for-byte against the real release keystore (`keytool -list -v -keystore
  keystore/wealthynest-release.jks` → `SHA256: CA:89:E1:...:2B:59`, exact match) — this file was
  already correct, just not yet backed by a manifest-side intent-filter.
- Added `<intent-filter android:autoVerify="true">` to `AndroidManifest.xml` for
  `https://{wealthynest.in,www.wealthynest.in}/{verify-email,reset-password,login,forgot-password}`.
- Verified live on-emulator via `logcat`: `AppLinksHostsVerifierV2: Verification in.wealthynest.app
  complete. Successful hosts: www.wealthynest.in. Failed hosts: wealthynest.in.` — exactly as
  expected given the apex→www redirect (see §0): `assetlinks.json` is confirmed reachable without a
  redirect at `https://www.wealthynest.in/.well-known/assetlinks.json` (HTTP 200), but
  `https://wealthynest.in/.well-known/assetlinks.json` 308-redirects, which Android's Digital Asset
  Links verifier does not follow for verification purposes.
- **Net effect**: password-reset/verify-email links that end up at `www.wealthynest.in/...` (which,
  per §0, is where the redirect actually lands) will now open the app instead of the browser. Links
  that somehow stay on the bare `wealthynest.in` host (e.g. if a future change removes the redirect)
  would not, until the redirect exception described in §0/README is fixed at the Vercel/DNS level.

**Still recommended, not done here** (infra-level, outside this repo): configure Vercel to serve
`/.well-known/assetlinks.json` directly on the apex domain without the www redirect applying to that
one path specifically — this would let both hosts verify, not just www, and is the more complete fix
than the manifest-side change alone.

## 6. Other technical items worth flagging

- `versionCode 1` / `versionName "1.0.0"` (`app/build.gradle`) — correct for a first release. Every
  future update must bump `versionCode` (Play requires strictly increasing integers) — put this in
  the release checklist (`06-checklists.md`) as a standing rule, not a one-time note.
- `minSdkVersion 24` (Android 7.0, 2016) / `compileSdk`/`targetSdk 36` — a wide, sensible device
  range; targeting the latest API level is exactly what Play requires for new app submissions
  (Play enforces a minimum targetSdk floor that rises yearly — 36 clears any current requirement
  with room to spare).
- The signing keystore (`android/keystore/wealthynest-release.jks`, referenced via
  `keystore.properties`, git-ignored) is reused from the retired TWA project specifically so this
  stays the same app identity on Play if ever submitted under that key, per
  `ANDROID_APP_ROADMAP.md`. **Losing this keystore means losing the ability to ever push another
  update to this Play Store listing** — confirm it's backed up somewhere durable and outside git
  before the first upload, not after.
- `google-services.json` is correctly git-ignored and does not exist in the repo yet — push
  notifications are code-complete but inert until it's added (see README gap #6). Don't upload a
  release build with a stale/missing `google-services.json` if the Data Safety form already declares
  push-notification data collection as live.
