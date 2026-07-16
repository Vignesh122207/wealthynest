import {
  Home, Wallet, ArrowLeftRight, PieChart, Target,
  TrendingUp, TrendingDown, CreditCard, BarChart3, Activity, Settings,
  Bell, User, HelpCircle, LogOut,
  Landmark, ShieldCheck, Building2, HandCoins, MoreHorizontal,
  AlertTriangle, CheckCircle2, CalendarClock, PiggyBank,
  UtensilsCrossed, ShoppingBag, Car, House, Zap,
  Popcorn, HeartPulse, GraduationCap, Sparkles, Plane,
  Repeat, Gift, PawPrint,
  Briefcase, Store, Laptop, Percent, Award,
  Palmtree, Armchair, Gem, UserRound,
  Plus, Pencil, Trash2, CalendarDays, CalendarRange, Gauge, BellRing, RotateCcw, Tag,
  Coins, Bitcoin, Lock, FileText, Users, PlusCircle,
  IndianRupee, CircleDollarSign,
  ShoppingCart, Cookie, Coffee, ChefHat, Sandwich, Shirt, Smartphone,
  Fuel, CarTaxiFront, Train, Bus, ParkingCircle,
  PlaneTakeoff, BedDouble, Clapperboard, Tv, Gamepad2, Music,
  Stethoscope, Pill, Dumbbell, Plug, Droplet, Flame, Wifi, SmartphoneCharging,
  KeyRound, Wrench, School, BookOpen, Scissors, Palette, WashingMachine,
  HeartHandshake, Receipt, BadgePercent,
  type LucideIcon,
} from "lucide-react";
import type { IconTone } from "./PremiumIcon";

export interface IconEntry {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Named tone from PremiumIcon's Apple palette. Ignored when `gradient` is set. */
  tone?: IconTone;
  /** Explicit two-stop gradient for items that need a genuine two-color tile rather than an auto-tinted single hue (e.g. the expense-category sheet). */
  gradient?: [string, string];
}

export interface IconCategory {
  key: string;
  title: string;
  dotTone: IconTone;
  items: IconEntry[];
}

