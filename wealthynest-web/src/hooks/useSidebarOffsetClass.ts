import {useUIStore} from "@/store/ui.store";

// Tailwind needs a literal class in source to keep it in its build, so this can only ever resolve
// to one of these two strings — they mirror Sidebar.tsx's own desktop <aside> widths (w-60 /
// w-[68px]) exactly. Every fixed-position overlay that needs to clear the sidebar rather than sit
// under it (see TransactionModalOverlay's original lg:left-60 comment) reads the same collapsed
// flag instead of each re-deriving its own offset — before this, three separate backdrops hardcoded
// lg:left-60 and left a gap of undimmed background over the freed-up space once the sidebar collapsed.
export function useSidebarOffsetClass(): string {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  return collapsed ? "lg:left-[68px]" : "lg:left-60";
}
