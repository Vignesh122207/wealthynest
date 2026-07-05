import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIState {
  mobileMenuOpen:    boolean;
  sidebarCollapsed:  boolean;
  openMobileMenu:    () => void;
  closeMobileMenu:   () => void;
  toggleMobileMenu:  () => void;
  toggleSidebar:     () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      mobileMenuOpen:   false,
      sidebarCollapsed: false,
      openMobileMenu:   () => set({ mobileMenuOpen: true }),
      closeMobileMenu:  () => set({ mobileMenuOpen: false }),
      toggleMobileMenu: () => set((s) => ({ mobileMenuOpen: !s.mobileMenuOpen })),
      toggleSidebar:    () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    { name: "wn-ui", partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed }) }
  )
);
