"use client";

import {useMemo, useState} from "react";
import dynamic from "next/dynamic";
import {Download, FileText, KeyRound, LayoutGrid, Search, Star} from "lucide-react";
import {Header} from "@/components/layout/Header";
import {FloatingActionButton} from "@/components/shared/FloatingActionButton";
import {EmptyState} from "@/components/shared/EmptyState";
import {QueryErrorState} from "@/components/shared/QueryErrorState";
import {Card} from "@/components/ui/Card";
import {FormInput} from "@/components/forms/FormInput";
import {TabBar, type TabBarItem} from "@/components/ui/TabBar";
import {useTabParam} from "@/hooks/useTabParam";
import {GOAL_COLORS, getVaultCategoryColor} from "@/lib/categoryMeta";
import {
  useCreateVaultItem, useDeleteVaultItem, useToggleVaultFavorite,
  useUpdateVaultItem, useVaultHealth, useVaultItems,
} from "@/features/vault/hooks/useVault";
import {useVaultAutoLock} from "@/features/vault/hooks/useVaultAutoLock";
import {VaultItemRow} from "@/features/vault/components/VaultItemRow";
import {VaultHealthCard} from "@/features/vault/components/VaultHealthCard";
import type {VaultItem, VaultItemPayload} from "@/features/vault/types/vault.types";
import type {VaultItemFormValues} from "@/features/vault/schemas/vault.schema";

const VaultItemForm      = dynamic(() => import("@/features/vault/components/VaultItemForm").then(m => m.VaultItemForm), { ssr: false });
const RevealSecretModal  = dynamic(() => import("@/features/vault/components/RevealSecretModal").then(m => m.RevealSecretModal), { ssr: false });
const ExportVaultModal   = dynamic(() => import("@/features/vault/components/ExportVaultModal").then(m => m.ExportVaultModal), { ssr: false });
const VaultDeleteConfirm = dynamic(() => import("@/features/vault/components/VaultDeleteConfirm").then(m => m.VaultDeleteConfirm), { ssr: false });

// Vault's own brass/graphite accent — replaces the old flat slate, see VaultHealthCard for the
// full "vault door" treatment this echoes.
const VAULT_BRASS = "#d4a72c";
const VAULT_BRASS_DEEP = "#a9791a";

// Shared TabBar template, same as Accounts' AccountFilterTabs.
const TYPE_FILTERS = [
  { key: "all" as const,      label: "All",        icon: LayoutGrid },
  { key: "LOGIN" as const,    label: "Logins",     icon: KeyRound },
  { key: "NOTE" as const,     label: "Notes",      icon: FileText },
  { key: "FAVORITE" as const, label: "Favorites",  icon: Star },
];
type TypeFilter = (typeof TYPE_FILTERS)[number]["key"];
const TYPE_FILTER_KEYS = TYPE_FILTERS.map((f) => f.key);

const TYPE_FILTER_COLOR: Record<TypeFilter, string> = {
  all:      "#475569",
  LOGIN:    "#2563eb",
  NOTE:     "#7c3aed",
  FAVORITE: "#f59e0b",
};

