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
- JWT auth with refresh token rotation
- Expense tracking with categories, search, pagination
- Monthly budgets with real-time utilisation
- Asset tracking — bank, cash, stocks, gold, real estate
- Investment portfolio with gain/loss calculation
- Dividend + bond interest income tracking
- Family shared finances via invite codes
- Analytics dashboard
- Rate limiting, audit logging, Redis caching

## Project Structure
```
wealthynest/
├── wealthynest-api/          Spring Boot 3 REST API
│   ├── domain/         Feature modules (auth, expense, budget, asset…)
│   ├── common/         Shared security, exceptions, audit, response
│   ├── config/         Security, cache, CORS, rate limit
│   └── resources/db/migration/   Flyway SQL (V1–V7)
├── wealthynest-web/          Next.js 15 frontend
│   └── src/
│       ├── app/        App Router pages
│       ├── features/   Feature modules (auth, expenses, assets…)
│       ├── components/ Reusable UI (layout, charts, forms, shared)
│       └── lib/        axios, queryClient, utils, constants
└── docker-compose.yml
```
