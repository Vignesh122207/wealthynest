import {create} from "zustand";
import {persist} from "zustand/middleware";

export interface NotifPrefs {
  budgets:    boolean;
  income:     boolean;
  goals:      boolean;
  maturity:   boolean;
  lowBalance: boolean;
  anomaly:    boolean;
  debtDue:    boolean;
  loanEmi:    boolean;
}

interface NotificationState {
  seenIds:      string[];
  dismissedIds: string[];
  prefs:        NotifPrefs;
  markSeen:  (ids: string[]) => void;
  dismiss:   (id: string) => void;
  setPref:   (key: keyof NotifPrefs, value: boolean) => void;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      seenIds: [],
      dismissedIds: [],
      prefs: {
        budgets: true, income: true, goals: true, maturity: true,
        lowBalance: true, anomaly: true, debtDue: true, loanEmi: true,
      },
      markSeen: (ids) =>
        set((s) => ({ seenIds: Array.from(new Set([...s.seenIds, ...ids])) })),
      dismiss: (id) =>
        set((s) => ({ dismissedIds: Array.from(new Set([...s.dismissedIds, id])) })),
      setPref: (key, value) =>
        set((s) => ({ prefs: { ...s.prefs, [key]: value } })),
    }),
    { name: "wn-notifications" }
  )
);
