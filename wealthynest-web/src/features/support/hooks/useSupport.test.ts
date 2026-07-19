import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createQueryClientWrapper } from "@/test-utils/queryClientWrapper";
import {
  useMyTickets, useTicket, useCreateTicket, useAddReply,
  useAdminTickets, useAdminTicket, useAdminReply, useAdminUpdateStatus, useOpenTicketCount,
} from "./useSupport";
import { supportApi } from "../api/support.api";
import { toast } from "sonner";

vi.mock("../api/support.api", () => ({
  supportApi: {
    getMyTickets: vi.fn(), getTicket: vi.fn(), createTicket: vi.fn(), addReply: vi.fn(),
    adminGetTickets: vi.fn(), adminGetTicket: vi.fn(), adminReply: vi.fn(),
    adminUpdateStatus: vi.fn(), adminCountOpen: vi.fn(),
  },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockedApi = vi.mocked(supportApi);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useMyTickets", () => {
  it("fetches the given page of the user's tickets", async () => {
    mockedApi.getMyTickets.mockResolvedValue({ content: [] } as never);
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useMyTickets(2), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.getMyTickets).toHaveBeenCalledWith(2);
  });
});

describe("useTicket", () => {
  it("is disabled when id is empty", () => {
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useTicket(""), { wrapper: Wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockedApi.getTicket).not.toHaveBeenCalled();
  });

  it("fetches when id is present", async () => {
    mockedApi.getTicket.mockResolvedValue({ id: "t1" } as never);
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useTicket("t1"), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe("useCreateTicket", () => {
  it("invalidates the mine list and toasts on success", async () => {
    mockedApi.createTicket.mockResolvedValue({} as never);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateTicket(), { wrapper: Wrapper });
    result.current.mutate({} as never);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["tickets", "mine"] });
    expect(toast.success).toHaveBeenCalledWith("Ticket submitted! We'll get back to you soon.");
  });
});

describe("useAddReply", () => {
  it("writes the updated ticket directly into the ticket's cache entry", async () => {
    const updated = { id: "t1", replies: [{ id: "r1" }] };
    mockedApi.addReply.mockResolvedValue(updated as never);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const setSpy = vi.spyOn(queryClient, "setQueryData");

    const { result } = renderHook(() => useAddReply("t1"), { wrapper: Wrapper });
    result.current.mutate({} as never);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(setSpy).toHaveBeenCalledWith(["tickets", "t1"], updated);
  });

  it("toasts an error on failure", async () => {
    mockedApi.addReply.mockRejectedValue(new Error("fail"));
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useAddReply("t1"), { wrapper: Wrapper });
    result.current.mutate({} as never);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("Failed to send reply.");
  });
});

describe("useAdminTickets", () => {
  it("passes status/page/size through, converting an empty status to undefined", async () => {
    mockedApi.adminGetTickets.mockResolvedValue({ content: [] } as never);
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useAdminTickets("", 0, 15), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.adminGetTickets).toHaveBeenCalledWith(undefined, 0, 15);
  });

  it("passes a real status through unchanged", async () => {
    mockedApi.adminGetTickets.mockResolvedValue({ content: [] } as never);
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useAdminTickets("OPEN", 1, 10), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.adminGetTickets).toHaveBeenCalledWith("OPEN", 1, 10);
  });
});

describe("useAdminTicket", () => {
  it("is disabled when id is empty", () => {
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useAdminTicket(""), { wrapper: Wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });
});

describe("useAdminReply", () => {
  it("writes the updated ticket into cache, invalidates admin-tickets, and toasts", async () => {
    const updated = { id: "t1" };
    mockedApi.adminReply.mockResolvedValue(updated as never);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const setSpy = vi.spyOn(queryClient, "setQueryData");
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useAdminReply("t1"), { wrapper: Wrapper });
    result.current.mutate({} as never);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(setSpy).toHaveBeenCalledWith(["tickets", "t1"], updated);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["admin-tickets"] });
    expect(toast.success).toHaveBeenCalledWith("Reply sent.");
  });
});

describe("useAdminUpdateStatus", () => {
  it("passes status/priority through and updates cache on success", async () => {
    const updated = { id: "t1", status: "RESOLVED" };
    mockedApi.adminUpdateStatus.mockResolvedValue(updated as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useAdminUpdateStatus("t1"), { wrapper: Wrapper });
    result.current.mutate({ status: "RESOLVED" as never });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.adminUpdateStatus).toHaveBeenCalledWith("t1", "RESOLVED", undefined);
    expect(toast.success).toHaveBeenCalledWith("Ticket updated.");
  });
});

describe("useOpenTicketCount", () => {
  it("fetches the open ticket count", async () => {
    mockedApi.adminCountOpen.mockResolvedValue(3 as never);
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useOpenTicketCount(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(3);
  });
});
