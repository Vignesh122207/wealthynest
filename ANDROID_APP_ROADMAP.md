# WealthyNest — Android App Roadmap

## Decision: Trusted Web Activity (TWA), not a native rewrite

WealthyNest is already a responsive Next.js 15 app with a real public domain
(`wealthynest.in` / `api.wealthynest.in` via the Cloudflare Tunnel in
`docker-compose.yml`), a `manifest.json`, and (as of this roadmap) a service
worker. The fastest, lowest-risk path to a Play Store listing is a **Trusted
Web Activity** — a thin Android shell (built with Google's
[Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap)) that renders the
real site full-screen via Chrome, with a real launcher icon and no URL bar.
100% of the existing UI, auth, business logic, and test coverage carries over
unchanged; there is no second codebase to maintain.

**Why not the alternatives:**

| Approach | Verdict |
|---|---|
| **TWA** (chosen) | Reuses the whole web app. Small, fast to ship, Play-Store-approved pattern for PWAs. Shares Chrome's cookies/localStorage with the real site — auth just works. |
| Native rewrite (Kotlin/Compose) | Months of duplicate work re-implementing every screen already built and tested. Not justified unless a native-only capability is needed later (e.g. deep OS integration, widgets). |
| Raw WebView wrapper (Cordova-style) | Explicitly discouraged by Google Play policy when a TWA gives a strictly better result for less code — worse performance, separate storage from Chrome, more review risk. |

If a genuinely native capability becomes a hard requirement later (home-screen
widgets, background biometric unlock, deep OS notification integration), the
TWA can be extended with native Android code around the same web core — this
isn't a dead end, it's a staging point.

---

## Phase 0 — Prerequisites (done)

These were blockers found while assessing readiness, fixed and verified live:

- [x] **Rate limiter fixed.** `RateLimitConfig` was keying on `request.getRemoteAddr()`,
      which — behind the Cloudflare Tunnel (`cloudflared` proxies straight to
      `http://wealthynest-api:8080` over the docker network) — meant every real
      user shared one 10-req/min auth bucket and one 200-req/min API bucket.
      Now trusts the pinned `wealthynest-net` subnet (`172.19.0.0/16`,
      `RATE_LIMIT_TRUSTED_PROXIES` in `.env`) and reads Cloudflare's
      `CF-Connecting-IP` header for the real per-visitor IP. Verified end-to-end
      against the live tunnel. This mattered independently of Android — it would
      have throttled real concurrent users on the web app too — but it's a hard
      blocker for any multi-user mobile rollout specifically.
- [x] **Service worker added.** `public/sw.js` + `public/offline.html`,
      registered from `Providers` (`src/app/providers.tsx`). Deliberately
      minimal: real `fetch` handler (a TWA/PWA installability requirement, not
      just "Add to Home Screen") and an offline fallback page — no caching of
      API responses or account/expense/investment data, since a finance app
      silently showing yesterday's balance while offline is worse than no
      offline support.

## Phase 1 — PWA completeness check

Before wrapping the site, confirm it actually passes Chrome's installability
bar (this is what Bubblewrap/TWA relies on under the hood):

- [ ] Run a Lighthouse PWA audit against `https://wealthynest.in` (Chrome
      DevTools → Lighthouse → PWA category) and fix anything it flags.
- [ ] Confirm `manifest.json`'s `start_url` (`/dashboard`) behaves correctly
      for a logged-out user opening the app cold — right now it redirects
      through `/login`; verify that redirect chain is smooth inside a TWA's
      chrome (no visible flash of the browser UI during the bounce).
- [ ] Decide the launch-time splash-screen behavior (`background_color`
      `#0f172a` / `theme_color` `#6366f1` from `manifest.json` already drive
      this correctly for Android's generated splash screen — just confirm it
      looks right on a real device).

## Phase 2 — Digital Asset Links + TWA build

This is the actual "make it an Android app" step.

- [ ] Generate an Android signing keystore (`keytool -genkey`) — this
      identity is permanent for the app's lifetime; back it up somewhere
      durable (losing it means losing the ability to ever update the app on
      Play).
- [ ] Run `bubblewrap init --manifest=https://wealthynest.in/manifest.json`
      to scaffold the Android project. Bubblewrap reads the existing manifest
      directly — no manual Android boilerplate needed.
- [ ] Publish `/.well-known/assetlinks.json` on `wealthynest.in`, containing
      the SHA-256 fingerprint of the signing keystore from the step above.
      This is what proves to Chrome "this Android app and this website are
      the same operator" — without it, the TWA silently falls back to
      showing a URL bar like a normal Custom Tab.
