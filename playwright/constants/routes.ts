// Mirrors wealthynest-web/src/components/layout/Sidebar.tsx NAV_GROUPS hrefs — kept as plain
// string constants (not imported from the app) since this package doesn't depend on the web
// package's build; update alongside the Sidebar if a route ever moves.
export const ROUTES = {
  login:              "/login",
  signup:             "/signup",
  forgotPassword:     "/forgot-password",
  dashboard:          "/dashboard",
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
