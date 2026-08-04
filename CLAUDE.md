# WealthyNest — Coding Standards

Monorepo: `wealthynest-api` (Spring Boot 3, Java 21) + `wealthynest-web` (Next.js 15, React 19, TypeScript). These rules apply to all code written or edited in this repo.

## Common commands

Backend (run from `wealthynest-api/`):
- `mvn spring-boot:run` — run API locally against `postgres`/`redis` (needs `docker compose up postgres redis -d` first)
- `mvn compile` — fast compile check
- `mvn test` — full test suite
- `mvn test -Dtest=ClassName#methodName` — single test

Frontend (run from `wealthynest-web/`):
- `npm run dev` — dev server
- `npm run build` — production build
- `npm run lint` — ESLint
- `npm run type-check` — `tsc --noEmit`
- `npm test` — Vitest unit suite (single pass); `npm run test:watch` for watch mode; `npm run test:coverage` for a coverage report

Full stack: `docker compose up -d` (all services); `docker compose up -d --build <service>` to rebuild one.

## Domain glossary

- **Family**: a group of users sharing finances via invite codes; most data (accounts, assets, budgets) is scoped to a family, not just a user.
- **WalletAccount**: a bank/cash/wallet holding (`AccountType`), distinct from an `Asset`. `AccountTransfer` moves money between wallet accounts.
- **Asset**: a tracked holding — stocks, gold, real estate, etc. (`AssetType`) — separate from `WalletAccount` and from `Investment` (portfolio-tracked securities).
- **Liability / Debt**: money owed (`LiabilityType`), tracked separately from `Investment`/`Asset`; has its own due-date and repayment fields.
- **NetWorthSnapshot**: a point-in-time rollup of assets minus liabilities, used for net-worth trend charts.
- **Income domains**: `income` (general), `dividend`, `recurringincome` are separate modules — don't conflate one-off income with recurring or dividend income when adding features.
- **ExpenseSplit**: tracks who owes whom within a shared expense, separate from the base `expense` module.
- **StatementImport**: bank/CSV statement ingestion (`commons-csv`) that creates draft expenses/transactions for review — distinct from manual expense entry.
- Full domain module list lives under `wealthynest-api/src/main/java/com/wealthynest/domain/` (account, admin, analytics, asset, auth, budget, category, debt, dividend, expense, expensesplit, family, goal, income, investment, liability, networth, notification, recurringincome, report, statementimport, support, user).

## Do-not-touch without explicit instruction

- `SecurityConfig`, `JwtAuthenticationFilter`, `JwtProperties`, `SecurityUtils` — auth/security core; changes here have app-wide blast radius.
- Database migration files (Flyway/Liquibase) — never edit an already-applied migration; add a new one.
- `.env`, `.env.example`, `wealthynest-web/.env.local` — may contain or template secrets (`JWT_SECRET`, `MAIL_PASSWORD`, DB creds); don't print their contents into chat or commits.
- `docker-compose.yml` service definitions for `postgres`/`redis`/`tunnel` — only touch if the task is specifically about infra.

## General principles

