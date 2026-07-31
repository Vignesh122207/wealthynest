"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import {cn} from "@/lib/utils";
import {useAuthStore} from "@/features/auth/store/auth.store";
import {BrandMark} from "@/components/icons/BrandMark";

const LINKS = [
  { href: "/support", label: "Support" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms",   label: "Terms"   },
];

export function PublicNav() {
  const pathname = usePathname();
  const user     = useAuthStore(s => s.user);

  return (
    <nav className="flex items-center justify-between px-6 lg:px-12 h-16 border-b border-border sticky top-0 bg-background/90 backdrop-blur-sm z-20">
      <Link href="/" className="flex items-center gap-2">
        <BrandMark boxClassName="w-8 h-8" iconClassName="w-6 h-6" />
        <span className="text-base font-bold tracking-tight text-foreground">WealthyNest</span>
      </Link>

      <div className="hidden sm:flex items-center gap-1">
        {LINKS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "text-sm px-3 py-2 rounded-lg transition-colors",
              pathname === href
                ? "text-foreground font-medium bg-muted"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-3">
        {user ? (
          <Link href="/home"
            className="text-sm bg-gradient-to-br from-brand-600 to-brand-500 shadow-[0_10px_24px_-10px_rgb(var(--brand-500)/65%),inset_0_1px_0_rgba(255,255,255,0.18)] hover:shadow-[0_14px_28px_-10px_rgb(var(--brand-500)/75%),inset_0_1px_0_rgba(255,255,255,0.22)] hover:-translate-y-0.5 text-white px-4 py-2 rounded-xl transition-all font-medium">
            Go to Home
          </Link>
        ) : (
          <>
            <Link href="/login"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2">
              Sign in
            </Link>
            <Link href="/signup"
              className="text-sm bg-gradient-to-br from-brand-600 to-brand-500 shadow-[0_10px_24px_-10px_rgb(var(--brand-500)/65%),inset_0_1px_0_rgba(255,255,255,0.18)] hover:shadow-[0_14px_28px_-10px_rgb(var(--brand-500)/75%),inset_0_1px_0_rgba(255,255,255,0.22)] hover:-translate-y-0.5 text-white px-4 py-2 rounded-xl transition-all font-medium">
              Get started
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-border mt-auto">
      <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <BrandMark boxClassName="w-7 h-7" iconClassName="w-5 h-5" roundedClassName="rounded-lg" />
          <span className="text-sm font-semibold text-foreground">WealthyNest</span>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          © {new Date().getFullYear()} WealthyNest · Free forever · No ads · Built for Indian families.
        </p>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <Link href="/support" className="hover:text-foreground transition-colors">Support</Link>
          <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          <Link href="/terms"   className="hover:text-foreground transition-colors">Terms</Link>
        </div>
      </div>
    </footer>
  );
}
