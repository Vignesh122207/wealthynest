"use client";

import {type QueryClient, useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "sonner";
import {QUERY_KEYS} from "@/lib/constants";
import {familyApi} from "../api/family.api";
import {useAuthStore} from "@/features/auth/store/auth.store";
import {apiErrorMessage} from "@/lib/utils";
import type {Expense} from "@/features/expenses/types/expense.types";

// Every place a user's family membership actually changes (create/join/leave/delete a group,
// or an admin removing someone) re-scopes exactly the domains FamilyServiceImpl's
// migrateExistingData/detachExistingData touch on the backend — assets, liabilities, expenses,
// budgets, and categories all flip between personal and shared. Missing any one of these here is
// exactly the bug this fixes: the page in question (Budgets, in the report that found this) kept
// showing pre-change data until a manual refresh forced a refetch. family-expenses/family-net-worth/
// family-monthly-stats don't need listing — they're keyed by familyId itself, so that value
// changing already makes React Query treat them as a different query, no invalidation required.
//
// QUERY_KEYS.FAMILY itself is deliberately NOT included here — see invalidateOwnFamilyIdentity
// and evictOwnFamilyIdentity below for why it needs different handling per mutation.
function invalidateFamilyScopedData(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: QUERY_KEYS.ASSETS });
  qc.invalidateQueries({ queryKey: QUERY_KEYS.NET_WORTH });
  qc.invalidateQueries({ queryKey: QUERY_KEYS.NET_WORTH_SUMMARY });
  qc.invalidateQueries({ queryKey: QUERY_KEYS.LIABILITIES });
  qc.invalidateQueries({ queryKey: QUERY_KEYS.EXPENSES });
  qc.invalidateQueries({ queryKey: QUERY_KEYS.BUDGETS });
  qc.invalidateQueries({ queryKey: QUERY_KEYS.CATEGORIES });
  qc.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNTS });
  qc.invalidateQueries({ queryKey: QUERY_KEYS.DASHBOARD });
}

// useFamily()'s queryFn calls familyApi.getFamily(user.familyId) — unlike the domain queries
// above (which take no familyId param and always resolve fresh server-side scoping on whatever
// request eventually fires), this one bakes a *client-held* familyId into the request itself.
// setUser() and invalidateQueries() both run synchronously in the same onSuccess callback, but
// setUser()'s effect on the `user` this hook closes over only lands on React's *next* render —
// so an immediate invalidateQueries() here refetches using the *old* familyId, which the server
// now rejects (family gone, or this user no longer in it) with 403 "Not a member of this family".
// That 403 hits the global QueryCache onError handler and toasts — once for useFamily(), a second
// time for useFamilyMembers() (same "family" key prefix, so invalidating one refetches both).
//
// Used when the acting user KEEPS their family membership afterward (create/join a new one, or
// an admin removing someone else) — the closure's familyId is still valid, so a refetch is safe
// and desired (e.g. removeMember wants the member list to visibly update).
function invalidateOwnFamilyIdentity(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: QUERY_KEYS.FAMILY });
}

// Used when the acting user's OWN family membership just ended (leave/delete) — evicts the
// cached family + members data instead of refetching it. Once React re-renders with the updated
// (cleared) familyId from setUser(), useFamily()'s `enabled` flag goes false on its own; there's
// nothing left to fetch, so no request — and no error — ever fires.
function evictOwnFamilyIdentity(qc: QueryClient) {
  qc.removeQueries({ queryKey: QUERY_KEYS.FAMILY });
}

export function useFamily() {
  const { user } = useAuthStore();
  return useQuery({
    queryKey: QUERY_KEYS.FAMILY,
    queryFn:  () => familyApi.getFamily(user!.familyId!),
    enabled:  !!user?.familyId,
  });
}

export function useFamilyMembers(familyId: string | undefined) {
  return useQuery({
    queryKey: [...QUERY_KEYS.FAMILY, "members", familyId],
    queryFn:  () => familyApi.getMembers(familyId!),
    enabled:  !!familyId,
  });
}

export function useCreateFamily() {
  const qc = useQueryClient();
  const { setUser, user } = useAuthStore();
  return useMutation({
    mutationFn: (name: string) => familyApi.createFamily(name),
    onSuccess: (family) => {
      if (user) setUser({ ...user, familyId: family.id, role: "FAMILY_ADMIN" });
      invalidateFamilyScopedData(qc);
      invalidateOwnFamilyIdentity(qc);
      toast.success("Family created!");
    },
    onError: () => toast.error("Failed to create family"),
  });
}

