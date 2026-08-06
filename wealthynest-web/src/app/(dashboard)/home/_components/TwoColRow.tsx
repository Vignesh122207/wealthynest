export function TwoColRow({ children }: { children: React.ReactNode }) {
  return (
    // [&>*]:min-w-0 — CSS Grid items default to min-width:auto (shrink to their content's natural
    // width, not the track), so a long user-entered string (a category/account name with no
    // length cap) inside a card can force that grid column — and the whole row — wider than the
    // viewport instead of the card's own `truncate` classes kicking in. This resets that floor to
    // 0 on every direct child so cards actually shrink to their grid track and truncate as designed.
    <div className="grid lg:grid-cols-2 gap-4 items-stretch [&>*]:min-w-0">
      {children}
    </div>
  );
}