export default function VaultPage() {
  useVaultAutoLock();
  const [search, setSearch]         = useState("");
  const [typeFilter, setTypeFilter] = useTabParam<TypeFilter>(TYPE_FILTER_KEYS, "all");
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem]     = useState<VaultItem | null>(null);
  const [revealItem, setRevealItem]   = useState<VaultItem | null>(null);
  const [confirmItem, setConfirmItem] = useState<VaultItem | null>(null);
  const [showExport, setShowExport]   = useState(false);

  const { data: items = [], isLoading, isError, refetch } = useVaultItems();
  const { data: health }                                  = useVaultHealth();
  const { mutate: createItem, isPending: creating } = useCreateVaultItem();
  const { mutate: updateItem, isPending: updating } = useUpdateVaultItem();
  const { mutate: deleteItem }                      = useDeleteVaultItem();
  const { mutate: toggleFavorite }                  = useToggleVaultFavorite();

  // Stable per-item accent, cycled by position in the full (unfiltered) list —
  // same approach GoalsPage uses for GoalCard's goalColor — but a recognized vault category
  // (Banking, Work…) wins first so every item in that category reads as the same color instead
  // of drifting with list position.
  const colorIndex = new Map(items.map((it, i) => [it.id, i]));
  const colorFor = (it: VaultItem) =>
    getVaultCategoryColor(it.category, GOAL_COLORS[(colorIndex.get(it.id) ?? 0) % GOAL_COLORS.length]);

  // Worst issue per item (breached > weak > reused, applied in that order so a later set
  // overwrites) — mirrors VaultHealthCard's own lists so a row carries the same signal without
  // needing the health card expanded.
  const healthFlagFor = useMemo(() => {
    const map = new Map<string, "reused" | "weak" | "breached">();
    if (health) {
      health.reusedItems.forEach((i) => map.set(i.id, "reused"));
      health.weakItems.forEach((i) => map.set(i.id, "weak"));
      health.breachedItems.forEach((i) => map.set(i.id, "breached"));
    }
    return map;
  }, [health]);

  const filtered = useMemo(() => {
    let list = items;
    if (typeFilter === "LOGIN") list = list.filter(i => i.itemType === "LOGIN");
    else if (typeFilter === "NOTE") list = list.filter(i => i.itemType === "SECURE_NOTE");
    else if (typeFilter === "FAVORITE") list = list.filter(i => i.favorite);

    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(i =>
      i.title.toLowerCase().includes(q) ||
      i.username?.toLowerCase().includes(q) ||
      i.category?.toLowerCase().includes(q) ||
      i.url?.toLowerCase().includes(q));
  }, [items, search, typeFilter]);

  const loginCount    = items.filter(i => i.itemType === "LOGIN").length;
  const noteCount     = items.filter(i => i.itemType === "SECURE_NOTE").length;
  const favoriteCount = items.filter(i => i.favorite).length;

  const toPayload = (v: VaultItemFormValues): VaultItemPayload => ({
    itemType: v.itemType, title: v.title,
    username: v.username || undefined, url: v.url || undefined,
    category: v.category || undefined, icon: v.icon || undefined, secret: v.secret || undefined,
    // Not `|| undefined` — "" is a meaningful "remove the existing TOTP secret" signal,
    // distinct from undefined ("the user never touched this field, leave it alone").
    totpSecret: v.totpSecret,
  });

  const onCreateSubmit = (v: VaultItemFormValues) =>
    createItem(toPayload(v), { onSuccess: () => setShowCreate(false) });

  const onUpdateSubmit = (v: VaultItemFormValues) => {
    if (!editItem) return;
    updateItem({ id: editItem.id, payload: toPayload(v) }, { onSuccess: () => setEditItem(null) });
  };

  return (
    <div className="flex flex-col flex-1">
      <Header title="Vault" subtitle="Passwords and secure notes, encrypted at rest" />

      {confirmItem && (
        <VaultDeleteConfirm item={confirmItem}
          onConfirm={() => { deleteItem(confirmItem.id); setConfirmItem(null); }}
          onCancel={() => setConfirmItem(null)} />
      )}

      {showCreate && (
        <VaultItemForm isCreate accentColor={VAULT_BRASS}
          // Defaults to whatever type the active tab implies (e.g. opening the FAB from the Notes
          // tab starts a Secure Note instead of always defaulting to Login) — LOGIN/Favorites/All
          // still default to LOGIN, matching the prior behavior.
          defaultValues={{ itemType: typeFilter === "NOTE" ? "SECURE_NOTE" : "LOGIN" }}
          onSubmit={onCreateSubmit} onCancel={() => setShowCreate(false)} isPending={creating} />
      )}

      {editItem && (
        <VaultItemForm isCreate={false} accentColor={colorFor(editItem)}
          defaultValues={{
            itemType: editItem.itemType, title: editItem.title,
            // `?? undefined` — the API returns JSON `null` for unset optional fields, but the
            // form schema's `.optional()` only accepts `undefined`, not `null`; without this,
            // editing an item that has no username/url/category/icon fails validation silently
            // (react-hook-form's onInvalid fires, but nothing in the UI surfaces it).
            username: editItem.username ?? undefined, url: editItem.url ?? undefined,
            category: editItem.category ?? undefined, icon: editItem.icon ?? undefined,
          }}
          hasExistingTotp={editItem.hasTotp}
          onSubmit={onUpdateSubmit} onCancel={() => setEditItem(null)} isPending={updating}
          onDelete={() => { setConfirmItem(editItem); setEditItem(null); }} />
      )}

      {revealItem && (
        <RevealSecretModal item={revealItem} accentColor={colorFor(revealItem)} onClose={() => setRevealItem(null)} />
      )}

      {showExport && <ExportVaultModal onClose={() => setShowExport(false)} />}

      <main className="flex-1 p-4 md:p-5 lg:p-6 pb-36 lg:pb-24 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-5">

          {items.length > 0 && (
            <VaultHealthCard items={items} onEditItem={(item) => { setEditItem(item); setShowCreate(false); }} />
          )}

          <Card className="overflow-hidden">
            {items.length > 0 && (
              <div className="px-5 py-3 border-b border-border flex items-center gap-3 flex-wrap">
                {/* min-w-0 + w-full (not shrink-0, which pinned this to its full intrinsic content
                    width and left overflow-x-auto nothing to actually scroll) — lets this flex
                    item shrink to the row's real available width on mobile so the tabs become a
                    genuine horizontal scroller instead of spilling past the card and getting
                    silently clipped by its overflow-hidden, with Favorites unreachable. */}
                <TabBar
                  className="min-w-0 w-full sm:w-auto"
                  items={TYPE_FILTERS.map((f): TabBarItem<TypeFilter> => ({
                    key: f.key, label: f.label, icon: f.icon, color: TYPE_FILTER_COLOR[f.key],
                    // "All" stays uncounted, same convention as every other TabBar's neutral
                    // item (Accounts, Debts, Investments, Admin) — only the real categories show
                    // a count.
                    count: f.key === "all" ? undefined
                      : f.key === "LOGIN" ? loginCount
                      : f.key === "NOTE" ? noteCount
                      : favoriteCount,
                  }))}
                  value={typeFilter}
                  onChange={setTypeFilter}
                  testIdPrefix="vault-type-filter"
                />
                <div className="ml-auto flex items-center gap-3 w-full sm:w-auto">
                  <button type="button" onClick={() => setShowExport(true)} data-testid="vault-export-open"
                    className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors shrink-0">
                    <Download className="w-3.5 h-3.5" /> Export
                  </button>
                  <div className="w-full sm:w-64">
                    <FormInput placeholder="Search…" value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      endAdornment={<Search className="w-4 h-4 text-muted-foreground/60" />} />
                  </div>
                </div>
              </div>
            )}

            {isLoading ? (
              <div className="p-5 space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="h-14 bg-muted/40 rounded-xl animate-pulse" />)}
              </div>
            ) : isError ? (
              <QueryErrorState onRetry={() => refetch()} description="Couldn't load your vault. Check your connection and try again." />
            ) : items.length === 0 ? (
              <EmptyState icon={KeyRound} title="Your vault is empty"
                description="Save passwords and secure notes here — encrypted, and only revealed after you confirm your account password."
                action={
                  <button onClick={() => setShowCreate(true)}
                    className="flex items-center gap-2 px-4 h-9 rounded-xl text-sm font-semibold transition-all hover:brightness-105"
                    style={{ background: `linear-gradient(135deg, #f6d776, ${VAULT_BRASS_DEEP})`, color: "#241705" }}>
                    <KeyRound className="w-4 h-4" /> Add First Item
                  </button>
                } />
            ) : filtered.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                {search ? <>No items match &ldquo;{search}&rdquo;.</> : "No items in this view."}
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {filtered.map(item => (
                  <VaultItemRow key={item.id} item={item} accentColor={colorFor(item)}
                    healthFlag={healthFlagFor.get(item.id)}
                    onReveal={() => setRevealItem(item)}
                    onEdit={() => setEditItem(item)}
                    onToggleFavorite={() => toggleFavorite(item.id)} />
                ))}
              </div>
            )}
          </Card>
        </div>
      </main>

      <FloatingActionButton actions={[
        { icon: KeyRound, label: "Add to Vault", color: "vaultBrass", testId: "fab-add-vault-item",
          onClick: () => { setShowCreate(true); setEditItem(null); } },
      ]} />
    </div>
  );
}
