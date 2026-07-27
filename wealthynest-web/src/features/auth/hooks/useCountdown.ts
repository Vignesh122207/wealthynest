"use client";
import {useEffect, useState} from "react";

function format(targetIso: string | undefined | null): string | null {
  if (!targetIso) return null;
  const remainingMs = new Date(targetIso).getTime() - Date.now();
  if (remainingMs <= 0) return null;
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

/** Ticks down to `targetIso` once a second as a "4m 32s" / "32s" label — used to render a
 * lockout's remaining time instead of a bare "too many attempts" toast. Returns null once the
 * target has passed (or was never set), so callers can stop showing the countdown and let the
 * user retry. */
export function useCountdown(targetIso: string | undefined | null): string | null {
  const [label, setLabel] = useState<string | null>(() => format(targetIso));

  useEffect(() => {
    setLabel(format(targetIso));
    if (!targetIso) return;
    const id = setInterval(() => setLabel(format(targetIso)), 1000);
    return () => clearInterval(id);
  }, [targetIso]);

  return label;
}
