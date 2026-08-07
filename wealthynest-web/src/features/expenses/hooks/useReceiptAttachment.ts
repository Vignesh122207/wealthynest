"use client";

import {useCallback, useEffect, useState} from "react";
import {toast} from "sonner";

// Data URLs are base64 (~33% larger than the source file) and share a small per-origin quota
// (typically ~5-10MB total) with everything else localStorage already holds in this app.
const MAX_BYTES = 2 * 1024 * 1024; // 2MB
const STORAGE_PREFIX = "wn-receipt-";

function readStored(expenseId: string): string | null {
  if (typeof window === "undefined") return null;
  try { return window.localStorage.getItem(STORAGE_PREFIX + expenseId); } catch { return null; }
}

/** Receipt attachment for one expense — stored as a data URL in the browser's own localStorage,
 * not on the server. This app has no backend file-storage infra yet (StatementImport/CasImport
 * only ever handle CSV uploads) — this is a real, fully working feature within that honest scope
 * (visible on this device/browser only, not synced across devices), rather than a UI that pretends
 * to upload somewhere it doesn't. */
export function useReceiptAttachment(expenseId: string | undefined) {
  const [dataUrl, setDataUrl] = useState<string | null>(() => expenseId ? readStored(expenseId) : null);

  // Re-sync when switching between transactions' drawers without a full remount.
  useEffect(() => { setDataUrl(expenseId ? readStored(expenseId) : null); }, [expenseId]);

  const attach = useCallback((file: File) => {
    if (!expenseId) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Only image receipts are supported (JPG, PNG, etc).");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Receipt image is too large — please use one under 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      try {
        window.localStorage.setItem(STORAGE_PREFIX + expenseId, result);
        setDataUrl(result);
      } catch {
        toast.error("Couldn't save the receipt — your browser's local storage is full.");
      }
    };
    reader.onerror = () => toast.error("Couldn't read that file.");
    reader.readAsDataURL(file);
  }, [expenseId]);

  const remove = useCallback(() => {
    if (!expenseId) return;
    try { window.localStorage.removeItem(STORAGE_PREFIX + expenseId); } catch { /* ignore */ }
    setDataUrl(null);
  }, [expenseId]);

  return { dataUrl, attach, remove };
}
