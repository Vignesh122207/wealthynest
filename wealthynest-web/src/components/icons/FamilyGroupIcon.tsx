import { createLucideIcon } from "lucide-react";

// A three-person "family" glyph in the same stroke-icon language as the rest of
// the nav (Home, Wallet, Target, …) — one larger figure in front with two
// smaller figures peeking in behind on either side. Built with createLucideIcon
// so it's a drop-in LucideIcon, not a one-off component with its own prop shape.
// Each figure's circle+shoulder path is lucide's own single "User" glyph,
// scaled/repositioned by hand rather than reusing a stock 2-person icon —
// UsersRound/Users only ever show two figures, and this reads unambiguously
// as a family of three instead.
export const FamilyGroupIcon = createLucideIcon("FamilyGroupIcon", [
  ["circle", { cx: "4.5", cy: "6", r: "2", key: "fg-head-l" }],
  ["path", { d: "M8 13v-1a2 2 0 0 0-2-2H3a2 2 0 0 0-2 2v1", key: "fg-body-l" }],
  ["circle", { cx: "19.5", cy: "6", r: "2", key: "fg-head-r" }],
  ["path", { d: "M23 13v-1a2 2 0 0 0-2-2h-3a2 2 0 0 0-2 2v1", key: "fg-body-r" }],
  ["circle", { cx: "12", cy: "9", r: "3.2", key: "fg-head-c" }],
  ["path", { d: "M17.6 20.2v-1.6a3.2 3.2 0 0 0-3.2-3.2H9.6a3.2 3.2 0 0 0-3.2 3.2v1.6", key: "fg-body-c" }],
]);
