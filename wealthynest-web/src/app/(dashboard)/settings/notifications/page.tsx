"use client";

import {Bell} from "lucide-react";
import {Header} from "@/components/layout/Header";
import {PageWrapper} from "@/components/layout/PageWrapper";
import {PremiumIcon} from "@/components/icons/PremiumIcon";
import {Toggle} from "@/components/ui/Toggle";
import {type NotifPrefs, useNotificationStore} from "@/store/notification.store";
import {
    useNotificationPreferences,
    useUpdateNotificationPreferences,
} from "@/features/notifications/hooks/useServerNotifications";
import type {NotificationPreferences} from "@/features/notifications/api/notifications.api";

const NOTIF_ITEMS: { key: keyof NotifPrefs; label: string; description: string; emoji: string }[] = [
  { key: "budgets",    emoji: "🎯", label: "Budget alerts",        description: "Get warned when a budget category is nearly full or exceeded" },
  { key: "income",     emoji: "💰", label: "Income events",        description: "Dividends, bond coupons, and FD maturities credited in the last 7 days" },
  { key: "goals",      emoji: "🏁", label: "Goal milestones",      description: "Notify when a goal hits 50% or is fully achieved" },
  { key: "maturity",   emoji: "⏰", label: "Upcoming maturities",  description: "Alert for FDs and bonds maturing within the next 30 days" },
  { key: "lowBalance", emoji: "💳", label: "Low balance alerts",   description: "Get notified when an account balance drops to or below your alert threshold" },
  { key: "anomaly",    emoji: "🔥", label: "Unusual spend alerts", description: "Flag an expense that's well above your usual spend for that category" },
  { key: "debtDue",    emoji: "🤝", label: "Debt due reminders",   description: "Reminders when money you owe — or that's owed to you — is due" },
  { key: "loanEmi",    emoji: "🏦", label: "Loan EMI reminders",   description: "Alert before an EMI auto-payment is auto-paid" },
  { key: "sipReminder", emoji: "📈", label: "SIP reminders",       description: "Heads-up 2 days before a mutual fund's SIP day" },
];

// Only these 5 types are also generated server-side (scheduler/background jobs) — their on/off
// state has to reach the backend so it can stop creating them, not just hide them client-side.
// income/goals/maturity are derived purely from live client data, so local state is enough.
const BACKEND_PREF_KEY: Partial<Record<keyof NotifPrefs, keyof NotificationPreferences>> = {
  budgets:     "budgetAlertEnabled",
  lowBalance:  "lowBalanceEnabled",
  anomaly:     "spendAnomalyEnabled",
  debtDue:     "debtDueEnabled",
  loanEmi:     "loanEmiEnabled",
  sipReminder: "sipReminderEnabled",
};

export default function NotificationsPage() {
  const { prefs, setPref } = useNotificationStore();
  const { data: serverPrefs } = useNotificationPreferences();
  const updateServerPrefs     = useUpdateNotificationPreferences();

  const allOn  = Object.values(prefs).every(Boolean);
  const allOff = Object.values(prefs).every(v => !v);

  function toggle(key: keyof NotifPrefs, value: boolean) {
    setPref(key, value);
    const backendKey = BACKEND_PREF_KEY[key];
    if (!backendKey) return;
    const base: NotificationPreferences = serverPrefs ?? {
      budgetAlertEnabled: true, lowBalanceEnabled: true, spendAnomalyEnabled: true,
      debtDueEnabled: true, loanEmiEnabled: true, sipReminderEnabled: true,
    };
    updateServerPrefs.mutate({ ...base, [backendKey]: value });
  }

  function toggleAll(value: boolean) {
    (Object.keys(prefs) as (keyof NotifPrefs)[]).forEach((k) => toggle(k, value));
  }

  return (
    <div className="flex flex-col flex-1">
      <Header title="Notifications" subtitle="Choose what you get notified about" />
      <PageWrapper>
        <div className="max-w-lg md:max-w-3xl mx-auto space-y-6">

          {/* Icon header */}
          <div className="flex flex-col items-center gap-3 py-2">
            <PremiumIcon icon={Bell} tone="pink" size="xl" />
            <div className="text-center">
              <p className="text-base font-semibold text-foreground">Notification Preferences</p>
              <p className="text-xs text-muted-foreground mt-1">Choose which alerts you want to receive in the app.</p>
            </div>
          </div>

          {/* All-at-once toggle */}
          <div className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">All notifications</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {allOn ? "All alerts are on" : allOff ? "All alerts are off" : "Some alerts are on"}
              </p>
            </div>
            <Toggle
              testId="notif-pref-all"
              checked={!allOff}
              onChange={toggleAll}
            />
          </div>

          {/* Individual toggles */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
            {NOTIF_ITEMS.map(({ key, emoji, label, description }) => (
              <div key={key} className="flex items-start gap-4 px-4 py-4">
                <span className="text-xl mt-0.5 shrink-0">{emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
                </div>
                <Toggle testId={`notif-pref-${key}`} checked={prefs[key]} onChange={v => toggle(key, v)} />
              </div>
            ))}
          </div>

        </div>
      </PageWrapper>
    </div>
  );
}
