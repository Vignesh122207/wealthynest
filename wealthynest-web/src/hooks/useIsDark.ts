"use client";

import {useTheme} from "next-themes";
import {useEffect, useState} from "react";

// Defaults to true (dark) before mount since the app's ThemeProvider defaultTheme is "dark"
// (see app/layout.tsx) — avoids a light-theme flash on first paint. Extracted from
// useChartTheme.ts, which now delegates to this for its own `isDark`.
export function useIsDark(): boolean {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return mounted ? resolvedTheme === "dark" : true;
}
