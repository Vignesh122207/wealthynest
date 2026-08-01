import type {Metadata} from "next";
import Link from "next/link";
import {UserX, Mail} from "lucide-react";
import {LegalPageChrome} from "@/components/layout/LegalPageChrome";
import {PremiumIcon} from "@/components/icons/PremiumIcon";

export const metadata: Metadata = { title: "Delete Your Account" };

function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="space-y-3 scroll-mt-16">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

// Public, no-login-required page describing account deletion — separate from the in-app
// Settings → Profile → Close Account flow so there's a single URL that works whether or not
// the app is installed (Google Play's account-deletion policy requires exactly this).
export default function DeleteAccountPage() {
  return (
    <LegalPageChrome>
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-16">

        <div className="text-center mb-12">
          <div className="mx-auto w-fit mb-5">
            <PremiumIcon icon={UserX} tone="red" size="md" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Delete Your Account</h1>
          <p className="text-xs text-muted-foreground">
            This page works whether or not you have the app installed.
          </p>
        </div>

        <div className="space-y-10">

          <Section title="How to delete your account">
            <p>You can close your account directly from the app or website:</p>
            <ol className="list-decimal list-inside space-y-1 pl-2">
              <li>Sign in at <a href="https://wealthynest.in/login" className="text-[#c2703d] hover:underline">wealthynest.in</a> (or open the app)</li>
              <li>Go to <span className="font-medium text-foreground">Settings → Profile</span></li>
              <li>Scroll to the bottom and tap <span className="font-medium text-foreground">Close Account</span></li>
              <li>Confirm — you&apos;ll be signed out immediately on every device</li>
            </ol>
          </Section>

          <Section title="What happens when you close your account">
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Your account is deactivated immediately and all active sessions/tokens are revoked</li>
              <li>You will not be able to sign in again unless the account is reactivated (see below)</li>
              <li>Your data (expenses, budgets, investments, family associations) is retained but no longer accessible to you or visible to family members</li>
              <li>Data is not shown to, or usable by, anyone else after closure</li>
            </ul>
          </Section>

          <Section id="delete-some-data" title="Deleting some of your data without closing your account">
            <p>
              You don&apos;t need to close your account to delete individual pieces of data. Any
              expense, income entry, budget, goal, debt, investment, or asset can be deleted
              directly from the app at any time — open the item and use its own Delete option.
              This works regardless of whether you ever close your account.
            </p>
            <p>
              Unlike closing your account (which deactivates and retains your data until an
              erasure request — see below), deleting an individual item is immediate and
              permanent: it&apos;s removed from our database right away, not just hidden.
            </p>
          </Section>

          <Section title="Requesting permanent erasure">
            <p>
              Closing your account deactivates it but does not immediately erase your data — this
              matches how most financial apps handle account closure, so a mistaken or unauthorized
              closure can still be reversed. If you want your data permanently and irreversibly
              deleted instead of retained, email us and we will erase it rather than just deactivate it.
            </p>
            <p>
              We will confirm and complete a permanent erasure request within <strong>30 days</strong>.
              Some information may be retained longer only where required by Indian law (for example,
              financial records under applicable retention rules) — anything not legally required to
              be kept is deleted.
            </p>
          </Section>

          <Section title="What data is deleted vs. retained on request">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 pr-4 font-medium text-foreground">Data</th>
                  <th className="py-2 font-medium text-foreground">On erasure request</th>
                </tr>
              </thead>
              <tbody className="align-top">
                <tr className="border-b border-border">
                  <td className="py-2 pr-4">Name, email, password hash</td>
                  <td className="py-2">Deleted</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2 pr-4">Expenses, budgets, goals, investments, assets, liabilities</td>
                  <td className="py-2">Deleted</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2 pr-4">Family group membership</td>
                  <td className="py-2">Removed from the family; other members&apos; data is unaffected</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Support tickets you filed</td>
                  <td className="py-2">Deleted, unless required for an open dispute/fraud investigation</td>
                </tr>
              </tbody>
            </table>
          </Section>

          <section className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <PremiumIcon icon={Mail} tone="indigo" size="sm" />
              <div>
                <p className="text-sm font-semibold text-foreground">Request permanent erasure</p>
                <p className="text-xs text-muted-foreground">We reply within 48 hours, erasure completes within 30 days</p>
              </div>
            </div>
            <a
              href="mailto:support@wealthynest.in?subject=Permanent%20account%20deletion%20request"
              className="text-sm text-[#a85f30] dark:text-[#d98a52] hover:underline font-medium"
            >
              support@wealthynest.in
            </a>
          </section>

          <p className="text-xs text-muted-foreground">
            See also our <Link href="/privacy" className="text-[#c2703d] hover:underline">Privacy Policy</Link>{" "}
            for what data we collect and how it&apos;s used before deletion.
          </p>

        </div>
      </main>
    </LegalPageChrome>
  );
}
