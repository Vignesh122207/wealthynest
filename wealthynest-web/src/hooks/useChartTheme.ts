"use client";

import {useIsDark} from "./useIsDark";

export function useChartTheme() {
  const isDark = useIsDark();

  return {
    isDark,
    tooltipStyle: {
      background:   isDark ? "hsl(222 47% 8%)"  : "#ffffff",
      border:       `1px solid ${isDark ? "hsl(217 33% 20%)" : "hsl(214 32% 88%)"}`,
      borderRadius: "10px",
      fontSize:     "12px",
      color:        isDark ? "hsl(213 31% 91%)" : "hsl(222 47% 11%)",
      boxShadow:    isDark ? "0 8px 32px rgba(0,0,0,0.5)" : "0 4px 20px rgba(0,0,0,0.12)",
      padding:      "8px 12px",
    },
    labelStyle: {
      color:        isDark ? "hsl(215 20% 65%)" : "hsl(215 16% 47%)",
      marginBottom: "4px",
    },
    itemStyle: {
      color:        isDark ? "hsl(213 31% 91%)" : "hsl(222 47% 11%)",
    },
    gridColor:    isDark ? "hsl(217 33% 14%)" : "hsl(214 32% 92%)",
    axisColor:    isDark ? "hsl(215 20% 40%)" : "hsl(215 16% 55%)",
    cursorStyle:  { fill: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)" },
  };
}
