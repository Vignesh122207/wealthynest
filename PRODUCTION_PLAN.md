# WealthyNest — Production Readiness Status

> Re-verified directly against the codebase on 2026-07-25. The previous version of this
> document was a pre-implementation plan and had drifted significantly out of date — most of
> what it listed as "critical missing" has since shipped. This version replaces it with the
> actual current state, so it stops being cited as a gap list for work that's already done.

## Current Navigation (9 tabs)

```
Dashboard · Accounts · Expenses · Budgets · Goals
Investments · Net Worth (Assets) · Analytics · Family
── Settings (footer) · Admin (conditional)
```

---

## Part 1 — Pages that were "critical missing" — now checked against the repo

| Page | Status | Evidence |
|---|---|---|
| Landing page (`/`) | **Shipped** | `app/page.tsx` — real hero, 5 feature groups, security band, honest "no VC funding" note, footer linking Support/Privacy/Terms. Not a redirect to `/login` anymore. |
| Support page | **Shipped** | Public `app/support/page.tsx` (linked from landing footer, no auth) plus an in-app authenticated version and FAQ/contact/tickets under `settings/support/*`. |
| Privacy Policy (`/privacy`) | **Shipped** | `app/privacy/page.tsx`, 136 lines. |
| Terms of Service (`/terms`) | **Shipped** | `app/terms/page.tsx`, 155 lines. |
| Onboarding wizard | **Partial** | `family/_components/NoFamilyOnboarding.tsx` onboards someone into a *family*. There's no generic "first account / first budget" wizard for a brand-new solo user — every page's own empty state (e.g. Analytics' "Nothing to analyze yet" with direct links) substitutes for it today. Decide if a dedicated flow is still worth building, or if empty-state CTAs are sufficient. |
| Notifications page | **Shipped** | Header bell with unread badge + dropdown panel (`Header.tsx`, `useMergedNotifications`) and a full `(dashboard)/notifications/page.tsx`. |
| Reports page | **Shipped** | `(dashboard)/reports/` — Monthly, Annual, and raw-data Export tabs (CSV for expenses/income/transfers/accounts/investments/investment-income). |

---

## Part 2 — Tab-by-tab, re-checked

### Dashboard — all 3 original asks shipped
Notification bell (Header), upcoming-bills + smart spending-delta insight (`SmartAlerts.tsx`), over-budget alert banner. Nothing open here.

### Accounts — 1 item orphaned, not missing
| What | Status |
|---|---|
| Per-account statement download | **Backend done, frontend never wired up.** `WalletAccountController` has a real `GET /accounts/{id}/statement` endpoint (`WalletAccountService.generateStatementCsv`, streams CSV with a proper `Content-Disposition`). No frontend code calls it — no `downloadStatement` API method, no button on `AccountsGrid`/`AccountCard`. Same "working endpoint the UI never reached" pattern as the expense-split per-split settle endpoint the Playwright suite found. Either wire up a download button or remove the dead backend endpoint — it shouldn't stay silently unreachable. |

### Expenses — done, different location than originally sketched
Recurring rule management shipped as `settings/recurring` (Income/Expenses/Transfers/Goals tabs) rather than as a tab inside the Expenses page itself. Functionally equivalent to the original ask.

### Budgets — 1 item still open
| What | Status |
|---|---|
| Rollover toggle (unspent carries to next month) | **Not built.** No `rollover`/`carryOver` field anywhere in the budget entity or schema. Still a real gap if users are asking for it. |

### Goals — shipped
`accountId` is wired end-to-end (`Goal` entity, `CreateGoalRequest`/`UpdateGoalRequest`, `GoalResponse`) — a goal can link to a specific account.

### Investments — 1 item still open
| What | Status |
|---|---|
| SIP reminder (next due date surfaced) | **Not built.** `SipSection.tsx` exists for logging SIP contributions but doesn't surface a "next SIP due" date anywhere. |

### Net Worth — shipped
`NetWorthHistoryChart.tsx` on the Assets page plus a trend widget on Home, backed by a real `GET /net-worth/history` endpoint.

### Analytics — shipped
Dedicated Year-over-Year Comparison chart (this year vs. last year, monthly) already on the page — not a toggle as originally sketched, but the same information.

### Family — 2 of 3 shipped
| What | Status |
|---|---|
| Combined family expense feed | **Shipped** — `SharedActivityFeed.tsx` |
| Per-member spending chart | **Shipped** — `MemberSpendingChart.tsx` |
| Shared family goals (whole family contributes, visible to all) | **Not built.** No `sharedGoal`/`familyGoal` concept anywhere — goals today are still per-user. |

### Settings — shipped, via UPI instead of Buy Me a Coffee
`(dashboard)/support-wealthynest/page.tsx` is a dedicated in-app page with a UPI pay link/QR (`upi://pay?pa=...&pn=WealthyNest&tn=Support%20WealthyNest`) positioned as supporting the developer — a better fit for the Indian market than a buymeacoffee.com link would have been. Not in Settings itself as originally sketched, but the same ask, shipped.

---

## Part 4 — Production readiness checklist, re-verified

### Must-fix-before-launch — all resolved except one
- [x] `/not-found.tsx` — shipped
- [x] `error.tsx` global boundary — shipped
- [x] Loading skeletons — shared `LoadingSkeleton.tsx`, used in 11+ places, not just spinners
- [x] PWA manifest — `manifest.json` with 192/512 + maskable icons, install shortcuts for Add Expense/Dashboard
- [x] App icons (192×192, 512×512) — shipped
- [x] Favicon + apple-touch-icon — handled via Next's metadata API (`layout.tsx`'s `icons` block), not static files — actually a better pattern than the original ask
- [x] Open Graph tags — `opengraph-image.tsx` + `twitter-image.tsx`, dynamically generated
- [ ] **HTTPS enforced** — no in-app enforcement (no HSTS/redirect-to-https in Spring config); relies entirely on the Cloudflare Tunnel terminating TLS. That's a valid pattern **only if** nothing else can reach the origin directly — see the open infra item below.
- [x] CORS locked down — driven by `CorsProperties`/`wealthynest.security.cors.allowed-origins`, not a hardcoded wildcard. Just confirm the deployed `.env`'s `CORS_ORIGINS` is the real production domain, not `localhost:3000`.

