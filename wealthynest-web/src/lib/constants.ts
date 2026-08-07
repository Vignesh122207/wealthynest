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
  NOTIFICATIONS:  ["notifications"]          as const,
  FAMILY:         ["family"]                 as const,
  GOALS:          ["goals"]                  as const,
  VAULT:          ["vault", "items"]         as const,
  VAULT_HEALTH:   ["vault", "health"]        as const,
  CURRENCY_RATES: ["currency", "rates"]      as const,
} as const;

// Every RBI-scheduled commercial bank (public + private), small finance bank, and payments
// bank — not just the dozen-odd biggest names — so the "which bank is this account with"
// picker doesn't force a smaller/regional bank's users into "Other". Grouped by RBI category
// below purely for readability; the picker itself just flattens this into one list.
export const INDIAN_BANKS = [
  // Public sector banks
  "State Bank of India",
  "Punjab National Bank",
  "Bank of Baroda",
  "Canara Bank",
  "Union Bank of India",
  "Bank of India",
  "Indian Bank",
  "Central Bank of India",
  "Indian Overseas Bank",
  "UCO Bank",
  "Bank of Maharashtra",
  "Punjab & Sind Bank",

  // Private sector banks
  "HDFC Bank",
  "ICICI Bank",
  "Axis Bank",
  "Kotak Mahindra Bank",
  "IndusInd Bank",
  "Yes Bank",
  "IDFC First Bank",
  "Federal Bank",
  "South Indian Bank",
  "RBL Bank",
  "Bandhan Bank",
  "IDBI Bank",
  "City Union Bank",
  "DCB Bank",
  "Karnataka Bank",
  "Karur Vysya Bank",
  "Tamilnad Mercantile Bank",
  "Jammu & Kashmir Bank",
  "Dhanlaxmi Bank",
  "CSB Bank",
  "Nainital Bank",

  // Small finance banks
  "AU Small Finance Bank",
  "Equitas Small Finance Bank",
  "Ujjivan Small Finance Bank",
  "Jana Small Finance Bank",
  "ESAF Small Finance Bank",
  "Suryoday Small Finance Bank",
  "Utkarsh Small Finance Bank",
  "North East Small Finance Bank",
  "Shivalik Small Finance Bank",
  "Unity Small Finance Bank",
  "Capital Small Finance Bank",

  // Payments banks
  "Airtel Payments Bank",
  "India Post Payments Bank",
  "Fino Payments Bank",
  "Paytm Payments Bank",
  "Jio Payments Bank",
  "NSDL Payments Bank",

  // Foreign banks operating in India
  "Standard Chartered Bank",
];

// Ordered by approximate active-user market share, so the most-used brokers surface first
// in the Investment-account "Broker / Platform" picker.
export const STOCK_BROKERS = [
  "Zerodha",
  "Groww",
  "Angel One",
  "Upstox",
  "ICICI Direct",
  "HDFC Securities",
  "Kotak Securities",
  "Motilal Oswal",
  "5paisa",
  "Paytm Money",
  "Sharekhan",
  "IIFL Securities",
  "SBI Securities",
  "Axis Direct",
  "Dhan",
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

export const VAULT_ITEM_TYPES = [
  { value: "LOGIN",       label: "Login" },
  { value: "SECURE_NOTE", label: "Secure Note" },
];

export const LIABILITY_TYPES = [
  { value: "HOME_LOAN",      label: "Home Loan" },
  { value: "CAR_LOAN",       label: "Car Loan" },
  { value: "PERSONAL_LOAN",  label: "Personal Loan" },
  { value: "CREDIT_CARD",    label: "Credit Card" },
  { value: "EDUCATION_LOAN", label: "Education Loan" },
  { value: "GOLD_LOAN",      label: "Gold Loan" },
  { value: "BUSINESS_LOAN",  label: "Business Loan" },
  { value: "OTHER",          label: "Other" },
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
  GOLD_LOAN:      "🪙",
  BUSINESS_LOAN:  "🏢",
  OTHER:          "📋",
};

export const LIABILITY_COLORS: Record<string, string> = {
  HOME_LOAN:      "#ef4444",
  CAR_LOAN:       "#f97316",
  PERSONAL_LOAN:  "#ec4899",
  CREDIT_CARD:    "#dc2626",
  EDUCATION_LOAN: "#a855f7",
  GOLD_LOAN:      "#eab308",
  BUSINESS_LOAN:  "#0ea5e9",
  OTHER:          "#64748b",
};
