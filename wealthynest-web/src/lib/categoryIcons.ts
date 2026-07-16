import {
  Utensils, ShoppingCart, Car, Zap, Heart, BookOpen, Tv, ShoppingBag,
  Home, Shield, Briefcase, Building2, DollarSign, PlusCircle, Coffee,
  Gift, Smartphone, Music, Plane, Wrench, Wallet, Target, Star, Tag,
  Package, Baby, Dumbbell, Globe, Leaf, Bike, Bus, Flame, Lightbulb,
  Stethoscope, GraduationCap, Camera, Headphones, Pizza, Wine,
  TrendingUp, Banknote, Handshake, BarChart, Percent, Laptop, MoreHorizontal,
  type LucideIcon,
} from "lucide-react";
import { TONE_HEX } from "@/components/icons/PremiumIcon";

// ── Single source of truth for category icons ──────────────────────────────
// One kebab-case key vocabulary, used everywhere a Category's `icon` field is
// written or read: the DB seed migrations (V2/V16/V19__*.sql), the Settings →
// Categories picker, the budgets page's quick-add flow, and every resolver in
// categoryMeta.ts. Previously there were three incompatible vocabularies (this
// one, a PascalCase Lucide-component-name set in categoryMeta.ts, and a
// separate flat list hardcoded in the Settings page) that didn't share a
// single key — so a custom icon a user picked could never actually resolve.
// Keys and icon choices are unchanged from the pre-existing Settings page
// list (zero regression for the 18 already-seeded system categories); this
// just gives them one home and groups them for a nicer picker UI.

export interface CategoryIconEntry {
  key: string;
  label: string;
  icon: LucideIcon;
}

export interface CategoryIconGroup {
  key: string;
  title: string;
  items: CategoryIconEntry[];
}

export const CATEGORY_ICON_GROUPS: CategoryIconGroup[] = [
  {
    key: "food", title: "Food & Dining",
    items: [
      { key: "utensils",      label: "Dining",     icon: Utensils },
      { key: "shopping-cart", label: "Groceries",  icon: ShoppingCart },
      { key: "coffee",        label: "Coffee",     icon: Coffee },
      { key: "pizza",         label: "Fast Food",  icon: Pizza },
      { key: "wine",          label: "Bar & Wine", icon: Wine },
    ],
  },
  {
    key: "shopping", title: "Shopping",
    items: [
      { key: "shopping-bag", label: "Shopping", icon: ShoppingBag },
      { key: "package",      label: "Package",  icon: Package },
      { key: "tag",          label: "Tag",      icon: Tag },
      { key: "gift",         label: "Gifts",    icon: Gift },
    ],
  },
  {
    key: "transport", title: "Transport & Travel",
    items: [
      { key: "car",    label: "Car",      icon: Car },
      { key: "bus",    label: "Bus",      icon: Bus },
      { key: "bike",   label: "Bike",     icon: Bike },
      { key: "plane",  label: "Flights",  icon: Plane },
      { key: "globe",  label: "Travel",   icon: Globe },
    ],
  },
  {
    key: "home", title: "Home & Utilities",
    items: [
      { key: "home",       label: "Home",        icon: Home },
      { key: "zap",        label: "Electricity",  icon: Zap },
      { key: "lightbulb",  label: "Utilities",    icon: Lightbulb },
      { key: "flame",      label: "Gas",          icon: Flame },
      { key: "wrench",     label: "Maintenance",  icon: Wrench },
      { key: "smartphone", label: "Mobile & Internet", icon: Smartphone },
    ],
  },
  {
    key: "health", title: "Health & Fitness",
    items: [
      { key: "heart",       label: "Health",      icon: Heart },
      { key: "stethoscope", label: "Medical",     icon: Stethoscope },
      { key: "dumbbell",    label: "Fitness",     icon: Dumbbell },
    ],
  },
  {
    key: "education", title: "Education & Family",
    items: [
      { key: "book",       label: "Education", icon: BookOpen },
      { key: "graduation", label: "Tuition",    icon: GraduationCap },
      { key: "baby",       label: "Kids",       icon: Baby },
    ],
  },
  {
    key: "entertainment", title: "Entertainment & Lifestyle",
    items: [
      { key: "tv",         label: "Streaming",  icon: Tv },
      { key: "music",      label: "Music",      icon: Music },
      { key: "camera",     label: "Photography",icon: Camera },
      { key: "headphones", label: "Audio",      icon: Headphones },
      { key: "star",       label: "Leisure",    icon: Star },
      { key: "leaf",       label: "Wellness",   icon: Leaf },
    ],
  },
  {
    key: "finance", title: "Finance & Income",
    items: [
      { key: "wallet",      label: "Wallet",      icon: Wallet },
      { key: "dollar-sign", label: "Income",      icon: DollarSign },
      { key: "plus-circle", label: "Other Income",icon: PlusCircle },
      { key: "briefcase",   label: "Salary",      icon: Briefcase },
      { key: "building",    label: "Business",    icon: Building2 },
      { key: "laptop",      label: "Freelance",   icon: Laptop },
      { key: "handshake",   label: "Deals",       icon: Handshake },
      { key: "trending",    label: "Investments", icon: TrendingUp },
      { key: "chart",       label: "Reports",     icon: BarChart },
      { key: "banknote",    label: "Cash",        icon: Banknote },
      { key: "percent",     label: "Interest",    icon: Percent },
      { key: "shield",      label: "Insurance",   icon: Shield },
    ],
  },
  {
    key: "other", title: "Other",
    items: [
      { key: "target",          label: "Goal",  icon: Target },
      { key: "more-horizontal", label: "Other", icon: MoreHorizontal },
    ],
  },
];

