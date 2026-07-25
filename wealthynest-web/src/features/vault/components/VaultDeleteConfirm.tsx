"use client";

import {Trash2} from "lucide-react";
import {Button} from "@/components/ui/Button";
import {FormModalShell} from "@/components/ui/FormModalShell";
import {TransactionModalOverlay} from "@/components/transactions/TransactionModalOverlay";
import type {VaultItem} from "../types/vault.types";
import {VaultModalHeader} from "./VaultModalHeader";

// Vault's own delete confirmation — VaultModalHeader's dark-red `danger` variant instead of the
// shared ConfirmDialog every other feature (Budgets, Goals, Debts…) uses, so destroying a saved
// password/note carries the same "vault door" weight as the rest of Vault's chrome rather than
// looking like a generic app dialog. Single call site (VaultPage) — kept as its own file for
// readability, not for reuse. Test ids match ConfirmDialog's own (`confirm-dialog-confirm` /
// `-cancel`) so the existing Playwright vault flows keep working unchanged.
export function VaultDeleteConfirm({ item, onConfirm, onCancel }: {
  item: VaultItem;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <TransactionModalOverlay onDismiss={onCancel} maxWidth="max-w-sm">
      {/* no accent strip — VaultModalHeader's own banner covers this real estate. */}
      <FormModalShell accent="none">
        <VaultModalHeader icon={Trash2} hex="#e5484d" danger
          title="Delete item" subtitle="This can't be undone" onClose={onCancel} />
        <p className="text-sm text-muted-foreground mb-4">
          <strong className="text-foreground font-semibold">{item.title}</strong> will be permanently
          deleted from your vault, including its saved {item.itemType === "LOGIN" ? "password" : "note"}
          {item.itemType === "LOGIN" && item.hasTotp ? " and 2FA secret" : ""}.
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" data-testid="confirm-dialog-cancel" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" variant="danger" className="flex-1" data-testid="confirm-dialog-confirm" onClick={onConfirm}>
            <Trash2 className="w-4 h-4" /> Delete
          </Button>
        </div>
      </FormModalShell>
    </TransactionModalOverlay>
  );
}
