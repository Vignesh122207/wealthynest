"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { QUERY_KEYS } from "@/lib/constants";
import { familyApi } from "../api/family.api";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { apiErrorMessage } from "@/lib/utils";
import type { Expense } from "@/features/expenses/types/expense.types";

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
      qc.invalidateQueries({ queryKey: QUERY_KEYS.FAMILY });
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
      qc.invalidateQueries({ queryKey: QUERY_KEYS.FAMILY });
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
      qc.invalidateQueries({ queryKey: QUERY_KEYS.FAMILY });
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
      qc.invalidateQueries({ queryKey: [...QUERY_KEYS.FAMILY, "members", familyId] });
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
      qc.invalidateQueries({ queryKey: QUERY_KEYS.FAMILY });
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
