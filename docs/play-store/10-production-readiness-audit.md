# Production Readiness Audit — Play Store Launch Lens

Scored specifically against "ready for first Play Store production release," not general code
quality (see `docs/security-review.md` and prior engineering-audit memory for the broader codebase
assessment — this audit narrows to what matters for shipping to Play).

| Dimension | Score | Rationale |
|---|---|---|
| **UI** | 8.5/10 | A genuinely designed system exists (`PremiumIcon`/`GlossyBadge` glossy gradient icon language, consistent Card/Modal/Tooltip primitives, dark/light theming, `Vault`'s own brass accent treatment) — not default-template styling. Docked slightly for screenshots/feature graphic not yet existing as store-ready assets; the app itself looks finished. |
| **UX** | 8/10 | Strong, coherent flows: shared budgets, expense splitting with net settle-up, CSV import with an editable review step, PIN/passkey/biometric sign-in all reduce real friction rather than adding it. Docked for two concrete gaps: (1) reinstall always forces re-login with no forewarning in-product (by design, but still a UX cost), (2) no App Links means email deep-links (password reset, verification) drop into the browser instead of the installed app. |
| **Performance** | 7.5/10 | Backend has documented N+1 fixes and batch-loading (`WalletAccountServiceImpl`, `BudgetServiceImpl`), paginated queries where needed. `minifyEnabled false` on the release Android build means unshrunk/unobfuscated release bytecode and a larger APK than necessary — an easy, not-yet-taken win before the first production build. Production infra is a single AWS EC2 instance (`ap-south-1`, CDK-provisioned per `docs/architecture-diagram.md`) behind Nginx/Cloudflare — a real single-instance scaling ceiling, but not a v1.0.0 blocker for a family/soft-launch scope; note `ANDROID_APP_ROADMAP.md`'s own "known infra ceiling" section describing this as "self-hosted Docker Compose" is stale relative to the actual current AWS CDK infra. |
| **Security** | 8.5/10 | This is the strongest dimension: JWT secret fail-fast validation, rate limiting with trusted-proxy IP handling, PIN lockout counters separate from password lockout, WebAuthn implementation verified against actual library source (not guessed), `allowBackup="false"` deliberately reasoned, clean permission set with nothing excessive for a finance app, no cleartext traffic possible. Docked slightly because WebAuthn/passkey login has never been manually verified end-to-end on a real Android device — flagged as unverified in the app's own roadmap, not a known bug, but a real gap in confidence before shipping to production users. |
| **Compliance** | 7/10 | Privacy Policy and Terms are substantive and India-aware (IT Act 2000, 18+ gate, financial-advice disclaimer) and the two real gaps found this session (undisclosed Firebase/Google Sign-In processors, missing dedicated delete-account page) are now fixed. Docked for: DPDP Act 2023 not yet explicitly referenced alongside the IT Act clause (a legal-review item, not something to guess wording for here), and for the Financial Features/Content Rating/Data Safety forms not having existed anywhere before this session — they exist now as drafted answers but haven't yet been through Play Console's actual submission flow. |
| **Accessibility** | 7/10 | Real, deliberate work already done: WCAG AA contrast fix on `--muted-foreground` in both themes, skip-to-content link added, a prior fix for a real focusable-chart-inside-`aria-hidden` violation and a Recharts `<Pie>` accessibility-layer bug (both per recent commit history). Docked because this is a WebView-wrapped web app — accessibility quality is inherited entirely from the web app's own state, and no native-Android-specific accessibility pass (TalkBack testing inside the Capacitor WebView specifically, as opposed to a desktop browser) is confirmed done. |
| **Play Store readiness** | 6/10 (pre-this-session) → **8.5/10 (post-this-session)** | Before this review: no Play-specific documentation existed anywhere in the repo beyond a roadmap checklist — no store listing copy, no Data Safety answers, no graphics, no delete-account page. After this session: every required document/answer is drafted and grounded in the real app, two real code gaps are fixed, and the remaining work is asset production (screenshots, feature graphic) and the Play Console submission flow itself, not further research or unknowns. |
| **Overall Production Score** | **7.8/10** | A well-built, well-tested app (see the backend's 92.93%/74.21% line/branch coverage and the frontend's 608-test suite per prior session memory) held back only by pre-launch packaging tasks (graphics, staged rollout discipline, App Links) rather than by underlying product or security quality. The realistic path to Play Store approval is straightforward, not uncertain — see `07-rejection-risk-review.md`'s overall assessment. |

## What would move the Overall score meaningfully

1. **App Links/deep-linking** (`05-manifest-and-technical-review.md` §5) — closes the single clearest
   UX gap, worth ~+0.3 once shipped.
2. **R8/minification enabled** for release builds — cheap, mechanical, worth ~+0.2 on Performance/Security.
3. **A real-device WebAuthn/passkey verification pass** — closes the largest remaining confidence gap
   in Security, worth ~+0.3 once confirmed working (or fixed, if it isn't).
4. **DPDP Act 2023 reference added to the Privacy Policy** alongside the existing IT Act clause —
   worth ~+0.2 on Compliance, low effort, needs a legal-accuracy pass rather than guessed wording.
5. **Actual Play Console submission completed** (not just drafted answers) — the Play Store
   readiness score's remaining gap is entirely "has this been through the real form," which only
   resolves by doing it.

None of the above block a first submission — they're the ordered list for the release *after* v1.0.0,
not prerequisites to shipping this one.
