# Play Store Assets Checklist & Release Checklist

## Assets Checklist

**Required** (Play Console will not let you publish without these):
- [ ] App icon, 512×512 PNG — exists at `public/icons/icon-512.png`; confirm it's brand-final
- [ ] Feature graphic, 1024×500 — **does not exist yet**, see `02-graphics-and-screenshots.md`
- [ ] At least 2 phone screenshots — **do not exist as store-ready assets yet** (Playwright visual
      baselines are dev artifacts, not marketing screenshots — see `02-graphics-and-screenshots.md`)
- [ ] Short description (≤80 chars) — drafted in `01-store-listing-and-aso.md`
- [ ] Full description (≤4000 chars) — drafted in `01-store-listing-and-aso.md`
- [ ] Privacy Policy URL — `https://wealthynest.in/privacy` (exists, now updated)
- [ ] Content rating questionnaire completed — answers drafted in `04-data-safety-compliance.md`
- [ ] Data Safety form completed — answers drafted in `04-data-safety-compliance.md`
- [ ] Target audience/age selection — answered in `04-data-safety-compliance.md`
- [ ] Ads declaration — answered in `04-data-safety-compliance.md` (No ads)
- [ ] App category selected — Finance
- [ ] Signed release build (`.aab`, not `.apk` — Play requires Android App Bundle for new apps) built
      from the existing keystore
- [ ] Developer account identity verification completed (can take days — start early)
- [ ] Contact email/website/phone for the store listing — use `support@wealthynest.in` consistently

**Recommended**:
- [ ] Tablet screenshots (7" and 10") — see `02-graphics-and-screenshots.md`; low native-layout risk
      since the app is a responsive WebView, but still needs real capture, not resizing
- [ ] What's New / release notes for v1.0.0 — drafted in `01-store-listing-and-aso.md`
- [ ] Internal testing track populated with a handful of real testers before any wider rollout
      (`ANDROID_APP_ROADMAP.md` Phase 3 already calls this out)
- [ ] Terms of Service URL surfaced in the store listing's "About" links, alongside Privacy Policy
- [ ] Delete-account URL (`https://wealthynest.in/delete-account`) entered in the Data Safety form's
      dedicated field

**Optional**:
- [ ] Promo graphic (180×120) — legacy surface, low priority, see `02-graphics-and-screenshots.md`
- [ ] Localized store listing (Hindi or other regional language) — a Week-2+ ASO decision, not v1.0.0
- [ ] Android TV / Wear OS assets — **not applicable**, this app does not target either form factor

## Release Checklist

### Before Upload
- [ ] `cd wealthynest-web && npx cap sync android` run after any dependency change since last sync
- [ ] `keystore.properties` filled in locally (git-ignored, never committed) pointing at the real
      release keystore — confirmed backed up outside git per `05-manifest-and-technical-review.md` §6
- [ ] `google-services.json` dropped in if push notifications are meant to be live in this exact
      build (`android/app/google-services.json`, git-ignored)
- [ ] Native Google Sign-In's three prerequisites all done if that button should be visible on
      Android (see `ANDROID_APP_ROADMAP.md` Phase 1 — Desktop-type OAuth client, redirect URI,
      `GOOGLE_NATIVE_CLIENT_ID` set + rebuilt)
- [ ] `./gradlew bundleRelease` (Android App Bundle, not `assembleRelease`/APK) produces a signed,
      installable build
- [ ] Fresh install tested on a real device or emulator — confirm it's not a stale cached build (see
      the explicit warning in `ANDROID_APP_ROADMAP.md` about `server.url`/icon changes needing a
      genuinely fresh build to reach the device)
- [ ] `mvn test` (backend) and `npm test` (frontend) both green — CLAUDE.md's standing rule, doubly
      true right before a public release
- [ ] Privacy Policy / Terms / Delete Account pages all reachable and rendering correctly at their
      public URLs (not just inside `LegalPageChrome`'s settings-origin variant)

### Before Review (Play Console submission)
- [ ] Store listing text (name, short/full description) pasted in from `01-store-listing-and-aso.md`
- [ ] All Required graphics uploaded (icon, feature graphic, ≥2 screenshots)
- [ ] Data Safety form fully completed, matching `04-data-safety-compliance.md` exactly, and matching
      the live Privacy Policy text
- [ ] Content rating questionnaire submitted
- [ ] Target audience/age group set to 18+, "Made for Families" left unchecked
- [ ] Ads declaration set to "No ads"
- [ ] Financial features declaration answered explicitly (all "no"/"none of the above" per
      `04-data-safety-compliance.md`, not left blank)
- [ ] App category = Finance
- [ ] Release chosen as **Internal testing** first, not Production (per `ANDROID_APP_ROADMAP.md`'s
      own recommendation for a financial app's first release)
- [ ] Reviewer test account/credentials provided in Play Console's "App access" section if any part
      of the app requires login to review (it does — provide a working demo login)

### Before Production (after Internal/Closed testing passes)
- [ ] At least a few real testers have used Internal testing for a meaningful period, not just
      installed and closed it
- [ ] Real-device pass across at least 2 screen sizes / Android versions (`ANDROID_APP_ROADMAP.md`
      Phase 3)
- [ ] Rate limiter behavior confirmed correct with more than one concurrent device — `RateLimitConfig`
      trusts `CF-Connecting-IP`/`X-Forwarded-For` only from Cloudflare's published edge ranges (see
      `docs/architecture-diagram.md`); flagged as worth a real multi-device check in
      `ANDROID_APP_ROADMAP.md` Phase 3
- [ ] Push notifications verified end-to-end on a real device if Firebase setup is complete
      (permission prompt, foreground + background delivery, tap-to-open, per-type toggle actually
      stopping delivery)
- [ ] Staged rollout percentage chosen for the first Production release (e.g. 20%, not 100% on day
      one) — `ANDROID_APP_ROADMAP.md` Phase 4 already recommends this
- [ ] Decide who monitors Play Console's crash/ANR dashboard post-launch (README/roadmap open
      decision — assign an owner before Production, not after)

### After Production
- [ ] Watch Play Console's pre-launch report and crash/ANR dashboard daily for the first week
      (see `09-launch-plan.md` Week 1)
- [ ] Watch install/uninstall rate and store-listing conversion rate — feed into the ASO strategy in
      `01-store-listing-and-aso.md` after 2–4 weeks of real data
- [ ] Confirm the rollout percentage is increased on schedule if no crash/ANR spike appears
      (don't leave a staged rollout stuck at a low percentage indefinitely by accident)
- [ ] Respond to the first user reviews — Play's algorithm weights developer-reply presence, and
      early reviews disproportionately shape the listing's star average
- [ ] Schedule the App Links / deep-linking fast-follow (`05-manifest-and-technical-review.md` §5)
      and the R8/minify hardening (§2) for the next release, not indefinitely deferred
