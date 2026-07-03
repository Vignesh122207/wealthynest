export const QUERY_KEYS = {
  AUTH_ME:        ["auth", "me"]             as const,
  DASHBOARD:      ["analytics", "dashboard"] as const,
  EXPENSES:       ["expenses"]               as const,
  CATEGORIES:     ["categories"]             as const,
  BUDGETS:        ["budgets"]                as const,
  ACCOUNTS:       ["accounts"]               as const,
  TRANSFERS:      ["accounts", "transfers"]  as const,
  ASSETS:         ["assets"]                as const,
  NET_WORTH:      ["assets", "net-worth"]   as const,
  LIABILITIES:    ["liabilities"]           as const,
  NET_WORTH_SUMMARY: ["net-worth", "summary"] as const,
  INVESTMENTS:    ["investments"]            as const,
  DIVIDENDS:      ["dividends"]              as const,
  BOND_INTERESTS: ["bond-interests"]         as const,
  NOTIFICATIONS:  ["notifications"]          as const,
  FAMILY:         ["family"]                 as const,
  GOALS:          ["goals"]                  as const,
} as const;

export const INDIAN_BANKS = [
  "State Bank of India",
  "HDFC Bank",
  "ICICI Bank",
  "Axis Bank",
  "Kotak Mahindra Bank",
  "Punjab National Bank",
  "Bank of Baroda",
  "Canara Bank",
  "Yes Bank",
  "IndusInd Bank",
  "Federal Bank",
  "IDFC First Bank",
  "Union Bank of India",
  "Indian Bank",
  "Bank of India",
  "Bandhan Bank",
  "AU Small Finance Bank",
  "South Indian Bank",
  "RBL Bank",
  "UCO Bank",
];

export const PAYMENT_METHODS = [
  { value: "UPI",         label: "UPI" },
  { value: "CASH",        label: "Cash" },
  { value: "CREDIT_CARD", label: "Credit Card" },
  { value: "DEBIT_CARD",  label: "Debit Card" },
  { value: "NET_BANKING", label: "Net Banking" },
  { value: "OTHER",       label: "Other" },
];

// Physical / non-investment asset types — distinct from the Investments tab
export const ASSET_TYPES = [
  { value: "REAL_ESTATE",    label: "Real Estate" },
  { value: "VEHICLE",        label: "Vehicle" },
  { value: "GOLD_JEWELRY",   label: "Gold & Jewelry" },
  { value: "EPF_PPF",        label: "EPF / PPF" },
  { value: "BUSINESS_EQUITY",label: "Business Equity" },
  { value: "RECEIVABLES",    label: "Receivables" },
  { value: "OTHER",          label: "Other" },
];

export const LIABILITY_TYPES = [
  { value: "HOME_LOAN",      label: "Home Loan" },
  { value: "CAR_LOAN",       label: "Car Loan" },
  { value: "PERSONAL_LOAN",  label: "Personal Loan" },
  { value: "CREDIT_CARD",    label: "Credit Card" },
  { value: "EDUCATION_LOAN", label: "Education Loan" },
  { value: "BUSINESS_LOAN",  label: "Business Loan" },
  { value: "OTHER",          label: "Other" },
];

export const INVESTMENT_TYPES = [
  { value: "STOCK",       label: "Stock" },
  { value: "MUTUAL_FUND", label: "Mutual Fund" },
  { value: "BOND",        label: "Bond" },
  { value: "FD",          label: "Fixed Deposit" },
  { value: "PPF",         label: "PPF" },
  { value: "NPS",         label: "NPS" },
  { value: "GOLD_ETF",    label: "Gold ETF" },
  { value: "REIT",        label: "REIT" },
  { value: "OTHER",       label: "Other" },
];

export const INCOME_SOURCES = [
  { value: "SALARY",    label: "Salary" },
  { value: "FREELANCE", label: "Freelance" },
  { value: "BUSINESS",  label: "Business Income" },
  { value: "RENTAL",    label: "Rental Income" },
  { value: "BONUS",     label: "Bonus" },
  { value: "INTEREST",  label: "Interest" },
  { value: "DIVIDEND",  label: "Dividend" },
  { value: "OTHER",     label: "Other" },
];

export const INCOME_SOURCE_ICONS: Record<string, string> = {
  SALARY:    "💼",
  FREELANCE: "💻",
  BUSINESS:  "🏢",
  RENTAL:    "🏠",
  BONUS:     "🎁",
  INTEREST:  "🏦",
  DIVIDEND:  "📈",
  OTHER:     "💰",
};

export const INCOME_PAYMENT_MODES = [
  { value: "BANK_ACCOUNT", label: "Bank Account" },
  { value: "CASH",         label: "Cash" },
];

export const INCOME_PAYMENT_MODE_ICONS: Record<string, string> = {
  BANK_ACCOUNT: "🏦",
  CASH:         "💵",
};

export const INCOME_PAYMENT_MODE_COLORS: Record<string, string> = {
  BANK_ACCOUNT: "#6366f1",
  CASH:         "#22c55e",
};

export const INCOME_PAYMENT_MODE_LABELS: Record<string, string> = {
  BANK_ACCOUNT: "Bank Account",
  CASH:         "Cash",
};

export const INCOME_SOURCE_COLORS: Record<string, string> = {
  SALARY:    "#22c55e",
  FREELANCE: "#06b6d4",
  BUSINESS:  "#8b5cf6",
  RENTAL:    "#f59e0b",
  BONUS:     "#ec4899",
  INTEREST:  "#3b82f6",
  DIVIDEND:  "#10b981",
  OTHER:     "#6b7280",
};

export const ASSET_ICONS: Record<string, string> = {
  // Legacy
  BANK_ACCOUNT: "🏦", CASH: "💵", STOCK: "📈", MUTUAL_FUND: "💼", BOND: "🏛️", GOLD: "🥇",
  // Active physical categories
  REAL_ESTATE:     "🏠",
  VEHICLE:         "🚗",
  GOLD_JEWELRY:    "💍",
  EPF_PPF:         "🏦",
  BUSINESS_EQUITY: "🏢",
  RECEIVABLES:     "🤝",
  OTHER:           "💰",
};

export const ASSET_COLORS: Record<string, string> = {
  REAL_ESTATE:     "#6366f1",
  VEHICLE:         "#06b6d4",
  GOLD_JEWELRY:    "#f59e0b",
  EPF_PPF:         "#22c55e",
  BUSINESS_EQUITY: "#8b5cf6",
  RECEIVABLES:     "#3b82f6",
  OTHER:           "#64748b",
};

export const LIABILITY_ICONS: Record<string, string> = {
  HOME_LOAN:      "🏠",
  CAR_LOAN:       "🚗",
  PERSONAL_LOAN:  "💳",
  CREDIT_CARD:    "💳",
  EDUCATION_LOAN: "🎓",
  BUSINESS_LOAN:  "🏢",
  OTHER:          "📋",
};

export const LIABILITY_COLORS: Record<string, string> = {
  HOME_LOAN:      "#ef4444",
  CAR_LOAN:       "#f97316",
  PERSONAL_LOAN:  "#ec4899",
  CREDIT_CARD:    "#dc2626",
  EDUCATION_LOAN: "#a855f7",
  BUSINESS_LOAN:  "#0ea5e9",
  OTHER:          "#64748b",
};
