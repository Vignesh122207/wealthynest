import {
  ShoppingCart, Utensils, Car, Clapperboard, ShoppingBag,
  HeartPulse, BookOpen, Zap, Home, Shield, Smartphone,
  Sparkles, Dumbbell, Baby, Gift, Plane, TrendingUp,
  CreditCard, Banknote, Package, type LucideIcon,
} from "lucide-react";

export interface CategoryMeta { icon: LucideIcon; color: string; }

const CATEGORY_MAP: { keywords: string[]; meta: CategoryMeta }[] = [
  { keywords: ["grocery", "grocer", "supermarket", "kirana", "vegetables", "fruits", "milk", "provision"],
    meta: { icon: ShoppingCart, color: "#34C759" } },
  { keywords: ["dining", "restaurant", "food", "cafe", "coffee", "snack", "eat", "lunch", "dinner", "breakfast", "swiggy", "zomato"],
    meta: { icon: Utensils, color: "#FF6B35" } },
  { keywords: ["transport", "travel", "petrol", "diesel", "fuel", "cab", "taxi", "uber", "ola", "commute", "bus", "train", "metro", "auto"],
    meta: { icon: Car, color: "#007AFF" } },
  { keywords: ["entertainment", "movie", "cinema", "theatre", "game", "gaming", "netflix", "hotstar", "prime", "recreation"],
    meta: { icon: Clapperboard, color: "#BF5AF2" } },
  { keywords: ["shopping", "clothes", "clothing", "apparel", "fashion", "shoes", "footwear", "accessories", "amazon", "flipkart", "myntra"],
    meta: { icon: ShoppingBag, color: "#FF9500" } },
  { keywords: ["health", "medical", "doctor", "hospital", "pharmacy", "medicine", "clinic", "dental", "eye", "lab", "test", "apollo"],
    meta: { icon: HeartPulse, color: "#FF2D55" } },
  { keywords: ["education", "school", "college", "tuition", "course", "book", "learning", "fees", "exam", "coaching", "library"],
    meta: { icon: BookOpen, color: "#5856D6" } },
  { keywords: ["utility", "utilities", "electricity", "water", "gas", "internet", "broadband", "wifi", "bill", "recharge", "dth", "landline"],
    meta: { icon: Zap, color: "#5AC8FA" } },
  { keywords: ["rent", "housing", "home", "house", "maintenance", "society", "flat", "apartment", "pg", "hostel"],
    meta: { icon: Home, color: "#30B0C7" } },
  { keywords: ["insurance", "premium", "policy", "lic", "term"],
    meta: { icon: Shield, color: "#636366" } },
  { keywords: ["subscription", "mobile", "phone", "sim", "postpaid", "prepaid", "jio", "airtel", "vi", "bsnl"],
    meta: { icon: Smartphone, color: "#AF52DE" } },
  { keywords: ["personal", "beauty", "salon", "spa", "grooming", "haircut", "cosmetic"],
    meta: { icon: Sparkles, color: "#FF375F" } },
  { keywords: ["gym", "fitness", "sports", "yoga", "workout", "swimming", "badminton"],
    meta: { icon: Dumbbell, color: "#30D158" } },
  { keywords: ["kids", "baby", "child", "toy", "daycare"],
    meta: { icon: Baby, color: "#FFD60A" } },
  { keywords: ["gift", "donation", "charity", "festival", "celebration", "birthday"],
    meta: { icon: Gift, color: "#FF6B6B" } },
  { keywords: ["flight", "vacation", "holiday", "tour", "trip", "lodge", "resort"],
    meta: { icon: Plane, color: "#0A84FF" } },
  { keywords: ["investment", "saving", "mutual fund", "sip", "stock", "share", "nps", "ppf", "fd"],
    meta: { icon: TrendingUp, color: "#32D74B" } },
  { keywords: ["debt", "loan", "emi", "repay"],
    meta: { icon: CreditCard, color: "#FF453A" } },
  { keywords: ["atm", "cash", "withdrawal", "deposit"],
    meta: { icon: Banknote, color: "#8E8E93" } },
  { keywords: ["misc", "other", "general"],
    meta: { icon: Package, color: "#6366f1" } },
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

// ── Goal icon palette ─────────────────────────────────────────────────────────

import {
  ShieldCheck, GraduationCap, Landmark, Briefcase, Heart,
  Laptop, Target,
} from "lucide-react";

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

// 10 distinct Apple-quality colors for goal progress bars (cycled by index)
export const GOAL_COLORS = [
  "#007AFF", // blue
  "#34C759", // green
  "#BF5AF2", // purple
  "#FF9500", // orange
  "#FF2D55", // rose
  "#5AC8FA", // sky
  "#FF6B35", // coral
  "#5856D6", // indigo
  "#30D158", // mint
  "#FF375F", // pink
];
