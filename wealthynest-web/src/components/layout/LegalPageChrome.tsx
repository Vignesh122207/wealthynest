"use client";

import {Suspense} from "react";
import Link from "next/link";
import {ArrowLeft} from "lucide-react";
import {useSearchParams} from "next/navigation";
import {PublicFooter, PublicNav} from "@/components/layout/PublicNav";

// Privacy/Terms are reachable both from the marketing site and from inside Settings. Which chrome
// to show has to key off *where the click came from*, not whether you're logged in — a logged-in
// user can still land here from the public landing page footer (bookmark, direct link, or just
// browsing "/" while signed in), and showing a "← Settings" back-link in that case is a dead end,
// not a shortcut. Settings' own links to these pages append ?from=settings; anything else
// (marketing footer/nav, the cross-reference from within Terms' own body text) falls through to
// the normal public chrome, which already adapts its own CTA for a logged-in visitor.
function LegalPageChromeInner({ children }: { children: React.ReactNode }) {
  const fromSettings = useSearchParams().get("from") === "settings";

  if (fromSettings) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <div className="max-w-2xl mx-auto w-full px-4 pt-6">
          <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            Settings
          </Link>
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PublicNav />
      {children}
      <PublicFooter />
    </div>
  );
}

// useSearchParams() opts its subtree out of static prerendering unless wrapped in Suspense — these
// pages are otherwise fully static (plain legal text, `export const metadata`), so this boundary
// exists purely to satisfy that requirement, not because the content is actually slow to load.
export function LegalPageChrome({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <LegalPageChromeInner>{children}</LegalPageChromeInner>
    </Suspense>
  );
}
