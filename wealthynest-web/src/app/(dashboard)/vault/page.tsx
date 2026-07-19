"use client";

import {useMemo, useState} from "react";
import dynamic from "next/dynamic";
import {Download, FileText, KeyRound, Search, Star} from "lucide-react";
import {Header} from "@/components/layout/Header";
import {FloatingActionButton} from "@/components/shared/FloatingActionButton";
import {EmptyState} from "@/components/shared/EmptyState";
import {QueryErrorState} from "@/components/shared/QueryErrorState";
import {ConfirmDialog} from "@/components/shared/ConfirmDialog";
import {Card} from "@/components/ui/Card";
import {PremiumIcon} from "@/components/icons/PremiumIcon";
import {FormInput} from "@/components/forms/FormInput";
import {GOAL_COLORS} from "@/lib/categoryMeta";
import {
  useCreateVaultItem, useDeleteVaultItem, useToggleVaultFavorite,
  useUpdateVaultItem, useVaultItems,
} from "@/features/vault/hooks/useVault";
import {useVaultAutoLock} from "@/features/vault/hooks/useVaultAutoLock";
import {VaultItemRow} from "@/features/vault/components/VaultItemRow";
import {VaultHealthCard} from "@/features/vault/components/VaultHealthCard";
import type {VaultItem, VaultItemPayload} from "@/features/vault/types/vault.types";
import type {VaultItemFormValues} from "@/features/vault/schemas/vault.schema";

const VaultItemForm     = dynamic(() => import("@/features/vault/components/VaultItemForm").then(m => m.VaultItemForm), { ssr: false });
const RevealSecretModal = dynamic(() => import("@/features/vault/components/RevealSecretModal").then(m => m.RevealSecretModal), { ssr: false });
const ExportVaultModal  = dynamic(() => import("@/features/vault/components/ExportVaultModal").then(m => m.ExportVaultModal), { ssr: false });

const VAULT_SLATE = "#64748b";

export default function VaultPage() {
  useVaultAutoLock();
  const [search, setSearch]         = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem]     = useState<VaultItem | null>(null);
  const [revealItem, setRevealItem] = useState<VaultItem | null>(null);
  const [confirmId, setConfirmId]   = useState<string | null>(null);
  const [showExport, setShowExport] = useState(false);

  const { data: items = [], isLoading, isError, refetch } = useVaultItems();
  const { mutate: createItem, isPending: creating } = useCreateVaultItem();
  const { mutate: updateItem, isPending: updating } = useUpdateVaultItem();
  const { mutate: deleteItem }                      = useDeleteVaultItem();
  const { mutate: toggleFavorite }                  = useToggleVaultFavorite();

  // Stable per-item accent, cycled by position in the full (unfiltered) list —
  // same approach GoalsPage uses for GoalCard's goalColor, so a row's color
  // doesn't shift around as search/sort narrows the visible set.
  const colorIndex = new Map(items.map((it, i) => [it.id, i]));
  const colorFor = (it: VaultItem) => GOAL_COLORS[(colorIndex.get(it.id) ?? 0) % GOAL_COLORS.length];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i =>
      i.title.toLowerCase().includes(q) ||
      i.username?.toLowerCase().includes(q) ||
      i.category?.toLowerCase().includes(q));
  }, [items, search]);

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

      {confirmId && (
        <ConfirmDialog open title="Delete Item"
          description="This item will be permanently deleted and cannot be recovered."
          confirmLabel="Delete" danger
          onConfirm={() => { deleteItem(confirmId); setConfirmId(null); }}
          onCancel={() => setConfirmId(null)} />
      )}

      {showCreate && (
        <VaultItemForm isCreate accentColor={VAULT_SLATE}
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
          onDelete={() => { setConfirmId(editItem.id); setEditItem(null); }} />
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

          {items.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Card className="p-4">
                <PremiumIcon icon={KeyRound} hex={VAULT_SLATE} size="xs" className="mb-2" />
                <p className="text-xs text-muted-foreground mb-1">Total Items</p>
                <p className="text-lg font-bold text-foreground tabular-nums">{items.length}</p>
              </Card>
              <Card className="p-4">
                <PremiumIcon icon={KeyRound} hex={VAULT_SLATE} size="xs" className="mb-2" />
                <p className="text-xs text-muted-foreground mb-1">Logins</p>
                <p className="text-lg font-bold text-foreground tabular-nums">{loginCount}</p>
              </Card>
              <Card className="p-4">
                <PremiumIcon icon={FileText} hex={VAULT_SLATE} size="xs" className="mb-2" />
                <p className="text-xs text-muted-foreground mb-1">Secure Notes</p>
                <p className="text-lg font-bold text-foreground tabular-nums">{noteCount}</p>
              </Card>
              <Card className="p-4">
                <PremiumIcon icon={Star} tone="yellow" size="xs" className="mb-2" />
                <p className="text-xs text-muted-foreground mb-1">Favorites</p>
                <p className="text-lg font-bold text-foreground tabular-nums">{favoriteCount}</p>
              </Card>
            </div>
          )}

          <Card className="overflow-hidden">
            {items.length > 0 && (
              <div className="px-5 py-3 border-b border-border flex items-center gap-3 flex-wrap">
                <PremiumIcon icon={KeyRound} hex={VAULT_SLATE} size="xs" />
                <span className="font-semibold text-foreground text-sm">Vault Items</span>
                <span className="text-xs text-muted-foreground">{filtered.length}</span>
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
                    className="flex items-center gap-2 text-white px-4 h-9 rounded-xl text-sm font-medium transition-all"
                    style={{ backgroundColor: VAULT_SLATE }}>
                    <KeyRound className="w-4 h-4" /> Add First Item
                  </button>
                } />
            ) : filtered.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">No items match &ldquo;{search}&rdquo;.</div>
            ) : (
              <div className="divide-y divide-border/40">
                {filtered.map(item => (
                  <VaultItemRow key={item.id} item={item} accentColor={colorFor(item)}
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
        { icon: KeyRound, label: "Add to Vault", color: "slate", testId: "fab-add-vault-item",
          onClick: () => { setShowCreate(true); setEditItem(null); } },
      ]} />
    </div>
  );
}