export const CATEGORY_ICON_LIST: CategoryIconEntry[] = CATEGORY_ICON_GROUPS.flatMap(g => g.items);

export const CATEGORY_ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(
  CATEGORY_ICON_LIST.map(({ key, icon }) => [key, icon]),
);

export function getCategoryIconByKey(key?: string | null): LucideIcon | undefined {
  return key ? CATEGORY_ICON_MAP[key] : undefined;
}

// Apple's iOS system-color palette (same 21 tones used by PremiumIcon's glossy
// badges elsewhere) — the canonical swatch list for any category color picker,
// replacing the two separate, narrower ad-hoc lists that used to live in the
// Settings page (14 colors) and the budgets page's quick-add form (10 colors).
export const CATEGORY_COLOR_PALETTE: string[] = Object.values(TONE_HEX);

interface IconColorPair { icon?: string | null; color?: string | null; }

// Walks the registry in a fixed order and returns the first (icon, color) pair
// not already used — exactly — by an existing category of the same type. Used
// to pre-select a genuinely distinct combination when a user opens "New
// Category", so most people never have to think about collisions at all.
export function suggestUnusedCombo(existing: IconColorPair[]): { icon: string; color: string } {
  const used = new Set(
    existing
      .filter(c => c.icon && c.color)
      .map(c => `${c.icon}|${(c.color as string).toLowerCase()}`),
  );
  for (const color of CATEGORY_COLOR_PALETTE) {
    for (const { key: icon } of CATEGORY_ICON_LIST) {
      if (!used.has(`${icon}|${color.toLowerCase()}`)) return { icon, color };
    }
  }
  // Registry exhausted (46 icons × 21 colors = 966 combinations) — fall back
  // to the first pair rather than throwing; an exact visual duplicate at that
  // scale is no longer the interesting problem.
  return { icon: CATEGORY_ICON_LIST[0].key, color: CATEGORY_COLOR_PALETTE[0] };
}

// Finds an existing category (of the same type) whose icon AND color both
// exactly match — the one collision that actually hurts readability in a
// chart legend or list. Icon-only or color-only overlap is left alone; those
// are allowed on purpose (e.g. two subscriptions sharing a TV glyph).
export function findDuplicateCategory<T extends { id: string; icon?: string | null; color?: string | null }>(
  categories: T[], icon: string, color: string, excludeId?: string,
): T | undefined {
  const target = color.toLowerCase();
  return categories.find(c =>
    c.id !== excludeId && c.icon === icon && (c.color ?? "").toLowerCase() === target);
}

// Categories (of the same type) that already use this icon or this color,
// individually — powers the picker's small "also used by…" indicator on a
// swatch/icon tile. Purely informational, never blocks selection.
export function categoriesUsingIcon<T extends { id: string; name: string; icon?: string | null }>(
  categories: T[], icon: string, excludeId?: string,
): T[] {
  return categories.filter(c => c.id !== excludeId && c.icon === icon);
}

export function categoriesUsingColor<T extends { id: string; name: string; color?: string | null }>(
  categories: T[], color: string, excludeId?: string,
): T[] {
  const target = color.toLowerCase();
  return categories.filter(c => c.id !== excludeId && (c.color ?? "").toLowerCase() === target);
}
