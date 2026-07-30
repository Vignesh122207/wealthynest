# Launch Plan

Assumes launch scope = **soft launch via Internal → Closed testing first**, per the open decision
flagged in `ANDROID_APP_ROADMAP.md` ("given the app handles real financial data, a longer
closed-testing window is the safer default"). Adjust dates against your actual target launch date.

## Day -14

- [ ] Google Play Developer account created and identity verification submitted (this step alone can
      take several days — start it first, don't let it block everything else)
- [ ] `google-services.json` / Firebase project finalized if push notifications should be live at
      launch (`ANDROID_APP_ROADMAP.md` setup steps)
- [ ] Native Google Sign-In's OAuth client fully configured if that button should be visible
- [ ] Feature graphic + all 8 phone screenshots produced from populated demo data
      (`02-graphics-and-screenshots.md`)
- [ ] Store listing copy finalized (`01-store-listing-and-aso.md`)
- [ ] Data Safety form drafted and cross-checked against the live Privacy Policy
      (`04-data-safety-compliance.md`)
- [ ] Delete-account page, Privacy Policy update, and Disclaimer/Refund Policy pages (if adding the
      standalone versions) all live at their public URLs

## Day -7

- [ ] Signed release AAB built (`./gradlew bundleRelease`) from a genuinely fresh sync
      (`npx cap sync android` after any recent dependency change)
- [ ] Full backend + frontend test suites green (`mvn test`, `npm test`)
- [ ] Internal testing track created in Play Console, uploaded, and a handful of real testers (family/
      close friends, per the app's own family-first positioning) added
- [ ] Reviewer test account created and confirmed working (verified email, no lockout state) for the
      "App access" field
- [ ] Content rating questionnaire + Financial Features declaration submitted
- [ ] Support inbox (`support@wealthynest.in`) confirmed actively monitored starting now, not just at
      launch

## Day -1

- [ ] Internal testers have used the app for at least a few days with no blocking bugs reported
- [ ] Real-device pass completed across at least 2 screen sizes/Android versions
      (`06-checklists.md` "Before Production")
- [ ] Push notifications verified end-to-end on a real device (if Firebase is live for this build)
- [ ] Rate limiter behavior spot-checked with more than one concurrent device
- [ ] Production release created in Play Console with a **staged rollout percentage** (e.g. 20%),
      not 100%
- [ ] Final read-through of the store listing as it will actually appear (preview mode), checking for
      typos and that screenshots render correctly at thumbnail size

## Launch Day

- [ ] Submit the Production release for review
- [ ] Monitor Play Console's automated review status — most first submissions resolve within a few
      hours to 1–2 days; a Minimum Functionality hold (see `07-rejection-risk-review.md` §1) is the
      most likely reason for a longer wait
- [ ] If held/rejected, respond same-day with the specific native-capability evidence from
      `07-rejection-risk-review.md` rather than resubmitting unchanged
- [ ] Once live, do a clean install from the actual Play Store listing (not a sideloaded build) on a
      personal device to confirm the real end-to-end experience
- [ ] Announce to the initial closed circle (family/friends who did Internal testing) — don't do a
      wide public announcement yet given the staged rollout

## Week 1

- [ ] Check Play Console's crash/ANR dashboard and pre-launch report daily
- [ ] Read every review as it comes in and respond to the first few personally — this is
      disproportionately weighted by Play's ranking and by future prospective users reading the
      listing
- [ ] Track install → signup → first-action funnel (does a new install actually reach "logged a
      first expense" or "joined a family"?) — this is the real product-health signal, more than
      install count alone
- [ ] Increase the staged rollout percentage if no crash/ANR spike appears (don't leave it stuck)
- [ ] Watch for the first real support tickets/emails around the Known Issues list
      (`08-support-and-help-center.md`) — especially reinstall/re-login confusion and push-notification
      questions, since both are the most likely first-week friction points

## Month 1

- [ ] Full rollout to 100% if Week 1 showed no material issues
- [ ] Run the first ASO iteration using real Play Console "Store listing" analytics (impressions →
      installs conversion) — per `01-store-listing-and-aso.md`, this is the point to actually A/B test
      the icon/screenshots/short description, not before
- [ ] Prioritize the two flagged fast-follows: App Links/deep-linking
      (`05-manifest-and-technical-review.md` §5) and R8/minification hardening (§2) — schedule into
      the next release, not indefinitely
- [ ] Revisit the open product decision on Account Aggregator/bank-sync integration
      (`ANDROID_APP_ROADMAP.md`'s known-gap list) now that real usage data exists on how much manual
      entry/CSV import friction actually matters to users
- [ ] Decide whether a Closed testing track (broader than the initial Internal circle) is worth
      running for the next major feature before it also goes straight to Production
