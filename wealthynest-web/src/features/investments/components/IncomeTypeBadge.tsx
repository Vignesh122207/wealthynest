export function IncomeTypeBadge({ type }: { type: string }) {
  const cfg = type === "DIVIDEND"
    ? { label: "Dividend",  bg: "bg-indigo-500/15 text-indigo-400 border-indigo-500/20" }
    : type === "BOND_COUPON"
    ? { label: "Coupon",    bg: "bg-violet-500/15 text-violet-400 border-violet-500/20" }
    : { label: "FD Mature", bg: "bg-sky-500/15    text-sky-400    border-sky-500/20"    };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.bg}`}>
      {cfg.label}
    </span>
  );
}
