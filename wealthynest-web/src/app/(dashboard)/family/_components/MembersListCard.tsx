import { Users } from "lucide-react";
import { PremiumIcon } from "@/components/icons/PremiumIcon";
import { MemberRow } from "@/features/family/components/MemberRow";
import { MEMBER_COLORS } from "@/features/family/constants";
import type { FamilyMember } from "@/features/family/types/family.types";

// ── Members list ───────────────────────────────────────────────────────────────

export function MembersListCard({
  members, currentUserId, isAdmin, isFull, onMakeAdmin, onRevokeAdmin, onRemove,
}: {
  members:       FamilyMember[];
  currentUserId: string | undefined;
  isAdmin:       boolean;
  isFull:        boolean;
  onMakeAdmin:   (m: FamilyMember) => void;
  onRevokeAdmin: (m: FamilyMember) => void;
  onRemove:      (m: FamilyMember) => void;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PremiumIcon icon={Users} tone="magenta" size="xs" />
          <h3 className="text-sm font-semibold text-foreground">Members</h3>
          <span className="text-xs text-muted-foreground">{members.length}</span>
        </div>
        {isFull && (
          <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">Full</span>
        )}
      </div>
      <div className="divide-y divide-border">
        {members.map((m, i) => (
          <MemberRow key={m.id} member={m} isSelf={m.id === currentUserId}
            isCurrentUserAdmin={isAdmin} color={MEMBER_COLORS[i % MEMBER_COLORS.length]}
            onMakeAdmin={onMakeAdmin}
            onRevokeAdmin={onRevokeAdmin}
            onRemove={onRemove}
          />
        ))}
      </div>
    </div>
  );
}
