import {
    Baby,
    Banknote,
    BookOpen,
    Briefcase,
    Building2,
    Car,
    Clapperboard,
    Cloud,
    Coins,
    CreditCard,
    Dumbbell,
    FileText,
    Gamepad2,
    Gift,
    Globe,
    GraduationCap,
    Heart,
    HeartPulse,
    Home,
    KeyRound,
    Landmark,
    Laptop,
    type LucideIcon,
    Mail,
    Package,
    Percent,
    Plane,
    Shield,
    ShieldCheck,
    ShoppingBag,
    ShoppingCart,
    Smartphone,
    Sparkles,
    Store,
    Target,
    TrendingUp,
    Users,
    Utensils,
    Wifi,
    Zap,
} from "lucide-react";
import {CATEGORY_ICON_MAP} from "./categoryIcons";

export interface CategoryMeta { icon: LucideIcon; color: string; }

// Apple's iOS system-color palette (light + dark shades of the same 12
// families) — every category below gets its own distinct shade, so no two
// ever render identically (Transport #007AFF vs Travel #0A84FF used to be
// close enough to look the same; Grocery/Gym/Investment were all green,
// Entertainment/Subscription both purple, Health/Personal Care both pink-red).
const CATEGORY_MAP: { keywords: string[]; meta: CategoryMeta }[] = [
  { keywords: ["grocery", "grocer", "supermarket", "kirana", "vegetables", "fruits", "milk", "provision"],
    meta: { icon: ShoppingCart, color: "#34C759" } }, // green
  { keywords: ["dining", "restaurant", "food", "cafe", "coffee", "snack", "eat", "lunch", "dinner", "breakfast", "swiggy", "zomato"],
    meta: { icon: Utensils, color: "#FF9500" } }, // orange
  // "travel" removed — it used to shadow the dedicated Travel/Vacation group
  // below, so a category literally named "Travel" rendered as Transport (same
  // icon, same color) instead of its own entry.
  { keywords: ["transport", "petrol", "diesel", "fuel", "cab", "taxi", "uber", "ola", "commute", "bus", "train", "metro", "auto"],
    meta: { icon: Car, color: "#007AFF" } }, // blue
  { keywords: ["entertainment", "movie", "cinema", "theatre", "game", "gaming", "netflix", "hotstar", "prime", "recreation"],
    meta: { icon: Clapperboard, color: "#AF52DE" } }, // purple
  { keywords: ["shopping", "clothes", "clothing", "apparel", "fashion", "shoes", "footwear", "accessories", "amazon", "flipkart", "myntra"],
    meta: { icon: ShoppingBag, color: "#FF2D55" } }, // pink
  { keywords: ["health", "medical", "doctor", "hospital", "pharmacy", "medicine", "clinic", "dental", "eye", "lab", "test", "apollo"],
    meta: { icon: HeartPulse, color: "#FF3B30" } }, // red
  { keywords: ["education", "school", "college", "tuition", "course", "book", "learning", "fees", "exam", "coaching", "library"],
    meta: { icon: BookOpen, color: "#5856D6" } }, // indigo
  { keywords: ["utility", "utilities", "electricity", "water", "gas", "internet", "broadband", "wifi", "bill", "recharge", "dth", "landline"],
    meta: { icon: Zap, color: "#32ADE6" } }, // cyan
  { keywords: ["rent", "housing", "home", "house", "maintenance", "society", "flat", "apartment", "pg", "hostel"],
    meta: { icon: Home, color: "#30B0C7" } }, // teal
  { keywords: ["insurance", "premium", "policy", "lic", "term"],
    meta: { icon: Shield, color: "#A2845E" } }, // brown
  { keywords: ["subscription", "mobile", "phone", "sim", "postpaid", "prepaid", "jio", "airtel", "vi", "bsnl"],
    meta: { icon: Smartphone, color: "#00C7BE" } }, // mint
  { keywords: ["personal", "beauty", "salon", "spa", "grooming", "haircut", "cosmetic"],
    meta: { icon: Sparkles, color: "#FFCC00" } }, // yellow
  { keywords: ["gym", "fitness", "sports", "yoga", "workout", "swimming", "badminton"],
    meta: { icon: Dumbbell, color: "#30D158" } }, // green (dark shade)
  { keywords: ["kids", "baby", "child", "toy", "daycare"],
    meta: { icon: Baby, color: "#FF9F0A" } }, // orange (dark shade)
  { keywords: ["gift", "donation", "charity", "festival", "celebration", "birthday"],
    meta: { icon: Gift, color: "#FF375F" } }, // pink (dark shade)
  // Deliberately a different family from Transport's blue above — these two
  // used to render as the same color.
  { keywords: ["flight", "vacation", "holiday", "tour", "trip", "lodge", "resort"],
    meta: { icon: Plane, color: "#64D2FF" } }, // cyan (dark shade)
  { keywords: ["investment", "saving", "mutual fund", "sip", "stock", "share", "nps", "ppf", "fd"],
    meta: { icon: TrendingUp, color: "#5E5CE6" } }, // indigo (dark shade)
  { keywords: ["debt", "loan", "emi", "repay"],
    meta: { icon: CreditCard, color: "#FF453A" } }, // red (dark shade)
  { keywords: ["atm", "cash", "withdrawal", "deposit"],
    meta: { icon: Banknote, color: "#AC8E68" } }, // brown (dark shade)
  { keywords: ["misc", "other", "general"],
    meta: { icon: Package, color: "#BF5AF2" } }, // purple (dark shade)
];