- [ ] Build and sideload the resulting `.apk`/`.aab` on a real device, confirm
      it opens full-screen with no URL bar (the visible proof Digital Asset
      Links verified correctly).

## Phase 3 — Decide on WebAuthn/passkeys in the packaged app

Passkeys are origin-bound to `wealthynest.in` (confirmed via
`WebAuthnConfig.getRpId()`, driven by `FRONTEND_URL`). Inside a correctly
verified TWA, WebAuthn calls made by the (identical) web page continue to work
against that same origin — no extra backend work. Two things to confirm on a
real device before relying on it:
- [ ] Android's platform passkey UI (Google Password Manager / a device's
      fingerprint prompt) actually surfaces correctly inside a TWA's Custom
      Tab context, not just a normal Chrome tab.
- [ ] The `tests/regression/webauthn.spec.ts` flow only exercises this in
      desktop Chromium via a CDP virtual authenticator today — there's no
      equivalent Android-device coverage. Treat first real-device passkey
      login as a manual smoke test before launch, not something CI already
      proves.

## Phase 4 — Play Store listing prep

Standalone from engineering — needs product/content decisions, not code:

- [ ] Google Play Developer account (one-time $25 fee).
- [ ] Privacy Policy + Terms of Service pages — `PRODUCTION_PLAN.md`'s
      landing-page plan already lists a footer for these; they need to exist
      as real published pages before Play accepts the listing.
- [ ] Play's **Data Safety** form — for a finance app this is scrutinized
      closely. Walk through exactly what's collected (email, financial data
      entered by the user, no ad tracking per the landing page's "No Ads.
      Ever." commitment) and declare it accurately; mismatches here are a
      common rejection reason.
- [ ] Screenshots/feature graphic sized per Play's current requirements —
      the existing Playwright visual-regression suite
      (`playwright/tests/visual/`) already has clean, deterministic
      empty-state screenshots of Dashboard/Accounts/Transactions that are a
      good starting point.
- [ ] Content rating questionnaire (should be low-friction — no UGC, no
      social features beyond family invites).

## Phase 5 — Testing before release

- [ ] Play Console's **Internal testing track** first (instant, no review
      wait) with a handful of real accounts before any wider rollout.
- [ ] Real-device pass across a couple of screen sizes/Android versions —
      the Playwright suite's `mobile-chrome`/`tablet`/`tablet-portrait`
      projects already prove the responsive layout works at those
      viewports in desktop Chrome's device emulation; a TWA on an actual
      device is worth one manual pass since Chrome-on-Android rendering
      isn't bit-identical to emulation.
- [ ] Confirm the rate-limiter fix (Phase 0) holds up with more than one
      concurrent real device hitting the API — that's the scenario it was
      previously silently broken for.

## Phase 6 — Release + ongoing

- [ ] Closed → Open testing track → Production rollout (staged percentage
      rollout, standard Play practice — don't ship to 100% on day one).
- [ ] Decide who monitors Play Console's crash/ANR reports post-launch —
      there's no existing mobile-specific error-tracking pipeline in this
      repo; the web app doesn't currently have one either, worth a separate
      look regardless of Android.
- [ ] App updates are just redeploying the website (`docker compose up -d
      --build wealthynest-web`) — the Android shell itself only needs a new
      Play submission when Bubblewrap's own wrapper code changes, which is
      rare. This is the main ongoing win of the TWA approach: shipping a
      feature to Android is shipping it to the website, nothing more.

---

## Open decisions (need your input, not further research)

- **Android package name / app identity** (e.g. `in.wealthynest.app`) —
  permanent once chosen, needs deciding before Phase 2's keystore step.
- **Play Developer account owner** — personal account vs. a dedicated
  organization account, given this is a live finance app handling real user
  data.
- **Launch scope** — family/invite-only soft launch via Internal/Closed
  testing first, or straight to Production. Given the app handles real
  financial data, a longer closed-testing window is the safer default.

## Known infra ceiling (worth knowing, not a blocker)

The whole stack is self-hosted via a single Docker Compose host behind one
Cloudflare Tunnel — fine for family/small-scale usage, but it's a single
point of failure and won't horizontally scale past one machine. Not something
Android packaging needs solved, but worth knowing before any wider public
push: a Play Store listing makes the app discoverable to strangers in a way
a private link never did.