**Open infra check, not a code fix**: `docker-compose.yml` maps `wealthynest-api` (`8080:8080`) and `wealthynest-web` (`3000:3000`) to all interfaces, unlike Postgres/Redis which are pinned to `127.0.0.1`. Confirm the host's firewall/security group actually blocks public inbound 8080/3000 — otherwise the Cloudflare Tunnel's TLS termination can be bypassed entirely by hitting the origin's IP directly over plain HTTP.

### Mobile App Specific
- [x] Splash screen — shipped (see recent commit fixing the blank-rectangle bug)
- [ ] **Push notifications** — not built. No `@capacitor/push-notifications` or Firebase dependency in `package.json`. Confirmed still an open item, matches `ANDROID_APP_ROADMAP.md`'s own "known gap."
- [x] Push notifications — implemented via `@capacitor/push-notifications` + Firebase Cloud Messaging (`FcmPushNotificationSender`, `device_tokens` table, `useNativePush.ts`) — wired into the same 5 alert types as in-app notifications. Firebase project setup and on-device delivery are still unverified; see `ANDROID_APP_ROADMAP.md`'s "Push notifications" section for the setup steps and its Phase 1 checklist for the verification list.
- [x] Offline screen — `public/offline.html` + `public/sw.js` shipped
- [ ] **Android back button handling** — no explicit `App.addListener("backButton", ...)` found. Capacitor's default WebView back-navigation may already be adequate; hasn't been deliberately verified either way.

### Backend / API
- [x] Health check endpoint — `/actuator/health` exposed (`management.endpoints.web.exposure.include: health,info,metrics`), already wired into the Docker healthcheck
- [x] API versioning — `/api/v1/` throughout
- [x] Rate limiting — real two-tier config (`RateLimitConfig`, trusted-proxy aware); Playwright's own README flags that concurrent-real-device load under the Cloudflare Tunnel hasn't been stress-tested yet — worth a real check before a public launch, not just local dev traffic
- [x] Database connection pooling — HikariCP configured (`maximum-pool-size: 20`, `minimum-idle: 5`, `connection-timeout: 30000`)
- [ ] **Structured JSON logging** — not built. `application.yml` only sets log *levels*, no JSON encoder (no `logback-spring.xml` with a structured layout). Still a real gap for CloudWatch/Grafana-style ingestion.

---

## What's actually left (the real list, not the old one)

1. Confirm the host firewall blocks direct access to ports 8080/3000 (Cloudflare Tunnel bypass risk).
2. Structured JSON logging for real observability.
3. Wire up (or deliberately remove) the orphaned per-account statement endpoint.
4. A deliberate yes/no on: generic onboarding wizard, budget rollover, SIP due-date reminder, shared family goals, Android back-button handling. (Push notifications are decided and implemented — what's left there is Firebase project setup and on-device verification, not a product decision; see `ANDROID_APP_ROADMAP.md`.)
5. Verify rate limiting under genuine concurrent multi-device load, not just local dev traffic.

None of these are launch-blocking in the way the original checklist implied — the actual blocking-page work (landing, legal, notifications, reports, onboarding-adjacent empty states) is done.
