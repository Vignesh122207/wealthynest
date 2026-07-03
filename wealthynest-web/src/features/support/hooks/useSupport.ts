import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supportApi } from "../api/support.api";
import { toast } from "sonner";
import type { CreateTicketPayload, ReplyPayload, TicketStatus } from "../types/support.types";

const KEYS = {
  mine:      (p: number) => ["tickets", "mine", p],
  ticket:    (id: string) => ["tickets", id],
  adminAll:  (s: string, p: number) => ["admin-tickets", s, p],
  openCount: () => ["admin-tickets", "count"],
};

// ── User hooks ────────────────────────────────────────────────────────────────

export function useMyTickets(page = 0) {
  return useQuery({
    queryKey: KEYS.mine(page),
    queryFn:  () => supportApi.getMyTickets(page),
  });
}

export function useTicket(id: string) {
  return useQuery({
    queryKey: KEYS.ticket(id),
    queryFn:  () => supportApi.getTicket(id),
    enabled:  !!id,
  });
}

export function useCreateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTicketPayload) => supportApi.createTicket(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tickets", "mine"] });
      toast.success("Ticket submitted! We'll get back to you soon.");
    },
    onError: () => toast.error("Failed to create ticket. Please try again."),
  });
}

export function useAddReply(ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ReplyPayload) => supportApi.addReply(ticketId, data),
    onSuccess: (updated) => {
      qc.setQueryData(KEYS.ticket(ticketId), updated);
    },
    onError: () => toast.error("Failed to send reply."),
  });
}

// ── Admin hooks ───────────────────────────────────────────────────────────────

export function useAdminTickets(status: string, page = 0, size = 15) {
  return useQuery({
    queryKey: [...KEYS.adminAll(status, page), size],
    queryFn:  () => supportApi.adminGetTickets(status as TicketStatus || undefined, page, size),
  });
}

export function useAdminTicket(id: string) {
  return useQuery({
    queryKey: KEYS.ticket(id),
    queryFn:  () => supportApi.adminGetTicket(id),
    enabled:  !!id,
  });
}

export function useAdminReply(ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ReplyPayload) => supportApi.adminReply(ticketId, data),
    onSuccess: (updated) => {
      qc.setQueryData(KEYS.ticket(ticketId), updated);
      qc.invalidateQueries({ queryKey: ["admin-tickets"] });
      toast.success("Reply sent.");
    },
    onError: () => toast.error("Failed to send reply."),
  });
}

export function useAdminUpdateStatus(ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ status, priority }: { status?: TicketStatus; priority?: string }) =>
      supportApi.adminUpdateStatus(ticketId, status, priority),
    onSuccess: (updated) => {
      qc.setQueryData(KEYS.ticket(ticketId), updated);
      qc.invalidateQueries({ queryKey: ["admin-tickets"] });
      toast.success("Ticket updated.");
    },
    onError: () => toast.error("Failed to update ticket."),
  });
}

export function useOpenTicketCount() {
  return useQuery({
    queryKey: KEYS.openCount(),
    queryFn:  supportApi.adminCountOpen,
    staleTime: 30_000,
  });
}
