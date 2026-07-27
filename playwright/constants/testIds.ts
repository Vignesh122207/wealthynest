// Single source of truth for data-testid values added to wealthynest-web for this suite.
// Keep in sync with the frontend — grep the value here before renaming/removing a testid there.
export const TEST_IDS = {
  nav: {
    logout: "nav-logout",
    link: (href: string) => `nav-link-${href.replace(/^\//, "")}`,
    mobileMenuToggle: "mobile-menu-toggle",
  },
  header: {
    title: "page-header-title",
  },
  login: {
    continueWithEmailButton: "login-continue-with-email-button",
    passwordStepEmail:     "login-password-step-email-input",
    passwordStepPassword:  "login-password-step-password-input",
    passwordSubmit:        "login-password-submit",
    backButton:            "login-back-button",
    emailError:            "login-email-error",
    pinInput:               "login-pin-input",
    pinSubmit:              "login-pin-submit",
    pinUsePassword:         "login-pin-use-password",
    // A real custom button now (see GoogleSignInButton.tsx), not a container wrapping a
    // GIS-rendered iframe — renamed from googleContainer to match.
    googleButton:           "google-signin-web-button",
  },
  appLock: {
    pinInput:         "applock-pin-input",
    pinSubmit:         "applock-pin-submit",
    // Unified button — native's own BiometricPrompt or a passkey ceremony, whichever this account/
    // platform actually has (see AppLockScreen.tsx's own comment on fingerprintAvailable).
    fingerprintButton: "applock-fingerprint-button",
    // Only ever rendered on the passkey (web) path, and only after a failed attempt — see
    // AppLockScreen.tsx's own comment on why WebAuthn can't detect this ahead of time.
    dismissPasskey:    "applock-dismiss-passkey",
  },
  signup: {
    continueWithEmailButton: "signup-continue-with-email-button",
    fullNameInput:        "signup-fullName-input",
    emailInput:           "signup-email-input",
    passwordInput:        "signup-password-input",
    confirmPasswordInput: "signup-confirm-password-input",
    submit:               "signup-submit",
  },
  fab: {
    toggle:        "fab-toggle",
    addAccount:    "fab-add-account",
    addExpense:    "fab-add-expense",
    addIncome:     "fab-add-income",
    addTransfer:   "fab-add-transfer",
    addBudget:     "fab-add-budget",
    addGoal:       "fab-add-goal",
    addFd:         "fab-add-fd",
    addGold:       "fab-add-gold",
    addStock:      "fab-add-stock",
    addMf:         "fab-add-mf",
    addBond:       "fab-add-bond",
    addDebtLent:     "fab-add-debt-lent",
    addDebtBorrowed: "fab-add-debt-borrowed",
    addCurrentTab: "fab-add-current-tab",
    addAsset:      "fab-add-asset",
    addLiability:  "fab-add-liability",
    addRecurringIncome:   "fab-add-recurring-income",
    addRecurringExpense:  "fab-add-recurring-expense",
    addRecurringTransfer: "fab-add-recurring-transfer",
    addRecurringGoal:     "fab-add-recurring-goal",
    addVaultItem:         "fab-add-vault-item",
    importCas:            "fab-import-cas",
  },
  typeTab: (key: "all" | "expenses" | "income" | "transfers") => `type-tab-${key}`,
  account: {
    typeButton: (type: string) => `account-type-${type}`,
    bankNameInput: "bank-name-input",
    formSubmit: "account-form-submit",
  },
  expenseForm: {
    accountPickerTrigger:  "expense-account-picker-trigger",
    accountPickerOption:   (id: string) => `expense-account-picker-option-${id}`,
    categoryPickerTrigger: "expense-category-picker-trigger",
    categoryPickerPanel:   "expense-category-picker-panel",
    submit:                "expense-form-submit",
  },
  incomeForm: {
    accountPickerTrigger: "income-account-picker-trigger",
    accountPickerPanel:   "income-account-picker-panel",
    sourcePickerTrigger:  "income-source-picker-trigger",
    sourcePickerPanel:    "income-source-picker-panel",
    submit:               "income-form-submit",
  },
  transferForm: {
    fromAccountTrigger: "transfer-from-account-picker-trigger",
    fromAccountPanel:   "transfer-from-account-picker-panel",
    toAccountTrigger:   "transfer-to-account-picker-trigger",
    toAccountPanel:     "transfer-to-account-picker-panel",
    submit:             "transfer-form-submit",
  },
  budgetForm: {
    categoryPickerTrigger: "budget-category-picker-trigger",
    categoryPickerPanel:   "budget-category-picker-panel",
    submit:                "budget-form-submit",
  },
  goalForm: {
    submit: "goal-form-submit",
  },
  investmentForm: {
    submit: "investment-form-submit",
  },
  confirmDialog: {
    confirm: "confirm-dialog-confirm",
    cancel:  "confirm-dialog-cancel",
  },
  profile: {
    // Danger zone (Sign out / Close account) lives on Profile, not Settings — see profile/page.tsx.
    signoutTrigger:     "profile-signout-trigger",
    closeAccountTrigger: "profile-close-account-trigger",
  },
  asset: {
    nameInput:      "asset-name-input",
    typeSelect:     "asset-type-select",
    valueInput:     "asset-current-value-input",
    submit:         "asset-form-submit",
  },
  liability: {
    nameInput:         "liability-name-input",
    typeSelect:        "liability-type-select",
    outstandingInput:  "liability-outstanding-input",
    submit:            "liability-form-submit",
  },
  analytics: {
    monthPrev:  "analytics-month-prev",
    monthNext:  "analytics-month-next",
    monthLabel: "analytics-month-label",
  },
  reports: {
    tab: (id: "monthly" | "annual" | "export") => `reports-tab-${id}`,
    monthlyCsv:   "monthly-report-csv-button",
    monthlyPdf:   "monthly-report-pdf-button",
    monthlyYear:  "monthly-report-year-select",
    monthlyMonth: "monthly-report-month-select",
    annualCsv:  "annual-report-csv-button",
    annualPdf:  "annual-report-pdf-button",
    annualYear: "annual-report-year-select",
    exportCsv: (key: string) => `export-csv-${key}`,
  },
} as const;