- **No subagents/Explore agents in this repo.** Do research directly with Read/Grep/Bash yourself instead of delegating to the Agent tool — the user wants to see the research happen inline, not summarized back from a subagent.
- **Reuse before you write.** Before adding a helper, DTO, hook, or component, grep the codebase for an existing one that already does it (backend: `common/`, `infra/util/`; frontend: `src/hooks/`, `src/lib/`, `src/components/ui/`, and the target feature's own `api/hooks/schemas/utils`). Extend or generalize it instead of duplicating. If you find near-duplicate logic while working nearby, flag it rather than adding a third copy.
- **No premature abstraction.** Don't introduce an interface, base class, generic hook, or config flag for a single use site. Three real call sites justify an abstraction; one or two don't.
- **Minimal diffs.** Touch only what the task requires. Don't reformat, rename, or refactor unrelated code in the same change.
- **No dead code.** Delete unused params, imports, methods, and commented-out blocks rather than leaving them "just in case."
- **Fail loud at boundaries, trust internals.** Validate/sanitize at API boundaries (controller input, external responses). Don't re-validate data that's already guaranteed by the type system or a prior layer.
- **Comments explain why, not what.** Skip comments that restate the code. Only comment non-obvious constraints, workarounds, or invariants.
- **Don't propagate deprecated APIs.** Before copying an existing pattern in this repo, check whether it's marked `@Deprecated` (IDE strikethrough is the fast signal) — an existing usage isn't proof it's still current, just proof it hasn't been migrated yet. Use the replacement instead of extending the deprecated one to a new call site. See the testing sections below for the two migrations already done in this repo (`@MockitoBean`, native Vite tsconfig-paths resolution) as the reference pattern for what "current" means here.

## wealthynest-api (Spring Boot / Java 21)

- **Layering**: Controller → Service (interface + impl) → Repository. Controllers stay thin — no business logic, only request/response mapping and delegation.
- **DTOs, not entities, cross the API boundary.** Never return JPA entities directly from a controller; map through a response DTO (see existing `AssetMapper`-style mapper pattern).
- **Reuse mappers.** Use MapStruct/manual mapper classes consistently instead of ad-hoc field copying scattered across services.
- **Transactions**: `@Transactional` at the service layer, scoped to the smallest boundary that needs atomicity. Don't wrap read-only queries in a write transaction — use `@Transactional(readOnly = true)`.
- **Validation**: use `jakarta.validation` annotations on request DTOs; don't hand-roll null checks for things Bean Validation already covers.
- **Security**: never bypass `SecurityUtils`/`JwtAuthenticationFilter` conventions already in place. All family-scoped or user-scoped queries must filter by the authenticated user/family — check existing repository query patterns before adding a new one.
- **Repositories**: prefer derived query methods or `@Query` with named params over building queries in Java strings. Avoid N+1s — use fetch joins or `@EntityGraph` where a list endpoint touches associations.
- **Exceptions**: throw the project's existing custom exceptions (`BusinessException`, `ResourceNotFoundException`, `AccessDeniedException` in `common/exception/`) — not generic `RuntimeException` — so `GlobalExceptionHandler` can map them to proper HTTP responses. Add a new exception type only if none of the existing ones fit.
- **Migrations**: schema changes go through Flyway/Liquibase migration files (whichever this repo uses) — never rely on Hibernate `ddl-auto` for anything beyond local dev.
- **Testing (Spring Boot 3.4+/6.2)**: use `@MockitoBean`/`@MockitoSpyBean` (`org.springframework.test.context.bean.override.mockito`) in `@WebMvcTest`/`@SpringBootTest` classes — **not** `@MockBean`/`@SpyBean` (`org.springframework.boot.test.mock.mockito`), deprecated since Boot 3.4 and removed in a future major. Plain Mockito unit tests (`@ExtendWith(MockitoExtension.class)`, `@Mock`/`@InjectMocks`) are unaffected — this only applies to Spring-context-integrated mocks. See `testsupport/` for the established `@WebMvcTest` + real-`SecurityConfig` pattern and `integration/` for full `@SpringBootTest` + Testcontainers flows; both already use current APIs — copy from there, not from an older controller test that predates this migration.

## wealthynest-web (Next.js 15 / React 19 / TypeScript)

- **Strict typing.** No `any`. Derive types from Zod schemas (`z.infer`) where a schema already exists instead of hand-writing a parallel interface.
- **Server/client boundary.** Default to Server Components; add `"use client"` only when the component needs state, effects, or browser APIs.
- **Data fetching**: use TanStack Query for server state — don't roll ad-hoc `useEffect` + `fetch` + `useState` fetch logic. Co-locate query keys and reuse them instead of restringing key arrays.
- **Forms**: use `react-hook-form` + `zod` resolver, matching the pattern already used elsewhere in the app — don't hand-manage form state with `useState` per field.
- **Styling**: Tailwind utility classes; use `clsx`/`tailwind-merge` for conditional class composition instead of manual string concatenation. Reuse existing `src/components/ui/` primitives (`Button`, `Card`, `Modal`, `Tooltip`, etc.) rather than styling one-offs.
- **Cross-feature utils**: formatting/meta helpers (amount formatting, account/category/investment type metadata, chart colors) already live in `src/lib/` and `src/hooks/` — reuse or extend them instead of re-deriving the same formatting logic inside a feature module.
- **State**: local component state first, Zustand only for state genuinely shared across distant components. Don't add a new store for something one component tree needs.
- **Components**: keep presentational components free of data-fetching; fetch in a parent/page and pass props, or use a query hook — don't fetch inside deeply nested leaf components.
- **Error/loading states**: every query/mutation that hits the API must handle loading and error states in the UI — no silent failures.
- **Testing**: Vitest + React Testing Library, config in `vitest.config.ts`/`vitest.setup.ts`. Path aliases (`@/*`) resolve via Vite's **native** `resolve.tsconfigPaths: true` — don't add the separate `vite-tsconfig-paths` plugin back, Vite's own tooling flags it as redundant now. Co-locate test files (`Foo.ts` → `Foo.test.ts`). For a zod schema, test it as a pure function (`schema.safeParse(input)`) — no component render needed. For a TanStack Query hook, mock the feature's `*.api.ts` module (not `@/lib/axios` — that has real interceptor logic out of scope for a hook test) and `sonner`, then use `createQueryClientWrapper()` from `src/test-utils/queryClientWrapper.tsx` with `renderHook`; assert exactly which `QUERY_KEYS` a mutation invalidates on success (and none on failure) — that's the most valuable thing a mutation-hook test checks.

## Before considering a change done

**Every change or enhancement — new feature, bug fix, refactor with behavior impact — must ship with test cases covering it, on whichever side(s) it touches.** This applies even when not explicitly asked for; "add X" or "fix Y" implicitly includes "and test it." Passing the *existing* suite isn't enough — if the change adds or alters behavior, add or update the test(s) that exercise it before considering the work done:
- **Backend**: a new/changed service method, controller endpoint, or non-trivial branch needs a corresponding unit test (`@ExtendWith(MockitoExtension.class)`) and, for a new endpoint, a `@WebMvcTest` controller test — see the `Testing` bullet under `wealthynest-api` below for the current patterns (`testsupport/`, `@MockitoBean`).
- **Frontend**: a new/changed hook, zod schema, or pure util needs a co-located `*.test.ts(x)` — see the `Testing` bullet under `wealthynest-web` below. (Component render tests aren't yet an established pattern in this repo — stick to hook/schema/util-level tests matching what's already there rather than introducing a new testing style unprompted.)
- **E2E (Playwright)**: a new or materially changed **user-facing flow** — a new page, a new critical action (money movement, auth, investment/account CRUD), or a fix to a flow that was actually broken end-to-end — needs a spec added or updated under `playwright/tests/`. Reuse the existing page-object pattern (`playwright/pages/`) and check `playwright/README.md` first for current phase/coverage status and conventions before adding a new spec file. Don't add an E2E spec for every small change — reserve it for flow-level behavior; unit/controller tests already cover logic-level changes. The suite runs nightly + on-demand (`.github/workflows/e2e-nightly.yml`), not on every PR, so it won't block a merge — but a shipped flow change without an updated spec silently rots the suite's coverage.
- Skip all of this only for changes with no testable behavior (pure formatting/typo fixes, config/docs-only edits) — use judgment, but default to adding the test.
- `mvn test` (backend) and `npm test` (frontend) both run in CI (`.github/workflows/backend-ci.yml` / `frontend-ci.yml`) and gate merges to `main`; Playwright runs nightly/on-demand and does not gate merges. An untested change that breaks something won't be caught until CI (or the next nightly E2E run) does — later and more expensively than catching it now.

A task is not complete until the affected app has been rebuilt and restarted via Docker — not just compiled locally. Scope this to whichever side you touched:

- **Backend changes** (`wealthynest-api`): run `mvn compile` (or `mvn -pl wealthynest-api compile`) to catch errors fast, then rebuild and restart only that service:
  `docker compose up -d --build wealthynest-api`
- **Frontend changes** (`wealthynest-web`): run `npm run type-check`, `npm run lint`, and `npm test` inside `wealthynest-web` first, then rebuild and restart only that service:
  `docker compose up -d --build wealthynest-web`
- **Changes touching both**: rebuild and restart both services (`docker compose up -d --build wealthynest-api wealthynest-web`).
- Don't rebuild/restart services you didn't touch — e.g. don't restart `wealthynest-web` for an API-only change, and don't touch `postgres`/`redis`/`tunnel` unless the task specifically changed them.
- After restart, confirm the container is healthy (`docker compose ps`) and check logs for startup errors (`docker compose logs -f <service> --tail 50`) before reporting the task as done.
- No leftover debug logging, commented-out code, or TODO without an owner.
- If you touched a shared component, hook, service, or util, check other call sites weren't broken.

## Commit and push once verified

Once the Docker rebuild/restart above confirms the container is healthy and the relevant tests
(unit/controller, and Playwright where one was added or updated) pass, commit the change and push
it to the current branch's remote — don't stop at "ready to commit" and wait for a separate
go-ahead; this section *is* that go-ahead, standing for every change that reaches this point.
- Commit with a descriptive message per the usual convention (see the Git Safety Protocol/commit
  instructions already governing this session) — summarize the *why*, stage only the files the
  task actually touched.
- Push to the current branch's tracking remote (`git push`, no explicit remote/branch juggling
  needed on an already-tracked branch). Never force-push, never push straight to `main`, never
  skip hooks (`--no-verify`) or bypass signing.
- This still doesn't cover destructive or irreversible git operations outside a normal
  commit+push (`reset --hard`, force-push, rewriting published history, deleting branches) —
  those still need explicit confirmation every time, same as always.
- If the rebuild/restart didn't come back healthy, or a test that should've been added wasn't,
  fix that first — don't commit a change that hasn't actually cleared the bar above.
