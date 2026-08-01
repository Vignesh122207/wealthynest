# WealthyNest — Dependency Upgrade Plan

## Why this exists

Node 20 (the `wealthynest-web` Dockerfile's base image) reached end-of-life on 2026-04-30, already
unsupported by the time it was caught. That prompted a broader "what else is stale" pass, which
turned up a second, bigger one: **Spring Boot's entire 3.5 line went open-source EOL on
2026-06-30** — `wealthynest-api` was on it. Rather than fix these two and stop, the decision was
to systematically get the whole stack (frontend + backend) to latest stable, phased by actual
researched risk rather than blanket caution — some things assumed risky turned out low-risk once
measured against this codebase's real usage; a couple assumed safe turned out to be genuinely
blocked upstream.

**Working rule for this initiative**: no version bump lands without running this repo's real
verification — `mvn test` / `npm run type-check && npm run lint && npm test && npm run build` —
and, for anything touching the Docker images, an actual `docker compose up -d --build` + health
check. Assumptions get corrected the moment the verification contradicts them (see the
`@hookform/resolvers` note in Phase 1 below — that one looked safe on paper and wasn't).

## Status at a glance

| Phase | Status | What |
|---|---|---|
| 0 | ✅ Done (`2a8a153`) | Zero-risk patch/minor bumps, both sides |
| 1 | ✅ Done (`2a8a153`) | Self-contained majors, verified by automated suite alone |
| 2 | ⏳ Not started | Tailwind CSS 4, Zod 4 + `@hookform/resolvers` 5, deferred lint cleanup — needs a live browser click-through before shipping |
| 3 | 🚫 Blocked upstream | ESLint 10, TypeScript 7 — do not attempt, see conditions below |
| 4 | 🔭 Separate initiative | Spring Boot 4 — touches `SecurityConfig`, needs its own dedicated session + explicit go-ahead |

Node itself: 20 (EOL) → 24 "Krypton" LTS, and Next.js 15 → 16, were done in the *previous*
initiative (before this plan existed) — see git history around commit `2edc962` for that one if
it's ever relevant; not tracked here since it's already complete and this doc starts from the
"what else can be upgraded" follow-up.

## Phase 0 — zero-risk patch/minor (done)

**Backend** (`wealthynest-api/pom.xml`):
- `spring-boot-starter-parent` 3.5.14 → 3.5.16 (same minor line, the last patch before EOL)
- `postgresql` 42.7.10 → 42.7.13, `h2` (test) 2.3.232 → 2.4.240 — both pinned explicitly since
  Spring Boot 3.5.16's own BOM only carries postgresql to 42.7.11
- `commons-csv` 1.12.0 → 1.14.1, `google-api-client` 2.8.0 → 2.9.0, `firebase-admin` 9.4.1 →
  9.10.0, `webauthn4j-core` 0.29.1 → 0.31.8

**Frontend** (`wealthynest-web/package.json`):
- `@capacitor/android`, `@capacitor/cli`, `@capacitor/core` 8.4.2 → 8.5.0

## Phase 1 — self-contained majors, verified by the automated suite (done)

1. **`lucide-react` 0.454 → 1.28.0** — 186 import sites, but the whole upgrade turned out to be
   zero-breakage: a clean `tsc --noEmit` across the codebase confirmed no icon this repo actually
   imports was renamed or removed (v1.0 did rename/remove some icons and all brand-logo icons, but
   none of the ones used here).
2. **`sonner` 1.7 → 2.0** — only `<Toaster position=... theme=...>` (`ThemedToaster.tsx`) plus
   plain `toast.success()/error()` calls; both stable across the major.
3. **`@testing-library/jest-dom` 6.9 → 7.0**, **`jsdom` 29.1 → 30.0** — test-only, zero production
   exposure.
4. **`tailwind-merge` 2.6 → 3.6** — single integration point, `cn()` in `src/lib/utils.ts`.
5. **Backend: `flyway-core`/`flyway-database-postgresql` 12.6.2 → 13.1.0** — checked this repo's
   Flyway config (`application.yml`/`-prod.yml`: only `enabled`, `locations`,
   `baseline-on-migrate`, `validate-on-migrate`) against v13's removed/renamed options (`initSQL`
   removed, `createSchema` callback renamed) — neither applies here. Verified migrations still
   apply cleanly against real Postgres (`flyway_schema_history` unchanged at version 54).
6. **Backend: `google-http-client-gson` 1.47.0 → 2.2.0** (major) — used only via
   `GsonFactory.getDefaultInstance()` in `GoogleAuthConfig`. Verified with the full
   `AuthServiceImplTest` `googleLogin`/`googleLoginNative`/`googleLoginPopup` suites (17 tests) and
   a real container boot with no startup errors.

**Also fixed along the way**: the Capacitor 8.5.0 bump pulled in a newly-vulnerable `uuid@7` via
`xcode` (iOS Xcode-project tooling — this app is Android-only, `xcode` is never actually invoked).
Scoped-overridden in `package.json`: `overrides.xcode.uuid: "^11.1.1"` — same pattern as the
pre-existing `overrides.minimatch.brace-expansion` fix from the prior Next.js upgrade (see that
commit, `2edc962`, for the full reasoning on why a *scoped* override is needed instead of a
blanket one: forcing a new major onto an old transitive consumer that expects the old API shape
breaks it outright, which is exactly what happened — and got caught — with `minimatch@3.1.5` and
`brace-expansion@5.x` previously).

**Correction made mid-execution** — worth remembering as a lesson, not just a line item:
`@hookform/resolvers` 3.10 → 5.5.7 looked like a safe, independent bump — its peer range
(`zod: '^3.25.0 || ^4.0.0'`) already accepted this repo's Zod 3.25, and the `zodResolver` import
path is unchanged in 5.x. **Peer-range compatibility is not type compatibility.** Once actually
installed, `tsc` failed across 7+ form files (`accounts/page.tsx`, `budgets/page.tsx`,
`BudgetDetailModal.tsx`, `BondForm.tsx`, `FDForm.tsx`, `MFForm.tsx`, …) — `zodResolver`'s generic
signature in 5.x assumes Zod 4's stricter optional-field inference, and doesn't line up with
Zod-3-shaped schemas. Reverted to 3.10.0; this bump now belongs in **Phase 2**, done together with
the Zod 4 migration (the type shapes need review together anyway).

## Phase 2 — needs live visual verification before shipping (not started)

1. **Tailwind CSS 3.4 → 4.3** + `postcss.config.mjs` (swap the `tailwindcss` plugin for
   `@tailwindcss/postcss`, drop `autoprefixer` — v4 handles vendor-prefixing itself). Run the
   official `npx @tailwindcss/upgrade` codemod first — it converts `tailwind.config.ts`'s
   `theme.extend` into CSS `@theme` directives in `globals.css` and rewrites renamed utilities.
   Concretely measured exposure in this repo (re-check counts if time has passed and more UI was
   added): 49× `shadow-sm`→`shadow-xs`, 1× `shadow`→`shadow-sm`, 1× `rounded-sm`→`rounded-xs`,
   **zero** bare `ring`, **zero** bare `border` without an explicit color (the risky
   default-border-color change from `gray-200` to `currentColor` doesn't apply here), zero
   Tailwind plugins, zero Sass. Genuinely tractable — but a passing build/type-check does not prove
   pixels look right, and this app leans on custom shadows/gradients throughout. **Do not ship
   without an actual click-through**: dashboard, forms, auth pages, dark/light mode, the copper
   `brand-*` gradient buttons. Needs the Claude-in-Chrome extension connected.
2. **Zod 3.25 → 4.4** (15 files use it directly) **+ `@hookform/resolvers` 3.10 → 5.5.7 together**
   (see the Phase 1 correction above for why these move as a pair). Breaking changes: error shape
   (`.issues` vs the old `.errors` alias), some method renames (`z.string().email()` →
   `z.email()`). Go schema-by-schema — this repo already unit-tests every zod schema
   (`*.schema.test.ts`) per its own testing convention — running each schema's test plus its form's
   hook/RTL test.
3. **Finish the deferred React-Compiler-readiness lint cleanup** — 44 findings across ~48 files
   (`react-hooks/set-state-in-effect`, `purity`, `static-components`, `refs`, `immutability`),
   currently downgraded to `warn` in `eslint.config.mjs` (from the Next.js 16 upgrade, commit
   `2edc962`) rather than fixed. Bundling with the Tailwind pass makes sense — both touch
   component render/effect code and need the same "look at it running" verification.

**Verify**: full automated suite, then a live browser pass — login/signup/reset-password,
dashboard home, at least one CRUD form (e.g. add expense), Settings > Security, dark mode toggle.

## Phase 3 — blocked upstream, do not attempt (monitor only)

- **ESLint 9 → 10**: confirmed broken, not just untested — hit an actual runtime crash
  (`scopeManager.addGlobals is not a function`) when `eslint-config-next@16`'s plugin chain
  (`typescript-eslint`) ran under ESLint 10, during the Next.js 16 upgrade session. Revisit once
  `eslint-config-next` ships a version whose plugin chain actually supports ESLint 10 — check by
  bumping in a throwaway branch and running `npm run lint`; if it doesn't crash, re-run the full
  Phase 3 evaluation, don't just assume it's fixed.
- **TypeScript 5.9 → 7.0**: `typescript-eslint` closed TS7 support as "not planned" as of TS 7.0
  GA (2026-07-08) — TS 7.0 shipped with no stable programmatic API, which is what
  `typescript-eslint`/`ts-morph`/template type-checkers need. A stable API is expected in TS 7.1.
  Revisit once 7.1 ships and `typescript-eslint` confirms support (check their GitHub issue
  tracker for the TS7 support request, or just try it in a throwaway branch the same way).

## Phase 4 — Spring Boot 3.5 → 4.1.0 (separate initiative, needs explicit go-ahead)

Different scale of change from everything above — do not fold into a routine bump:

- Spring Framework 7, Hibernate 7, Jackson 3 (removed annotations, stricter type handling) all
  come along via the parent POM bump.
- **Spring Security 7 changes CSRF defaults** — lands directly on `SecurityConfig` /
  `JwtAuthenticationFilter`, which `CLAUDE.md` explicitly flags as do-not-touch-without-explicit-
  instruction, "changes here have app-wide blast radius." This alone means Phase 4 needs its own
  deliberate go-ahead before any exploration turns into edits.
- New modular starter POMs mean the dependency list needs restructuring, not just version bumps.
- Java 21 stays sufficient as the minimum (Spring Boot 4 requires Java 21+, no forced JDK bump).

When ready: start a dedicated session that reads the official Spring Boot 4.0 migration guide
end-to-end against this specific `SecurityConfig`/`JwtAuthenticationFilter`/`AuthServiceImpl` and
produces its own focused plan.

## Continuing this later

This doc is the source of truth for where the initiative stands — update the status table and the
relevant phase section as work lands, the same way this file was written. If a phase's "not
viable yet" reasoning (Phase 3) needs re-checking, do the actual check (throwaway branch, real
`npm run lint`/`build`) rather than assuming either "still blocked" or "probably fine by now."
