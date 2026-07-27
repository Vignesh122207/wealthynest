# WealthyNest Web

Next.js 15 frontend for the WealthyNest personal finance platform.

## Tech Stack
- Next.js 15 (App Router), TypeScript strict
- Tailwind CSS, dark/light theme
- TanStack Query v5, Zustand v5
- React Hook Form + Zod
- Axios with JWT refresh interceptor
- Recharts, Sonner toasts

## Setup

```bash
npm install
cp .env.local.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1
npm run dev
```

App → http://localhost:3000

## Architecture

```
src/
├── app/                  Next.js App Router
│   ├── (auth)/           Login, signup
│   ├── (dashboard)/      Authenticated pages + sidebar
│   └── page.tsx          Landing page
├── features/             Feature modules (each: API, hooks, schemas, types)
│   ├── auth/             store, API, hooks, components, schemas
│   ├── dashboard/, analytics/, reports/
│   ├── accounts/, expenses/, expensesplits/, budgets/
│   ├── assets/, liability/, debts/, networth/, investments/
│   ├── goals/, recurringIncome/, recurringTransfer/, recurringGoalContribution/
│   ├── statementimport/, casimport/
│   └── family/, vault/, notifications/, support/, admin/
├── components/
│   ├── layout/           Sidebar, Header, MobileNav, PageWrapper
│   ├── charts/           AreaChart, BarChart, DonutChart
│   ├── shared/           StatCard, DataTable, EmptyState, Skeleton
│   └── forms/            FormInput, FormSelect, FormCurrencyInput
├── lib/                  axios, queryClient, utils, constants
├── hooks/                useDebounce, useMediaQuery, usePagination
└── types/                api.types, common.types
```

## Commands
```bash
npm run dev          # Development
npm run build        # Production build
npm run type-check   # TypeScript check
npm run lint         # ESLint
npm test             # Vitest unit suite
```

## Android

`android/` is a generated Capacitor project (server-mode WebView against the deployed site) —
see `../ANDROID_APP_ROADMAP.md` for status and the release checklist.
