import {create} from "zustand";
import {persist} from "zustand/middleware";

export interface NotifPrefs {
  budgets:  boolean;
  income:   boolean;
  goals:    boolean;
  maturity: boolean;
}

interface NotificationState {
  seenIds: string[];
  prefs:   NotifPrefs;
  markSeen:  (ids: string[]) => void;
  setPref:   (key: keyof NotifPrefs, value: boolean) => void;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      seenIds: [],
      prefs: { budgets: true, income: true, goals: true, maturity: true },
      markSeen: (ids) =>
        set((s) => ({ seenIds: Array.from(new Set([...s.seenIds, ...ids])) })),
      setPref: (key, value) =>
        set((s) => ({ prefs: { ...s.prefs, [key]: value } })),
    }),
    { name: "wn-notifications" }
  )
);