const DEFAULT_META: CategoryMeta = { icon: Package, color: "#6366f1" };

export function getCategoryMeta(categoryName: string): CategoryMeta {
  const lower = categoryName.toLowerCase();
  for (const { keywords, meta } of CATEGORY_MAP) {
    if (keywords.some(kw => lower.includes(kw))) return meta;
  }
  return DEFAULT_META;
}

export function getCategoryColor(categoryName: string, fallback?: string): string {
  const lower = categoryName.toLowerCase();
  for (const { keywords, meta } of CATEGORY_MAP) {
    if (keywords.some(kw => lower.includes(kw))) return meta.color;
  }
  return fallback ?? DEFAULT_META.color;
}

// Prefers an explicitly-chosen icon key (set when the category was created —
// keys come from the shared registry in lib/categoryIcons.ts, the same
// vocabulary the DB seed migrations and every icon picker in the app use),
// falling back to CATEGORY_MAP's keyword match, then the generic default.
// Deliberately the opposite precedence from getCategoryColor (which checks
// CATEGORY_MAP's keyword match first, stored color last): the curated palette
// exists specifically to override inconsistent/legacy seed colors for
// recognized category names, while a user's explicit icon pick should never
// be silently swapped for a guess. Every call site must resolve color via
// getCategoryColor(name, color) — not `color ?? getCategoryColor(name)` — or
// the same category renders a different color on different pages.
export function getCategoryIcon(category: { name: string; icon?: string | null }): LucideIcon {
  if (category.icon && CATEGORY_ICON_MAP[category.icon]) return CATEGORY_ICON_MAP[category.icon];
  return getCategoryMeta(category.name).icon;
}

// ── Goal icon palette ─────────────────────────────────────────────────────────

const GOAL_ICON_MAP: { keywords: string[]; icon: LucideIcon }[] = [
  { keywords: ["emergency", "fund", "safety", "buffer"],        icon: ShieldCheck },
  { keywords: ["car", "vehicle", "bike", "scooter", "motor"],   icon: Car },
  { keywords: ["home", "house", "flat", "property", "plot"],    icon: Home },
  { keywords: ["vacation", "trip", "travel", "holiday", "tour","flight"], icon: Plane },
  { keywords: ["education", "college", "school", "course", "study", "degree"], icon: GraduationCap },
  { keywords: ["wedding", "marriage", "ring", "honeymoon"],     icon: Heart },
  { keywords: ["phone", "laptop", "gadget", "iphone", "mac"],  icon: Laptop },
  { keywords: ["health", "medical", "hospital", "fitness"],     icon: HeartPulse },
  { keywords: ["business", "startup", "shop", "store"],         icon: Briefcase },
  { keywords: ["retire", "retirement", "pension"],              icon: Landmark },
  { keywords: ["kids", "baby", "child", "school fee"],          icon: Baby },
  { keywords: ["gift", "donation"],                             icon: Gift },
];

export function getGoalIcon(name: string): LucideIcon {
  const lower = name.toLowerCase();
  for (const { keywords, icon } of GOAL_ICON_MAP) {
    if (keywords.some(kw => lower.includes(kw))) return icon;
  }
  return Target;
}

// Selectable icon set for the goal form's manual icon picker — lets a user
// override the auto-derived icon (e.g. a goal named "Project Phoenix" would
// otherwise always fall back to the generic Target icon).
export const GOAL_ICON_OPTIONS: { key: string; icon: LucideIcon }[] = [
  { key: "ShieldCheck",   icon: ShieldCheck },
  { key: "Car",           icon: Car },
  { key: "Home",          icon: Home },
  { key: "Plane",         icon: Plane },
  { key: "GraduationCap", icon: GraduationCap },
  { key: "Heart",         icon: Heart },
  { key: "Laptop",        icon: Laptop },
  { key: "HeartPulse",    icon: HeartPulse },
  { key: "Briefcase",     icon: Briefcase },
  { key: "Landmark",      icon: Landmark },
  { key: "Baby",          icon: Baby },
  { key: "Gift",          icon: Gift },
  { key: "TrendingUp",    icon: TrendingUp },
  { key: "Target",        icon: Target },
];

