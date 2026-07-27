import type {ReactNode} from "react";
import {ShieldCheck} from "lucide-react";
import type {LucideIcon} from "lucide-react";
import {BrandMark, RibbonWMark} from "@/components/icons/BrandMark";
import {cn} from "@/lib/utils";

export interface AuthPerk {
  icon: LucideIcon;
  text: string;
}

interface AuthBrandPanelProps {
  /** Tailwind gradient classes for the panel background — each auth screen gets its own hue lean. */
  gradientClassName: string;
  /** Which corner the ghosted ribbon watermark sits in — mirrors the orbs with it. */
  watermarkSide: "left" | "right";
  eyebrow: string;
  headline: ReactNode;
  subcopy: string;
  perks: AuthPerk[];
  /** Short truthful claim shown next to the copyright line — no compliance/certification wording. */
  trustLabel: string;
  copyrightNote: string;
}

// The brand column shared by the auth screens (login/signup so far) — extracted because the
// richer v2 treatment (ribbon watermark, hairline texture, ledger-ruled perks) made copy-pasting
// this block a second time too much duplication to keep inline in each form.
export function AuthBrandPanel({
  gradientClassName, watermarkSide, eyebrow, headline, subcopy, perks, trustLabel, copyrightNote,
}: AuthBrandPanelProps) {
  const isRight = watermarkSide === "right";

  return (
    <aside aria-label="WealthyNest" className={cn(
      "hidden lg:flex flex-col justify-between w-[44%] shrink-0 relative overflow-hidden p-12",
      gradientClassName
    )}>
      <div className="absolute inset-0 bg-dot-grid opacity-40 pointer-events-none" aria-hidden />
      <div className="absolute inset-0 bg-hairline-diagonal opacity-60 pointer-events-none" aria-hidden />
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={cn("absolute -top-20 w-72 h-72 rounded-full bg-white/5 blur-3xl", isRight ? "-left-20" : "-right-20")} />
        <div className={cn("absolute bottom-10 w-80 h-80 rounded-full bg-brand-400/10 blur-3xl", isRight ? "right-0" : "left-0")} />
        <div className="absolute top-1/2 left-1/3 w-48 h-48 rounded-full bg-brand-200/5 blur-2xl" />
      </div>

      {/* Signature element: a large ghosted ribbon-W watermark echoing BrandMark's own glyph. */}
      <div className={cn(
        "absolute -bottom-16 w-[420px] h-[420px] pointer-events-none overflow-hidden",
        isRight ? "-right-16" : "-left-16"
      )} aria-hidden>
        <RibbonWMark tone="mono" className="absolute inset-0 w-full h-full text-white/10" />
      </div>

      <div className="relative flex items-center gap-2.5">
        <BrandMark variant="glass" boxClassName="w-9 h-9" iconClassName="w-6 h-6" />
        <span className="text-xl font-bold text-white tracking-tight">WealthyNest</span>
      </div>

      <div className="relative space-y-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-200">{eyebrow}</p>
        <h1 className="font-serif text-3xl md:text-[2.4rem] font-semibold text-white leading-[1.15] tracking-tight text-balance">
          {headline}
        </h1>
        <p className="text-brand-100 text-sm leading-relaxed max-w-xs">{subcopy}</p>
        <ul className="divide-y divide-white/10 border-y border-white/10">
          {perks.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 py-3.5 text-sm text-white/90">
              <div className="w-7 h-7 rounded-lg bg-white/15 border border-white/10 flex items-center justify-center shrink-0">
                <Icon className="w-3.5 h-3.5 text-white" />
              </div>
              {text}
            </li>
          ))}
        </ul>
      </div>

      <div className="relative flex items-center justify-between gap-3">
        <p className="text-xs text-brand-200">{copyrightNote}</p>
        <p className="flex items-center gap-1.5 text-[11px] text-brand-100">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
          {trustLabel}
        </p>
      </div>
    </aside>
  );
}