export function useJoinFamily() {
  const qc = useQueryClient();
  const { setUser, user } = useAuthStore();
  return useMutation({
    mutationFn: (inviteCode: string) => familyApi.joinFamily(inviteCode),
    onSuccess: (family) => {
      if (user) setUser({ ...user, familyId: family.id, role: "MEMBER" });
      invalidateFamilyScopedData(qc);
      invalidateOwnFamilyIdentity(qc);
      toast.success("Joined family!");
    },
    onError: (e: unknown) => {
      const msg = apiErrorMessage(e, "");
      if (msg.toLowerCase().includes("already")) toast.error("You are already in a family group.");
      else toast.error("Invalid invite code. Please check and try again.");
    },
  });
}

export function useRenameFamily() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => familyApi.renameFamily(id, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.FAMILY });
      toast.success("Family renamed!");
    },
    onError: () => toast.error("Failed to rename family"),
  });
}

export function useLeaveFamily() {
  const qc = useQueryClient();
  const { setUser, user } = useAuthStore();
  return useMutation({
    mutationFn: () => familyApi.leaveFamily(),
    onSuccess: () => {
      if (user) setUser({ ...user, familyId: undefined, role: "MEMBER" });
      invalidateFamilyScopedData(qc);
      evictOwnFamilyIdentity(qc);
      toast.success("You have left the family group.");
    },
    onError: (e: unknown) => toast.error(apiErrorMessage(e, "Cannot leave family")),
  });
}

export function useRemoveMember(familyId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => familyApi.removeMember(familyId!, memberId),
    onSuccess: () => {
      // The removed member's data detaches from every shared view (their expenses/budgets/etc.
      // stop counting toward the family's totals) — same re-scoping as create/join/leave/delete.
      // The acting admin's own familyId is unchanged here, so a refetch is safe (unlike leave/delete).
      invalidateFamilyScopedData(qc);
      invalidateOwnFamilyIdentity(qc);
      toast.success("Member removed.");
    },
    onError: () => toast.error("Failed to remove member"),
  });
}

export function useDeleteFamily() {
  const qc = useQueryClient();
  const { setUser, user } = useAuthStore();
  return useMutation({
    mutationFn: (id: string) => familyApi.deleteFamily(id),
    onSuccess: () => {
      if (user) setUser({ ...user, familyId: undefined, role: user.role === "ADMIN" ? "ADMIN" : "MEMBER" });
      invalidateFamilyScopedData(qc);
      evictOwnFamilyIdentity(qc);
      toast.success("Family group deleted.");
    },
    onError: () => toast.error("Failed to delete family"),
  });
}

export function useFamilyExpenses(familyId: string | undefined, startDate?: string, endDate?: string) {
  return useQuery<Expense[]>({
    queryKey: ["family-expenses", familyId, startDate, endDate],
    queryFn:  () => familyApi.getFamilyExpenses(familyId!, startDate, endDate),
    enabled:  !!familyId,
    staleTime: 60_000,
  });
}

export function useFamilyNetWorth(familyId: string | undefined) {
  return useQuery<number>({
    queryKey: ["family-net-worth", familyId],
    queryFn:  () => familyApi.getFamilyNetWorth(familyId!),
    enabled:  !!familyId,
    staleTime: 60_000,
  });
}

export function useFamilyMonthlyStats(familyId: string | undefined, year: number, month: number) {
  return useQuery({
    queryKey: ["family-monthly-stats", familyId, year, month],
    queryFn:  () => familyApi.getFamilyMonthlyStats(familyId!, year, month),
    enabled:  !!familyId,
    staleTime: 60_000,
  });
}

export function useTransferAdmin(familyId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (newAdminId: string) => familyApi.transferAdmin(familyId!, newAdminId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.FAMILY });
      qc.invalidateQueries({ queryKey: [...QUERY_KEYS.FAMILY, "members", familyId] });
      toast.success("Member promoted to admin.");
    },
    onError: (e: unknown) => toast.error(apiErrorMessage(e, "Failed to promote admin")),
  });
}

export function useRevokeAdmin(familyId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (targetId: string) => familyApi.revokeAdmin(familyId!, targetId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.FAMILY });
      qc.invalidateQueries({ queryKey: [...QUERY_KEYS.FAMILY, "members", familyId] });
      toast.success("Admin access revoked.");
    },
    onError: (e: unknown) => toast.error(apiErrorMessage(e, "Failed to revoke admin")),
  });
}
