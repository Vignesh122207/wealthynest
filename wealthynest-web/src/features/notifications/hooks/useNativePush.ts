"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { notificationsApi } from "../api/notifications.api";
import { addPushTapListener, isNativePlatform, registerForPush } from "../utils/nativePush";

/** Requests push permission and registers the resulting FCM token with the backend once, the
 * first time this mounts native + authenticated (see (dashboard)/layout.tsx). Also wires
 * notification taps to open the in-app inbox at /notifications, same destination the Header bell
 * already links to. No-op on web/desktop. */
export function useRegisterNativePush(isAuthenticated: boolean) {
  const router = useRouter();
  const qc = useQueryClient();
  const registered = useRef(false);

  const registerMutation = useMutation({
    mutationFn: (token: string) => notificationsApi.registerDeviceToken(token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["server-notifications"] }),
  });

  useEffect(() => {
    if (!isNativePlatform() || !isAuthenticated || registered.current) return;
    registered.current = true;

    registerForPush()
      .then((token) => {
        if (token) registerMutation.mutate(token);
      })
      .catch(() => toast.error("Couldn't enable push notifications"));

    const tapListener = addPushTapListener(() => router.push("/notifications"));
    return () => { tapListener.then((l) => l.remove()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);
}
