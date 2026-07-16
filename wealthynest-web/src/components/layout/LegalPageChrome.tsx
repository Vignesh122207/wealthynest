"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { PublicNav, PublicFooter } from "@/components/layout/PublicNav";

// Privacy/Terms are reachable both from the marketing site (logged-out visitor) and from inside
// Settings (already-signed-in user). Always showing the full marketing PublicNav made the page
// feel like you'd been dropped back on the public site — for a signed-in user it's swapped for
// the same minimal "back" header every other Settings subpage uses instead.
export function LegalPageChrome({ children }: { children: React.ReactNode }) {
  const user = useAuthStore(s => s.user);

  if (user) {
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
