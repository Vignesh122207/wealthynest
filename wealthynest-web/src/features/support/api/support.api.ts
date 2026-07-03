import { apiClient } from "@/lib/axios";
import type { Ticket, CreateTicketPayload, ReplyPayload, TicketStatus } from "../types/support.types";
import type { PagedResponse } from "@/types/api.types";

const BASE = "/support/tickets";
const ADMIN = "/admin/tickets";

export const supportApi = {
  // ── User ───────────────────────────────────────────────────────────────────
  createTicket: (data: CreateTicketPayload): Promise<Ticket> =>
    apiClient.post(BASE, data).then(r => r.data),

  getMyTickets: (page = 0, size = 20): Promise<PagedResponse<Ticket>> =>
    apiClient.get(BASE, { params: { page, size } }).then(r => r.data),

  getTicket: (id: string): Promise<Ticket> =>
    apiClient.get(`${BASE}/${id}`).then(r => r.data),

  addReply: (id: string, data: ReplyPayload): Promise<Ticket> =>
    apiClient.post(`${BASE}/${id}/replies`, data).then(r => r.data),

  // ── Admin ──────────────────────────────────────────────────────────────────
  adminGetTickets: (status?: TicketStatus, page = 0, size = 20): Promise<PagedResponse<Ticket>> =>
    apiClient.get(ADMIN, { params: { status, page, size } }).then(r => r.data),

  adminGetTicket: (id: string): Promise<Ticket> =>
    apiClient.get(`${ADMIN}/${id}`).then(r => r.data),

  adminReply: (id: string, data: ReplyPayload): Promise<Ticket> =>
    apiClient.post(`${ADMIN}/${id}/replies`, data).then(r => r.data),

  adminUpdateStatus: (id: string, status?: TicketStatus, priority?: string): Promise<Ticket> =>
    apiClient.patch(`${ADMIN}/${id}/status`, { status, priority }).then(r => r.data),

  adminCountOpen: (): Promise<{ count: number }> =>
    apiClient.get(`${ADMIN}/count/open`).then(r => r.data),
};
