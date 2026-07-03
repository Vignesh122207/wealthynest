"use client";
import { Toaster } from "sonner";
import { useTheme } from "next-themes";

export function ThemedToaster() {
  const { theme } = useTheme();
  return (
    <Toaster
      position="top-right"
      theme={theme === "dark" ? "dark" : "light"}
    />
  );
}
