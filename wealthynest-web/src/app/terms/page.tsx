import type {Metadata} from "next";
import {ScrollText} from "lucide-react";
import {LegalPageChrome} from "@/components/layout/LegalPageChrome";
import {PremiumIcon} from "@/components/icons/PremiumIcon";

export const metadata: Metadata = { title: "Terms of Service" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <LegalPageChrome>
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-16">

        {/* Header */}
        <div className="text-center mb-12">
          <div className="mx-auto w-fit mb-5">
            <PremiumIcon icon={ScrollText} tone="yellow" size="md" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Terms of Service</h1>
          <p className="text-xs text-muted-foreground">Last updated: June 2026</p>
        </div>

        <div className="space-y-10">

          <Section title="1. Acceptance of terms">
            <p>
              By creating an account or using WealthyNest (&quot;the App&quot;, &quot;the Service&quot;), you agree to these
              Terms of Service. If you do not agree, please do not use the App.
            </p>
          </Section>

          <Section title="2. Description of service">
            <p>
              WealthyNest is a personal finance management application that allows users to track expenses,
              budgets, goals, investments, and net worth. The Service is provided free of charge and
              without advertisements.
            </p>
          </Section>

          <Section title="3. Account registration">
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>You must provide a valid email address and verify it to use the Service</li>
              <li>You are responsible for maintaining the confidentiality of your password</li>
              <li>You must be at least 18 years old to create an account</li>
              <li>One person may not maintain multiple accounts</li>
              <li>You are responsible for all activity that occurs under your account</li>
            </ul>
          </Section>

          <Section title="4. Acceptable use">
            <p>You agree not to:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Use the Service for any unlawful purpose or in violation of applicable Indian laws</li>
              <li>Attempt to gain unauthorized access to other users&apos; accounts or data</li>
              <li>Reverse engineer, decompile, or extract the source code of the App</li>
              <li>Use automated bots or scripts to scrape or abuse the Service</li>
              <li>Impersonate another person or entity</li>
            </ul>
          </Section>

          <Section title="5. Financial information disclaimer">
            <p>
              WealthyNest is a tracking and planning tool only. It does not provide financial advice,
              investment recommendations, or tax advice. Any information shown in the App is based solely
              on data you enter.
            </p>
            <p>
              Always consult a qualified financial advisor or tax professional before making financial decisions.
              We are not responsible for any financial decisions made based on information shown in the App.
            </p>
          </Section>

          <Section title="6. Data and privacy">
            <p>
              Your use of the App is also governed by our{" "}
              <a href="/privacy" className="text-[#c2703d] hover:underline">Privacy Policy</a>,
              which is incorporated into these Terms by reference.
            </p>
          </Section>

          <Section title="7. Service availability">
            <p>
              We strive to keep WealthyNest available at all times but do not guarantee uninterrupted access.
              The Service may be temporarily unavailable due to maintenance, upgrades, or circumstances
              beyond our control.
            </p>
            <p>
              We reserve the right to modify or discontinue the Service at any time with reasonable notice
              to users.
            </p>
          </Section>

          <Section title="8. Intellectual property">
            <p>
              All content, design, code, and features of WealthyNest are the property of the WealthyNest
              team. You may not copy, reproduce, or distribute any part of the Service without prior
              written permission.
            </p>
          </Section>

          <Section title="9. Limitation of liability">
            <p>
              To the maximum extent permitted by law, WealthyNest and its developers are not liable for
              any indirect, incidental, or consequential damages arising from your use of the Service,
              including but not limited to loss of data or financial losses.
            </p>
            <p>
              Your sole remedy for dissatisfaction with the Service is to stop using it and delete your account.
            </p>
          </Section>

          <Section title="10. Account termination">
            <p>
              We reserve the right to suspend or terminate accounts that violate these Terms. You may
              delete your account at any time from Settings → Close Account.
            </p>
          </Section>

          <Section title="11. Changes to terms">
            <p>
              We may update these Terms from time to time. We will notify you of material changes via
              email or an in-app notice. Continued use of the Service after changes constitutes
              acceptance of the updated Terms.
            </p>
          </Section>

          <Section title="12. Governing law">
            <p>
              These Terms are governed by the laws of India. Any disputes arising out of or in connection
              with these Terms shall be subject to the exclusive jurisdiction of the courts in India.
            </p>
          </Section>

          <div className="pt-4 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Questions about these terms?{" "}
              <a href="mailto:support@wealthynest.in" className="text-[#c2703d] hover:underline">
                support@wealthynest.in
              </a>
            </p>
          </div>

        </div>
      </main>
    </LegalPageChrome>
  );
}
