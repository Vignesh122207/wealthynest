# WealthyNest — Production-Ready Design Plan

## Current Navigation (9 tabs)

```
Dashboard · Accounts · Expenses · Budgets · Goals
Investments · Net Worth · Analytics · Family
── Settings (footer) · Admin (conditional)
```

---

## Part 1 — Critical Missing Pages

These pages do not exist yet and are required before any public launch.

---

### 1. Landing Page (`/`)

Currently `/` redirects to `/login`. A public-facing homepage is required for anyone who hears about the app.

**Sections:**
```
┌─────────────────────────────────────────────────────────┐
│  NAVBAR                                                 │
│  Logo | Features | Support    Login  Get Started →      │
├─────────────────────────────────────────────────────────┤
│  HERO                                                   │
│  "Your Family's Financial Command Center"               │
│  "Track, Budget, Invest — Together"                     │
│  [Get Started Free]  [See Demo]                         │
│  App screenshot / mockup                                │
├─────────────────────────────────────────────────────────┤
│  FEATURES (3 columns)                                   │
│  Family Budgeting | Investment Tracking | Smart Goals   │
├─────────────────────────────────────────────────────────┤
│  SCREENSHOTS / FEATURE WALKTHROUGH                      │
├─────────────────────────────────────────────────────────┤
│  "Free Forever. No Ads. Ever."                          │
│  [Create Free Account]                                  │
├─────────────────────────────────────────────────────────┤
│  FOOTER                                                 │
│  Privacy Policy | Terms of Service | Support | GitHub   │
└─────────────────────────────────────────────────────────┘
```

**Implementation notes:**
- Shared layout separate from `(auth)` and `(dashboard)` route groups
- Add Open Graph meta tags for social sharing previews
- No auth required to view

---

### 2. Support Page (`/support`)

**Sections:**
```
┌─────────────────────────────────────────────────────────┐
│  HEADER                                                 │
│  "How can we help?"                                     │
│  Search bar (client-side filter on FAQ items)           │
├─────────────────────────────────────────────────────────┤
│  FAQ (accordion)                                        │
│  ├── How do I add a family member?                      │
│  ├── How do I set up recurring expenses?                │
│  ├── How do I track investments?                        │
│  ├── Is my financial data safe?                         │
│  ├── How do I export my data?                           │
│  ├── Does WealthyNest connect to my bank?               │
│  └── How do I delete my account?                        │
├─────────────────────────────────────────────────────────┤
│  CONTACT                                                │
│  Email: support@wealthynest.in                          │
│  Response time: within 48 hours                         │
├─────────────────────────────────────────────────────────┤
│  ☕ BUY ME A COFFEE                                     │
│  "WealthyNest is free forever, no ads.                  │
│   If it's helped your family, a coffee keeps            │
│   the servers running!"                                 │
│  [Support the Developer →]  (buymeacoffee.com link)    │
└─────────────────────────────────────────────────────────┘
```

**Implementation notes:**
- Static page, no API calls needed
- Accessible without login (link from landing page footer)
- Also add link in sidebar footer (below Settings)
- Buy Me a Coffee: create account at buymeacoffee.com, use their link button

```tsx
<a
  href="https://buymeacoffee.com/YOUR_USERNAME"
  target="_blank"
  rel="noopener noreferrer"
  className="inline-flex items-center gap-2 bg-yellow-400 text-black
             px-4 py-2 rounded-lg font-medium hover:bg-yellow-300 transition-colors"
>
  ☕ Buy Me a Coffee
</a>
```

---

### 3. Privacy Policy (`/privacy`)

**Required for:** Google Play Store, Apple App Store, any data collection

- Generate from privacypolicygenerator.info or similar
- Must cover: data collected, how stored, third-party sharing, deletion rights
- Link from: landing page footer, signup page, support page, app store listing
- Static page, no auth required

---

### 4. Terms of Service (`/terms`)

**Required for:** Google Play Store, Apple App Store

- Covers: acceptable use, no warranties, account termination, governing law (India)
- Link from: landing page footer, signup page
- Static page, no auth required

---

### 5. Onboarding Wizard (post-signup flow)

After signup → email verify → instead of empty dashboard, guide user through setup.

**Steps:**
```
Step 1 — "What's your primary goal?"
  ○ Track family expenses
  ○ Save for a goal
  ○ Track investments
  ○ All of the above

Step 2 — "Set up your first account"
  → Create bank / cash account with opening balance
  → (Can skip)

Step 3 — "Set your monthly budget" (optional)
  → Set total monthly spending limit

Step 4 — "Invite your family?" (optional)
  → Show family invite code
  → Or skip to dashboard

→ Land on Dashboard with first data already present
```