const GOAL_ICON_KEY_MAP: Record<string, LucideIcon> = Object.fromEntries(
  GOAL_ICON_OPTIONS.map(({ key, icon }) => [key, icon]),
);

// Same precedence as getCategoryIcon: an explicitly-picked icon wins, otherwise
// fall back to the name-derived match.
export function resolveGoalIcon(goal: { name: string; icon?: string | null }): LucideIcon {
  if (goal.icon && GOAL_ICON_KEY_MAP[goal.icon]) return GOAL_ICON_KEY_MAP[goal.icon];
  return getGoalIcon(goal.name);
}

// ── Income source icon/color palette ──────────────────────────────────────────
// Was previously duplicated verbatim in IncomeForm.tsx and the dashboard's
// TransactionList.tsx (drift risk); BUSINESS used Building2, which collided
// with AccountPicker's "Bank" account icon whenever both showed in the same
// income form — Store reads as "a business" without reusing that glyph.
export const INCOME_ICON_MAP: Record<string, { icon: LucideIcon; color: string }> = {
  SALARY:    { icon: Briefcase,  color: "#34C759" },
  FREELANCE: { icon: Laptop,     color: "#007AFF" },
  BUSINESS:  { icon: Store,      color: "#AF52DE" },
  RENTAL:    { icon: Home,       color: "#30B0C7" },
  BONUS:     { icon: Gift,       color: "#FF9500" },
  INTEREST:  { icon: Percent,    color: "#32ADE6" },
  DIVIDEND:  { icon: TrendingUp, color: "#5856D6" },
  OTHER:     { icon: Coins,      color: "#8E8E93" },
};

// 10 colors for goal progress rings (cycled by index) — Apple system colors,
// one light shade per family, so with up to 10 goals visible at once no two
// rings land on near-identical hues (the old palette had rose #FF2D55 and
// pink #FF375F sitting almost on top of each other).
export const GOAL_COLORS = [
  "#007AFF", // blue
  "#34C759", // green
  "#AF52DE", // purple
  "#FF9500", // orange
  "#FF3B30", // red
  "#32ADE6", // cyan
  "#00C7BE", // mint
  "#5856D6", // indigo
  "#30B0C7", // teal
  "#FF2D55", // pink
];

// 10 goal presets for the "New Goal" quick-start grid — tapping one fills the
// name field (icon/color then derive live from that name via getGoalIcon,
// same as any other goal), rather than persisting a separate template id.
// Each is deliberately keyword-matched by GOAL_ICON_MAP above. "Custom" isn't
// a real preset — it just reveals the free-text name field directly.
export const GOAL_PRESETS: { name: string; icon: LucideIcon }[] = [
  { name: "Emergency Fund", icon: ShieldCheck },
  { name: "Buy a Car",      icon: Car },
  { name: "Buy a House",    icon: Home },
  { name: "Vacation",       icon: Plane },
  { name: "Education",      icon: GraduationCap },
  { name: "Wedding",         icon: Heart },
  { name: "New Gadget",     icon: Laptop },
  { name: "Retirement",     icon: Landmark },
  { name: "New Business",   icon: Briefcase },
  { name: "Custom Goal",    icon: Target },
];

// ── Vault item icon palette ────────────────────────────────────────────────────
// Curated for the kinds of accounts/notes people actually store in a password
// vault — generic services, not a general "any category" set like GOAL_ICON_OPTIONS.
export const VAULT_ICON_OPTIONS: { key: string; icon: LucideIcon }[] = [
  { key: "KeyRound",    icon: KeyRound },
  { key: "Mail",        icon: Mail },
  { key: "Globe",       icon: Globe },
  { key: "CreditCard",  icon: CreditCard },
  { key: "Landmark",    icon: Landmark },
  { key: "ShoppingBag", icon: ShoppingBag },
  { key: "Building2",   icon: Building2 },
  { key: "Wifi",        icon: Wifi },
  { key: "Clapperboard",icon: Clapperboard },
  { key: "Gamepad2",    icon: Gamepad2 },
  { key: "Cloud",       icon: Cloud },
  { key: "Smartphone",  icon: Smartphone },
  { key: "Users",       icon: Users },
  { key: "FileText",    icon: FileText },
];

const VAULT_ICON_KEY_MAP: Record<string, LucideIcon> = Object.fromEntries(
  VAULT_ICON_OPTIONS.map(({ key, icon }) => [key, icon]),
);

// An explicitly-picked icon wins; otherwise fall back to a type-derived default
// (no keyword/name matching like getGoalIcon — vault titles are arbitrary
// service names, not the small fixed vocabulary goal names tend to use).
export function resolveVaultIcon(item: { itemType: "LOGIN" | "SECURE_NOTE"; icon?: string | null }): LucideIcon {
  if (item.icon && VAULT_ICON_KEY_MAP[item.icon]) return VAULT_ICON_KEY_MAP[item.icon];
  return item.itemType === "LOGIN" ? KeyRound : FileText;
}
