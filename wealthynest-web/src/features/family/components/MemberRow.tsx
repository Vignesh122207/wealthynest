import {Crown, ShieldOff, UserMinus} from "lucide-react";
import {GlossyBadge} from "@/components/icons/PremiumIcon";
import {getInitials} from "@/lib/utils";
import type {FamilyMember} from "../types/family.types";

export function MemberRow({
  member, isSelf, isCurrentUserAdmin, color, onMakeAdmin, onRevokeAdmin, onRemove,
}: {
  member: FamilyMember; isSelf: boolean; isCurrentUserAdmin: boolean; color: string;
  onMakeAdmin: (m: FamilyMember) => void; onRevokeAdmin: (m: FamilyMember) => void; onRemove: (m: FamilyMember) => void;
}) {
  const memberIsAdmin   = member.role === "FAMILY_ADMIN" || member.role === "ADMIN";
  const canRevokeAdmin  = memberIsAdmin && member.role !== "ADMIN"; // can't revoke app-level ADMIN
  return (
    <div className="flex items-center gap-3 py-3 px-4" data-testid="member-row">
      <GlossyBadge hex={color} size="sm" className="shrink-0">
        <span className="text-[11px] font-bold text-white">{getInitials(member.fullName)}</span>
      </GlossyBadge>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-foreground truncate">{member.fullName}</p>
          {isSelf && <span className="text-[11px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">You</span>}
        </div>
        <p className="text-xs text-muted-foreground truncate">{member.email}</p>
      </div>
      {memberIsAdmin ? (
        <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
          <Crown className="w-3 h-3" /> Admin
        </span>
      ) : (
        <span className="text-[11px] font-medium px-2 py-1 rounded-lg bg-muted text-muted-foreground shrink-0">Member</span>
      )}
      {isCurrentUserAdmin && !isSelf && (
        <div className="flex items-center gap-1 shrink-0">
          {!memberIsAdmin && (
            <button onClick={() => onMakeAdmin(member)} title="Make admin"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 transition-all">
              <Crown className="w-3.5 h-3.5" />
            </button>
          )}
          {canRevokeAdmin && (
            <button onClick={() => onRevokeAdmin(member)} title="Revoke admin"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-orange-500 hover:bg-orange-500/10 transition-all">
              <ShieldOff className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={() => onRemove(member)} title="Remove from family"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all">
            <UserMinus className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
