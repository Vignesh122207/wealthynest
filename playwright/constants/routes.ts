// Mirrors wealthynest-web/src/components/layout/Sidebar.tsx NAV_GROUPS hrefs — kept as plain
// string constants (not imported from the app) since this package doesn't depend on the web
// package's build; update alongside the Sidebar if a route ever moves.
export const ROUTES = {
  login:              "/login",
  signup:             "/signup",
  forgotPassword:     "/forgot-password",
  home:               "/home",
  accounts:           "/accounts",
  transactions:       "/expenses",
  budgets:            "/budgets",
  goals:              "/goals",
  debts:              "/debts",
  investments:        "/investments",
  netWorth:           "/assets",
  analytics:          "/analytics",
  family:             "/family",
  reports:            "/reports",
  notifications:      "/notifications",
  settings:           "/settings",
  settingsRecurring:  "/settings/recurring",
  settingsSupportContact: "/settings/support/contact",
  settingsSupportFaq:     "/settings/support/faq",
  settingsSupportTickets: "/settings/support/tickets",
  supportWealthyNest: "/support-wealthynest",
  vault:               "/vault",
  admin:              "/admin",
} as const;

/** Every authenticated dashboard route worth a breakpoint/horizontal-overflow check, as a plain
 * array for the responsive suites' `for (const route of ...)` loops. Excludes login/signup/
 * forgotPassword (pre-auth, don't share DashboardLayout's chrome — see responsive.spec.ts's own
 * login/signup check instead) and admin (role-gated; a non-admin regressionUser gets redirected to
 * /home before ever reaching the real admin page — see admin.spec.ts for that page's own
 * coverage). Shared by responsive.spec.ts/tablet.spec.ts/tablet-portrait.spec.ts/
 * narrow-desktop.spec.ts so all four breakpoints check the same full page set instead of each
 * hand-maintaining its own partial list. */
export const DASHBOARD_ROUTES: readonly string[] = [
  ROUTES.home, ROUTES.accounts, ROUTES.transactions, ROUTES.budgets, ROUTES.goals, ROUTES.debts,
  ROUTES.investments, ROUTES.netWorth, ROUTES.analytics, ROUTES.family, ROUTES.reports,
  ROUTES.notifications, ROUTES.settings, ROUTES.settingsRecurring, ROUTES.settingsSupportContact,
  ROUTES.settingsSupportFaq, ROUTES.settingsSupportTickets, ROUTES.supportWealthyNest, ROUTES.vault,
];
