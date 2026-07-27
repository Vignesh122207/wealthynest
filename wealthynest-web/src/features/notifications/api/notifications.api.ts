import {apiClient} from "@/lib/axios";
import type {ApiResponse} from "@/types/api.types";

export interface ServerNotification {
  id:        string;
  type:      string;
  title:     string;
  message:   string;
  read:      boolean;
  createdAt: string;
}

export interface NotificationPreferences {
  budgetAlertEnabled:  boolean;
  lowBalanceEnabled:   boolean;
  spendAnomalyEnabled: boolean;
  debtDueEnabled:      boolean;
  loanEmiEnabled:      boolean;
  sipReminderEnabled:  boolean;
}

export const notificationsApi = {
  getNotifications: async (): Promise<ServerNotification[]> =>
    (await apiClient.get<ApiResponse<ServerNotification[]>>("/notifications")).data.data,

  markAllRead: async (): Promise<void> => {
    await apiClient.post("/notifications/mark-all-read");
  },

  markRead: async (id: string): Promise<void> => {
    await apiClient.post(`/notifications/${id}/read`);
  },

  deleteNotification: async (id: string): Promise<void> => {
    await apiClient.delete(`/notifications/${id}`);
  },

  getPreferences: async (): Promise<NotificationPreferences> =>
    (await apiClient.get<ApiResponse<NotificationPreferences>>("/notifications/preferences")).data.data,

  updatePreferences: async (prefs: NotificationPreferences): Promise<NotificationPreferences> =>
    (await apiClient.put<ApiResponse<NotificationPreferences>>("/notifications/preferences", prefs)).data.data,

  registerDeviceToken: async (token: string): Promise<void> => {
    await apiClient.post("/notifications/device-tokens", { token });
  },

  unregisterDeviceToken: async (token: string): Promise<void> => {
    await apiClient.delete("/notifications/device-tokens", { params: { token } });
  },
};
