// Tailwind needs a literal class in source to keep it in its build — this mirrors Sidebar.tsx's
// own fixed desktop rail width (w-24) exactly. Every fixed-position overlay that needs to clear
// the sidebar rather than sit under it (see TransactionModalOverlay's original comment) reads
// this instead of each hardcoding "lg:left-24" itself, so a future rail-width change only needs
// updating in one place.
export function useSidebarOffsetClass(): string {
  return "lg:left-24";
}
