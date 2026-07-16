import { AlertTriangle, Check, LogOut } from "lucide-react";
import { GlossyBadge } from "@/components/icons/PremiumIcon";
import { Button } from "@/components/ui/Button";
import { FormModalShell } from "@/components/ui/Modal";
import { FormModalHeader } from "@/components/transactions/FormModalHeader";
import { TransactionModalOverlay } from "@/components/transactions/TransactionModalOverlay";
import { cn, getInitials } from "@/lib/utils";
import { MEMBER_COLORS } from "../constants";
import type { FamilyMember } from "../types/family.types";

export function AdminLeaveModal({
  open, familyName, nonAdminMembers, memberColorMap, targetMember, setTargetMember,
  onConfirm, onCancel, transferring, leaving,
}: {
  open: boolean; familyName: string; nonAdminMembers: FamilyMember[];
  memberColorMap: Map<string, string>; targetMember: FamilyMember | null;
  setTargetMember: (m: FamilyMember | null) => void;
  onConfirm: () => void; onCancel: () => void;
  transferring: boolean; leaving: boolean;
}) {
  if (!open) return null;
  return (
    <TransactionModalOverlay onDismiss={onCancel}>
      <FormModalShell accent="from-amber-400 to-red-500">
          <FormModalHeader icon={AlertTriangle} tone="orange" title="Transfer admin before leaving" onClose={onCancel} />
          <p className="text-xs text-muted-foreground -mt-3 mb-4 leading-relaxed">
            Select a member to become the new admin, then you will leave{" "}
            <span className="font-medium text-foreground">{familyName}</span>.
          </p>

          {nonAdminMembers.length === 0 ? (
            <p className="text-xs text-muted-foreground bg-muted/60 rounded-xl px-3 py-2.5">
              No other members to transfer to. Remove all members first, or delete the group.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
              {nonAdminMembers.map((m, i) => (
                <button key={m.id}
                  onClick={() => setTargetMember(targetMember?.id === m.id ? null : m)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left",
                    targetMember?.id === m.id
                      ? "bg-indigo-500/10 border-indigo-500/40"
                      : "bg-muted/40 border-border hover:border-indigo-500/30"
                  )}>
                  <GlossyBadge hex={memberColorMap.get(m.id) ?? MEMBER_COLORS[i]} size="sm" className="shrink-0">
                    <span className="text-[10px] font-bold text-white">{getInitials(m.fullName)}</span>
                  </GlossyBadge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{m.fullName}</p>
                    <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                  </div>
                  {targetMember?.id === m.id && <Check className="w-4 h-4 text-indigo-500 shrink-0" />}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button onClick={onConfirm} disabled={!targetMember} variant="gradient" loading={transferring || leaving}
              className="flex-1 bg-gradient-to-r from-amber-500 to-red-600 hover:from-amber-400 hover:to-red-500 shadow-red-500/25 disabled:shadow-none">
              <LogOut className="w-3.5 h-3.5" />
              Transfer &amp; Leave
            </Button>
            <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          </div>
      </FormModalShell>
    </TransactionModalOverlay>
  );
}