// ── Mirrors the 9 groups from the reference sheet, in the same order. ──
// Tones within each category are a distinct, non-repeating slice of
// PremiumIcon's Apple system-color palette — no two items in the same group
// share a color (they previously did: e.g. every Goals item was "pink", every
// Investments item was "teal", every Debts item was "red").
export const ICON_CATEGORIES: IconCategory[] = [
  {
    key: "nav", title: "Main Menu / Navigation", dotTone: "purple",
    items: [
      { key: "overview",      label: "Overview",      icon: Home,           tone: "red" },
      { key: "accounts",      label: "Accounts",      icon: Wallet,         tone: "orange" },
      { key: "transactions",  label: "Transactions",  icon: ArrowLeftRight, tone: "yellow" },
      { key: "budget",        label: "Budget",        icon: PieChart,       tone: "green" },
      { key: "goals",         label: "Goals",         icon: Target,         tone: "mint" },
      { key: "investments",   label: "Investments",   icon: TrendingUp,     tone: "teal" },
      { key: "debts",         label: "Debts",         icon: CreditCard,     tone: "cyan" },
      { key: "reports",       label: "Reports",       icon: BarChart3,      tone: "blue" },
      { key: "cash-flow",     label: "Cash Flow",     icon: Activity,       tone: "indigo" },
      { key: "settings",      label: "Settings",      icon: Settings,       tone: "gray" },
      { key: "notifications", label: "Notifications", icon: Bell,           tone: "purple" },
      { key: "profile",       label: "Profile",       icon: User,           tone: "pink" },
      { key: "help",          label: "Help",          icon: HelpCircle,     tone: "brown" },
      { key: "logout",        label: "Logout",        icon: LogOut,         tone: "coral" },
    ],
  },
  {
    key: "account-types", title: "Account Types", dotTone: "blue",
    items: [
      { key: "bank-account",       label: "Bank Account",       icon: Landmark,    tone: "blue" },
      { key: "cash-wallet",        label: "Cash Wallet",        icon: Wallet,      tone: "indigo" },
      { key: "credit-card",        label: "Credit Card",        icon: CreditCard,  tone: "purple" },
      { key: "emergency-fund-acc", label: "Emergency Fund",     icon: ShieldCheck, tone: "pink" },
      { key: "investment-account", label: "Investment Account", icon: TrendingUp,  tone: "brown" },
      { key: "loan-account",       label: "Loan Account",       icon: HandCoins,   tone: "coral" },
      { key: "savings-account",    label: "Savings Account",    icon: PiggyBank,   tone: "lemon" },
      { key: "other-account",      label: "Other Account",      icon: MoreHorizontal, tone: "gray" },
    ],
  },
  {
    key: "account-values", title: "Account Values / Overview", dotTone: "green",
    items: [
      { key: "total-balance", label: "Total Balance", icon: Wallet,         tone: "emerald" },
      { key: "income",        label: "Income",        icon: TrendingUp,     tone: "turquoise" },
      { key: "expenses",      label: "Expenses",      icon: TrendingDown,   tone: "azure" },
      { key: "net-worth",     label: "Net Worth",     icon: Gem,            tone: "cobalt" },
      { key: "savings",       label: "Savings",       icon: PiggyBank,      tone: "violet" },
      { key: "cash-flow-val", label: "Cash Flow",     icon: Activity,       tone: "magenta" },
      { key: "budget-val",    label: "Budget",        icon: PieChart,       tone: "red" },
      { key: "over-budget",   label: "Over Budget",   icon: AlertTriangle,  tone: "orange" },
      { key: "on-track",      label: "On Track",      icon: CheckCircle2,   tone: "yellow" },
      { key: "upcoming",      label: "Upcoming",      icon: CalendarClock,  tone: "green" },
    ],
  },
  // ── Expense categories — split into the 10 domain groups + "Other" from the
  // reference sheet (55 items total). Every item gets its own two-stop
  // gradient (not an auto-tinted single hue like the rest of this file) so
  // near-siblings (Groceries vs Snacks vs Coffee, all under Food & Dining)
  // read as genuinely distinct tiles, not shades of the same color. Verified
  // programmatically — no two of the 55 (from, to) pairs are identical.
  {
    key: "expense-food-dining", title: "Expense Categories — Food & Dining", dotTone: "orange",
    items: [
      { key: "food-dining", label: "Food & Dining", icon: UtensilsCrossed, gradient: ["#f97316", "#dc2626"] },
      { key: "groceries",   label: "Groceries",     icon: ShoppingCart,    gradient: ["#22c55e", "#059669"] },
      { key: "snacks",      label: "Snacks",        icon: Cookie,          gradient: ["#fbbf24", "#f97316"] },
      { key: "coffee",      label: "Coffee",        icon: Coffee,          gradient: ["#a16207", "#78350f"] },
      { key: "restaurant",  label: "Restaurant",    icon: ChefHat,         gradient: ["#f43f5e", "#be123c"] },
      { key: "fast-food",   label: "Fast Food",     icon: Sandwich,        gradient: ["#facc15", "#dc2626"] },
    ],
  },
  {
    key: "expense-shopping", title: "Expense Categories — Shopping", dotTone: "pink",
    items: [
      { key: "shopping",    label: "Shopping",    icon: ShoppingBag, gradient: ["#ec4899", "#a21caf"] },
      { key: "clothing",    label: "Clothing",    icon: Shirt,       gradient: ["#e879f9", "#a855f7"] },
      { key: "electronics", label: "Electronics", icon: Smartphone, gradient: ["#3b82f6", "#4f46e5"] },
      { key: "furniture",   label: "Furniture",   icon: Armchair,    gradient: ["#d97706", "#92400e"] },
    ],
  },
  {
    key: "expense-transport", title: "Expense Categories — Transport", dotTone: "blue",
    items: [
      { key: "transport", label: "Transport", icon: Car,           gradient: ["#0ea5e9", "#2563eb"] },
      { key: "fuel",       label: "Fuel",      icon: Fuel,          gradient: ["#f97316", "#b45309"] },
      { key: "taxi",       label: "Taxi",      icon: CarTaxiFront,  gradient: ["#facc15", "#ea580c"] },
      { key: "metro",      label: "Metro",     icon: Train,         gradient: ["#6366f1", "#4338ca"] },
      { key: "bus",        label: "Bus",       icon: Bus,           gradient: ["#14b8a6", "#0f766e"] },
      { key: "parking",    label: "Parking",   icon: ParkingCircle, gradient: ["#64748b", "#334155"] },
    ],
  },
  {
    key: "expense-travel", title: "Expense Categories — Travel", dotTone: "cyan",
    items: [
      { key: "travel",   label: "Travel",   icon: Plane,        gradient: ["#38bdf8", "#6366f1"] },
      { key: "flights",  label: "Flights",  icon: PlaneTakeoff, gradient: ["#0ea5e9", "#0369a1"] },
      { key: "hotels",   label: "Hotels",   icon: BedDouble,    gradient: ["#a78bfa", "#7c3aed"] },
      { key: "vacation-expense", label: "Vacation", icon: Palmtree, gradient: ["#2dd4bf", "#0d9488"] },
    ],
  },
  {
    key: "expense-entertainment", title: "Expense Categories — Entertainment", dotTone: "purple",
    items: [
      { key: "entertainment", label: "Entertainment", icon: Clapperboard, gradient: ["#a855f7", "#7e22ce"] },
      { key: "movies",        label: "Movies",        icon: Popcorn,      gradient: ["#d946ef", "#a21caf"] },
      { key: "ott",           label: "OTT",           icon: Tv,           gradient: ["#ef4444", "#e11d48"] },
      { key: "gaming",        label: "Gaming",        icon: Gamepad2,     gradient: ["#22d3ee", "#0891b2"] },
      { key: "music",         label: "Music",         icon: Music,        gradient: ["#f472b6", "#db2777"] },
    ],
  },
  {
    key: "expense-health", title: "Expense Categories — Health", dotTone: "red",
    items: [
      { key: "health",     label: "Health",     icon: HeartPulse,  gradient: ["#ef4444", "#b91c1c"] },
      { key: "doctor",     label: "Doctor",     icon: Stethoscope, gradient: ["#06b6d4", "#0e7490"] },
      { key: "medicines",  label: "Medicines",  icon: Pill,        gradient: ["#84cc16", "#4d7c0f"] },
      { key: "gym",        label: "Gym",        icon: Dumbbell,    gradient: ["#ea580c", "#7c2d12"] },
      { key: "insurance",  label: "Insurance",  icon: ShieldCheck, gradient: ["#3b82f6", "#1d4ed8"] },
    ],
  },
  {
    key: "expense-utilities", title: "Expense Categories — Utilities", dotTone: "yellow",
    items: [
      { key: "utilities",       label: "Utilities",       icon: Zap,                 gradient: ["#eab308", "#a16207"] },
      { key: "electricity",     label: "Electricity",     icon: Plug,                gradient: ["#facc15", "#ca8a04"] },
      { key: "water",           label: "Water",           icon: Droplet,             gradient: ["#38bdf8", "#0369a1"] },
      { key: "gas",             label: "Gas",              icon: Flame,               gradient: ["#fb923c", "#c2410c"] },
      { key: "internet",        label: "Internet",        icon: Wifi,                gradient: ["#38bdf8", "#4338ca"] },
      { key: "mobile-recharge", label: "Mobile Recharge", icon: SmartphoneCharging, gradient: ["#a3e635", "#65a30d"] },
    ],
  },
  {
    key: "expense-housing", title: "Expense Categories — Housing", dotTone: "indigo",
    items: [
      { key: "housing",     label: "Housing",     icon: Home,   gradient: ["#6366f1", "#312e81"] },
      { key: "rent",        label: "Rent",        icon: KeyRound, gradient: ["#fbbf24", "#b45309"] },
      { key: "maintenance", label: "Maintenance", icon: Wrench,  gradient: ["#78716c", "#44403c"] },
    ],
  },
  {
    key: "expense-education", title: "Expense Categories — Education", dotTone: "violet",
    items: [
      { key: "education-expense", label: "Education", icon: GraduationCap, gradient: ["#6366f1", "#3730a3"] },
      { key: "school",            label: "School",     icon: School,        gradient: ["#0ea5e9", "#1d4ed8"] },
      { key: "college",           label: "College",    icon: Landmark,      gradient: ["#8b5cf6", "#5b21b6"] },
      { key: "books",             label: "Books",      icon: BookOpen,      gradient: ["#f59e0b", "#92400e"] },
    ],
  },
  {
    key: "expense-personal-care", title: "Expense Categories — Personal Care", dotTone: "magenta",
    items: [
      { key: "personal-care", label: "Personal Care", icon: Sparkles,       gradient: ["#f472b6", "#be185d"] },
      { key: "salon",         label: "Salon",         icon: Scissors,       gradient: ["#fb7185", "#e11d48"] },
      { key: "cosmetics",     label: "Cosmetics",     icon: Palette,        gradient: ["#d946ef", "#86198f"] },
      { key: "laundry",       label: "Laundry",       icon: WashingMachine, gradient: ["#38bdf8", "#0284c7"] },
    ],
  },
  {
    key: "expense-other", title: "Expense Categories — Other", dotTone: "gray",
    items: [
      { key: "pets",             label: "Pets",             icon: PawPrint,       gradient: ["#f59e0b", "#b45309"] },
      { key: "gifts",            label: "Gifts",            icon: Gift,           gradient: ["#e879f9", "#db2777"] },
      { key: "charity",          label: "Charity",          icon: HeartHandshake, gradient: ["#2dd4bf", "#047857"] },
      { key: "taxes",            label: "Taxes",            icon: Receipt,        gradient: ["#64748b", "#0f172a"] },
      { key: "fees",             label: "Fees",             icon: BadgePercent,   gradient: ["#fb923c", "#9a3412"] },
      { key: "subscriptions",    label: "Subscriptions",    icon: Repeat,         gradient: ["#818cf8", "#6d28d9"] },
      { key: "miscellaneous",    label: "Miscellaneous",    icon: MoreHorizontal, gradient: ["#94a3b8", "#475569"] },
      { key: "custom-category-expense", label: "Custom Category", icon: Tag,      gradient: ["#a3a3a3", "#525252"] },
    ],
  },
  {
    key: "income-categories", title: "Income Categories", dotTone: "green",
    items: [
      { key: "salary",         label: "Salary",         icon: Briefcase,   tone: "indigo" },
      { key: "business",       label: "Business",       icon: Store,      tone: "purple" },
      { key: "freelance",      label: "Freelance",      icon: Laptop,     tone: "pink" },
      { key: "investments-inc",label: "Investments",    icon: Coins,      tone: "brown" },
      { key: "rental-income",  label: "Rental Income",  icon: Home,       tone: "coral" },
      { key: "interest-income",label: "Interest Income",icon: Percent,    tone: "lemon" },
      { key: "dividends",      label: "Dividends",      icon: PieChart,   tone: "emerald" },
      { key: "capital-gains",  label: "Capital Gains",  icon: TrendingUp, tone: "turquoise" },
      { key: "bonus",          label: "Bonus",          icon: Award,      tone: "azure" },
      { key: "other-income",   label: "Other Income",   icon: MoreHorizontal, tone: "cobalt" },
    ],
  },
  {
    key: "goals", title: "Goals", dotTone: "pink",
    items: [
      { key: "retirement",     label: "Retirement",     icon: Armchair,    tone: "turquoise" },
      { key: "buy-house",      label: "Buy House",      icon: House,       tone: "azure" },
      { key: "buy-car",        label: "Buy Car",        icon: Car,         tone: "cobalt" },
      { key: "vacation",       label: "Vacation",       icon: Palmtree,    tone: "violet" },
      { key: "education-goal", label: "Education",      icon: GraduationCap, tone: "magenta" },
      { key: "wedding",        label: "Wedding",        icon: Gem,         tone: "red" },
      { key: "emergency-fund-goal", label: "Emergency Fund", icon: ShieldCheck, tone: "orange" },
      { key: "new-business",   label: "New Business",   icon: Briefcase,   tone: "yellow" },
      { key: "debt-free",      label: "Debt Free",      icon: CheckCircle2, tone: "green" },
      { key: "custom-goal",    label: "Custom Goal",    icon: Target,      tone: "mint" },
    ],
  },
  {
    key: "budget-related", title: "Budget & Related", dotTone: "yellow",
    items: [
      { key: "add-budget",     label: "Add Budget",     icon: Plus,         tone: "yellow" },
      { key: "edit-budget",    label: "Edit Budget",    icon: Pencil,       tone: "green" },
      { key: "delete-budget",  label: "Delete Budget",  icon: Trash2,       tone: "mint" },
      { key: "monthly-budget", label: "Monthly Budget", icon: CalendarDays, tone: "teal" },
      { key: "yearly-budget",  label: "Yearly Budget",  icon: CalendarRange, tone: "cyan" },
      { key: "budget-overview",label: "Budget Overview",icon: PieChart,     tone: "blue" },
      { key: "spending-limit", label: "Spending Limit", icon: Gauge,        tone: "indigo" },
      { key: "budget-alert",   label: "Budget Alert",   icon: BellRing,     tone: "purple" },
      { key: "reset-budget",   label: "Reset Budget",   icon: RotateCcw,    tone: "pink" },
      { key: "custom-category",label: "Custom Category",icon: Tag,         tone: "brown" },
    ],
  },
  {
    key: "investments", title: "Investments", dotTone: "teal",
    items: [
      { key: "stocks",         label: "Stocks",         icon: TrendingUp,  tone: "purple" },
      { key: "mutual-funds",   label: "Mutual Funds",   icon: PieChart,    tone: "pink" },
      { key: "etfs",           label: "ETFs",            icon: BarChart3,   tone: "brown" },
      { key: "gold",           label: "Gold",           icon: Coins,       tone: "coral" },
      { key: "real-estate",    label: "Real Estate",    icon: Building2,   tone: "lemon" },
      { key: "crypto",         label: "Crypto",         icon: Bitcoin,     tone: "emerald" },
      { key: "fixed-deposit",  label: "Fixed Deposit",  icon: Lock,        tone: "turquoise" },
      { key: "bonds",          label: "Bonds",          icon: FileText,    tone: "azure" },
      { key: "p2p-lending",    label: "P2P Lending",    icon: Users,       tone: "cobalt" },
      { key: "add-investment", label: "Add Investment", icon: PlusCircle,  tone: "violet" },
    ],
  },
  {
    key: "debts-loans", title: "Debts / Loans", dotTone: "red",
    items: [
      { key: "credit-card-debt", label: "Credit Card Debt", icon: CreditCard,    tone: "azure" },
      { key: "personal-loan",    label: "Personal Loan",    icon: UserRound,     tone: "cobalt" },
      { key: "home-loan",        label: "Home Loan",        icon: Home,          tone: "violet" },
      { key: "car-loan",         label: "Car Loan",         icon: Car,           tone: "magenta" },
      { key: "education-loan",   label: "Education Loan",   icon: GraduationCap, tone: "red" },
      { key: "emi-payment",      label: "EMI Payment",      icon: IndianRupee,   tone: "orange" },
      { key: "outstanding",      label: "Outstanding",      icon: CircleDollarSign, tone: "yellow" },
      { key: "interest",         label: "Interest",         icon: Percent,       tone: "green" },
      { key: "loan-overview",    label: "Loan Overview",    icon: PieChart,      tone: "mint" },
      { key: "pay-off-loan",     label: "Pay Off Loan",     icon: CheckCircle2,  tone: "teal" },
    ],
  },
];

// ── Flat lookup used by dashboard components: ICONS["overview"] ──
export const ICONS: Record<string, IconEntry> = Object.fromEntries(
  ICON_CATEGORIES.flatMap((c) => c.items.map((i) => [i.key, i])),
);
