"use client";

import {useEffect} from "react";
import {useVaultTrustStore} from "../store/vaultTrust.store";

const ACTIVITY_EVENTS = ["mousemove", "keydown", "click", "scroll"] as const;

/** Feeds real user activity into the trust store's idle clock while the Vault page is open.
 * A no-op when nothing is currently trusted (the store itself guards that), so this is safe to
 * mount unconditionally rather than only when trusted. */
export function useVaultAutoLock() {
  const recordActivity = useVaultTrustStore((s) => s.recordActivity);

  useEffect(() => {
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, recordActivity, { passive: true });
    }
    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, recordActivity);
      }
    };
  }, [recordActivity]);
}