**Implementation notes:**
- Multi-step form at `/onboarding`
- Redirect here after email verification if user has no accounts yet
- After completion, set a `onboardingComplete` flag on the user record
- Skip link on every step

---

### 6. Notifications Page (`/notifications`)

Backend already built (`NotificationService`, budget breach dedup). Need UI.

**Header bell icon (all pages):**
```
Header → 🔔 badge with unread count
       → Click → dropdown with latest 5 notifications
       → "View All" link → /notifications
```

**Full notifications page:**
```
┌─────────────────────────────────────────────────────────┐
│  Notifications          [Mark all as read]              │
├─────────────────────────────────────────────────────────┤
│  Filter: All | Budget Alerts | Goals | System           │
├─────────────────────────────────────────────────────────┤
│  TODAY                                                  │
│  🔴 Budget Alert — Food budget 92% used    2h ago  ●   │
│  🟢 Goal reached — Emergency Fund         5h ago      │
│                                                         │
│  YESTERDAY                                             │
│  🔴 Budget Alert — Shopping over budget   1d ago      │
└─────────────────────────────────────────────────────────┘
```

**Backend additions needed:**
- `GET /api/v1/notifications` — paginated, unread first
- `PUT /api/v1/notifications/read-all`
- `PUT /api/v1/notifications/{id}/read`
- `GET /api/v1/notifications/unread-count` — for bell badge polling

---

### 7. Reports Page (`/reports`)

Downloadable monthly and annual financial reports.

```
┌─────────────────────────────────────────────────────────┐
│  Reports                                                │
├─────────────────────────────────────────────────────────┤
│  MONTHLY REPORTS                                        │
│  June 2026    [Download PDF] [Download CSV]             │
│  May 2026     [Download PDF] [Download CSV]             │
│  April 2026   [Download PDF] [Download CSV]             │
├─────────────────────────────────────────────────────────┤
│  ANNUAL REPORTS                                         │
│  2026 (Jan–Jun so far)  [Download PDF]                  │
│  2025                   [Download PDF]                  │
└─────────────────────────────────────────────────────────┘
```

**PDF report contents:**
- Income vs expenses summary
- Budget performance per category
- Top 10 expenses
- Savings rate
- Net worth snapshot
- Investment performance

**Implementation notes:**
- Generate PDF server-side using iText or JasperReports (Spring Boot)
- Stream directly to client — no S3 needed
- CSV already exists on Expenses page; expand to full financial export here

---

## Part 2 — Tab-by-Tab Improvements

### Dashboard — 3 Additions

| What to Add | Detail |
|---|---|
| Notification bell | 🔔 icon in header, badge with unread count, dropdown on click |
| Upcoming this week | Section showing recurring expenses due in next 7 days |
| Smart insight card | One sentence: "You spent ₹3,200 more on dining vs last month" |

---

### Accounts — 1 Addition

| What to Add | Detail |
|---|---|
| Per-account statement | Download PDF/CSV for a single account with date range filter |

Users need this for tax filing and bank reconciliation.

---

### Expenses — 1 New Tab: Recurring

Backend scheduler exists, no management UI exists yet.

**Add tab inside Expenses page:**
```
Expenses page tabs:  All Expenses  |  Recurring

Recurring tab:
┌─────────────────────────────────────────────────────────┐
│  Recurring Expenses                  [+ Add Recurring]  │
├─────────────────────────────────────────────────────────┤
│  Netflix Subscription                                   │
│  ₹649 · Monthly · Next: Jul 1, 2026   [Edit] [Delete]  │
│                                                         │
│  House Rent                                             │
│  ₹15,000 · Monthly · Next: Jul 5, 2026  [Edit] [Delete]│
└─────────────────────────────────────────────────────────┘
```

---

### Budgets — 1 Addition

| What to Add | Detail |
|---|---|
| Rollover toggle | Per-budget toggle: unspent amount carries forward to next month |

---

### Goals — 1 Addition

| What to Add | Detail |
|---|---|
| Link to account | Link a goal to a specific account (Emergency Fund goal → Emergency Fund account) so balance auto-syncs to goal progress |

---

### Investments — 1 Addition

| What to Add | Detail |
|---|---|
| SIP reminder | Show next SIP date per mutual fund, mark as logged when recurring expense fires |

---

### Net Worth — 1 Addition

