# WealthyNest — Personal Finance Platform

A production-ready personal finance web application for Indian families.

## Applications

| App | Tech | Port |
|-----|------|------|
| `wealthynest-api` | Spring Boot 3 + Java 21 | 8080 |
| `wealthynest-web` | Next.js 15 + TypeScript | 3000 |

## Quick Start (Docker)

```bash
export JWT_SECRET="your-256-bit-secret-here"
docker compose up -d
# App → http://localhost:3000
# API → http://localhost:8080
```

## Local Development

### Backend
```bash
# Start infrastructure
docker compose up postgres redis -d

cd wealthynest-api
mvn spring-boot:run
```

### Frontend
```bash
cd wealthynest-web
npm install
cp .env.local.example .env.local   # set NEXT_PUBLIC_API_URL
npm run dev
```

## Features
- JWT auth with refresh token rotation, PIN + WebAuthn/passkey login, native Android biometric unlock
- Expense tracking with categories, search, pagination, splitting (`ExpenseSplit`)
- Monthly budgets with real-time utilisation and shared/family budgets
- Wallet accounts (bank/cash/wallet) and transfers, separate from tracked assets
- Asset tracking — stocks, gold, real estate — and liabilities/debts, both feeding net worth
- Investment portfolio with gain/loss calculation, dividend + bond interest income tracking
- Recurring income, expenses, transfers, and goal contributions
- Bank statement (CSV) and CAS-PDF import for draft expense/transaction review
- Goals (including account-linked goals) and family-shared goals
- Family shared finances via invite codes, shared activity feed, per-member spending chart
- Vault (secure notes/credentials) with TOTP, health checks, and export
- Analytics dashboard, reports (monthly/annual/CSV export)
- In-app + push notifications (Firebase Cloud Messaging) with per-type preferences
- Support tickets/FAQ, admin console, rate limiting, audit logging, Redis caching

## Project Structure
```
wealthynest/
├── wealthynest-api/          Spring Boot 3 REST API
│   ├── domain/         Feature modules (auth, expense, budget, asset, investment,
│   │                   goal, debt, liability, vault, family, statementimport,
│   │                   casimport, expensesplit, recurring*, notification, admin…)
│   ├── common/         Shared security, exceptions, audit, response
│   ├── config/         Security, cache, CORS, rate limit
│   └── resources/db/migration/   Flyway SQL (V1–V50+, see the directory for the current head)
├── wealthynest-web/          Next.js 15 frontend
│   └── src/
│       ├── app/        App Router pages
│       ├── features/   Feature modules (auth, expenses, assets, investments, goals,
│       │               debts, liability, vault, family, statementimport, casimport,
│       │               expensesplits, recurring*, notifications, admin…)
│       ├── components/ Reusable UI (layout, charts, forms, shared)
│       └── lib/        axios, queryClient, utils, constants
├── wealthynest-web/android/  Capacitor Android project (see ANDROID_APP_ROADMAP.md)
└── docker-compose.yml
```

## Further Reading
- `ANDROID_APP_ROADMAP.md` — Capacitor Android app status and release checklist
- `PRODUCTION_PLAN.md` — production readiness status, re-verified against the codebase
- `GROWTH_STRATEGY.md` — growth/monetization strategy and competitive positioning
- `playwright/README.md` — E2E test coverage and phase history
