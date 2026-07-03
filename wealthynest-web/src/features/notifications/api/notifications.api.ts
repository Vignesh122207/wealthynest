import { apiClient } from "@/lib/axios";
import type { ApiResponse } from "@/types/api.types";

export interface ServerNotification {
  id:        string;
  type:      string;
  title:     string;
  message:   string;
  read:      boolean;
  createdAt: string;
}

export const notificationsApi = {
  getNotifications: async (): Promise<ServerNotification[]> =>
    (await apiClient.get<ApiResponse<ServerNotification[]>>("/notifications")).data.data,

  getUnreadCount: async (): Promise<number> =>
    (await apiClient.get<ApiResponse<number>>("/notifications/unread-count")).data.data,

  markAllRead: async (): Promise<void> => {
    await apiClient.post("/notifications/mark-all-read");
  },
};