| What to Add | Detail |
|---|---|
| Historical trend chart | Monthly net worth snapshots stored via scheduler, displayed as line chart |

**Backend additions needed:**
- `net_worth_snapshots` table (user_id, snapshot_date, total_assets, total_liabilities, net_worth)
- Scheduled job: run on 1st of each month, store snapshot
- `GET /api/v1/net-worth/history` endpoint

---

### Analytics — 1 Addition

| What to Add | Detail |
|---|---|
| Year-over-year view | Toggle between "Monthly view" and "Year comparison" (this year vs last year bars side by side) |

---

### Family — 3 Additions

Currently too minimal for a family-first app.

| What to Add | Detail |
|---|---|
| Family expense feed | Combined feed of all members' recent expenses in one view |
| Per-member spending chart | Pie/bar chart showing each member's spend this month |
| Shared family goals | Goals the whole family contributes to, visible to all members |

---

### Settings — 1 Addition

Add a **"Support the App"** section after the existing sections:

```
─── Support the App ──────────────────────────────────────
WealthyNest is free forever with no ads.
If it helps your family, a coffee keeps it running.

[☕ Buy Me a Coffee]    [★ Star on GitHub]
```

---

## Part 3 — Updated Sidebar

```
  Dashboard
  Accounts
  Expenses
  Budgets
  Goals
  Investments
  Net Worth
  Analytics
  ─────────────
  Family
  Reports          ← NEW
  ─────────────
  Admin            ← conditional (ADMIN role only)

Footer:
  [Avatar] Name · Role
  Settings
  Support          ← NEW link
  Sign out
```

**Mobile bottom nav (5 slots — unchanged):**
```
Home  |  Accounts  |  Expenses  |  Budgets  |  Goals
```

Notifications lives in the **header bell icon**, not the bottom nav.

---

## Part 4 — Production Readiness Checklist

### Must Fix Before Launch

- [ ] `/not-found.tsx` — friendly 404 page with link back to dashboard
- [ ] `error.tsx` — global error boundary with "Something went wrong, try again" message
- [ ] Loading skeletons — replace all spinners with skeleton screens
- [ ] PWA manifest — `manifest.json` with name, icons, theme_color (makes app installable on Android from browser)
- [ ] App icons — 192×192 and 512×512 PNG icons for PWA and Play Store
- [ ] Favicon — proper favicon.ico + apple-touch-icon
- [ ] Open Graph tags — on landing page for social sharing previews
- [ ] HTTPS enforced — Spring Boot must reject plain HTTP in production
- [ ] CORS locked down — only allow wealthynest.in origin, not wildcard

### Mobile App Specific

- [ ] Splash screen — shown while Capacitor app loads
- [ ] Push notifications — Firebase Cloud Messaging for budget alerts
- [ ] Offline screen — friendly message instead of broken API errors
- [ ] Android back button handling — Capacitor needs explicit back navigation

### Backend / API

- [ ] Health check endpoint — `GET /actuator/health` (already in Spring Boot, just expose it)
- [ ] API versioning — already at `/api/v1/` (good)
- [ ] Rate limiting tuned for production — check trusted-proxies config before deploy
- [ ] Database connection pooling — verify HikariCP settings for production load
- [ ] Logs — structured JSON logging for CloudWatch/Grafana

---

## Part 5 — Implementation Order

```
Week 1:   Landing page (/, navbar, hero, features, footer)
Week 2:   Privacy Policy + Terms of Service (static pages)
Week 3:   Support page + Buy Me a Coffee
Week 4:   Notifications backend endpoints + bell icon + /notifications page
Week 5:   Onboarding wizard (/onboarding, 4 steps)
Week 6:   Recurring expense management UI (tab in Expenses)
Week 7:   Family page improvements (feed, per-member chart, shared goals)
Week 8:   Reports page (PDF/CSV generation)
Week 9:   Net worth history (DB table + scheduler + chart)
Week 10:  404 + error pages + loading skeletons + PWA manifest
Week 11:  Settings: Support the App section + Buy Me a Coffee
Week 12:  Mobile app (Capacitor wrapper + splash screen + push notifications)
```

---

## Buy Me a Coffee — Setup Steps

1. Go to buymeacoffee.com → create account
2. Set your page name (e.g. `buymeacoffee.com/wealthynest`)
3. Add profile photo and short description
4. Connect bank account for payouts
5. Use the link in `/support` and `/settings`
6. No backend code needed — it's just a link

When a user clicks and buys a coffee (₹149 / $5 equivalent), you get notified by email and the money hits your bank account within 3–5 days.
