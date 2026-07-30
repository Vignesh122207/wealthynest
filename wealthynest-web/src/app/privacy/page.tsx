import type {Metadata} from "next";
import {Shield} from "lucide-react";
import {LegalPageChrome} from "@/components/layout/LegalPageChrome";
import {PremiumIcon} from "@/components/icons/PremiumIcon";

export const metadata: Metadata = { title: "Privacy Policy" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <LegalPageChrome>
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-16">

        {/* Header */}
        <div className="text-center mb-12">
          <div className="mx-auto w-fit mb-5">
            <PremiumIcon icon={Shield} hex="#935a35" size="md" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Privacy Policy</h1>
          <p className="text-xs text-muted-foreground">Last updated: June 2026</p>
        </div>

        <div className="space-y-10">

          <Section title="1. Who we are">
            <p>
              WealthyNest (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) is a personal finance application built for Indian families.
              We are operated as an independent product. For questions, contact us at{" "}
              <a href="mailto:support@wealthynest.in" className="text-[#c2703d] hover:underline">
                support@wealthynest.in
              </a>.
            </p>
          </Section>

          <Section title="2. What data we collect">
            <p>We collect only the data necessary to provide the service:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Account information: your name and email address</li>
              <li>Financial data you enter: expenses, income, budgets, goals, investments, assets</li>
              <li>Family group data: family name and member associations</li>
              <li>Preferences: theme, notification settings, currency preference</li>
              <li>Authentication tokens stored in your browser (JWT)</li>
            </ul>
            <p>We do not collect: payment card numbers, bank passwords, Aadhaar or PAN numbers, or any biometric data.</p>
          </Section>

          <Section title="3. How we use your data">
            <p>Your data is used solely to provide and improve WealthyNest:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>To display your financial summary, budgets, goals, and reports</li>
              <li>To send budget breach and maturity notifications (if enabled)</li>
              <li>To allow family members to share financial views within your group</li>
              <li>To send email verification and password reset emails</li>
            </ul>
          </Section>

          <Section title="4. Data sharing">
            <p>
              We do not sell, rent, or share your personal or financial data with any third party for marketing
              or advertising purposes — ever. We use a small number of service providers strictly to operate
              the app, each limited to the data they need to do their job:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li><span className="text-foreground font-medium">Transactional email provider</span> — your email address only, to deliver verification, password-reset, and notification emails</li>
              <li><span className="text-foreground font-medium">Google Sign-In</span> (if you choose to sign in with Google) — Google provides us your name and email address to create/authenticate your account; we do not receive your Google password or access your other Google data</li>
              <li><span className="text-foreground font-medium">Firebase Cloud Messaging</span> (Google) — used only to deliver push notifications to the Android app. Firebase receives a device push token, not your financial data or account contents</li>
            </ul>
            <p>None of these providers are permitted to use your data for their own advertising or profiling.</p>
          </Section>

          <Section title="5. Data storage and security">
            <p>
              Your data is stored on encrypted servers hosted in India (AWS Mumbai region). All data is
              transmitted over HTTPS. Passwords are hashed and never stored in plain text.
            </p>
            <p>
              We implement rate limiting, JWT token rotation, and access controls to protect your account
              from unauthorized access.
            </p>
          </Section>

          <Section title="6. Your rights">
            <p>You have the right to:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Export all your data — available in Settings → Download Data</li>
              <li>Correct your name or email — available in Settings → Profile</li>
              <li>Deactivate your account — available in Settings → Close Account, or see <a href="/delete-account" className="text-[#c2703d] hover:underline">wealthynest.in/delete-account</a>. Your data is retained and only an admin can reactivate it; email us at support@wealthynest.in if you need it permanently erased instead</li>
              <li>Opt out of notifications — available in Settings → Notification Preferences</li>
            </ul>
            <p>For requests that cannot be completed within the app, email us at support@wealthynest.in and we will respond within 7 business days.</p>
          </Section>

          <Section title="7. Cookies and local storage">
            <p>
              We use browser local storage to store your authentication token and preferences (theme, currency).
              We do not use tracking cookies or third-party analytics cookies.
            </p>
          </Section>

          <Section title="8. Children's privacy">
            <p>
              WealthyNest is not intended for users under the age of 18. We do not knowingly collect data from minors.
            </p>
          </Section>

          <Section title="9. Changes to this policy">
            <p>
              We may update this Privacy Policy occasionally. When we do, we will update the &quot;Last updated&quot; date at the top.
              For significant changes, we will notify you via email or an in-app notice.
            </p>
          </Section>

          <Section title="10. Governing law">
            <p>
              This Privacy Policy is governed by the laws of India, including the Information Technology Act, 2000,
              the Digital Personal Data Protection Act, 2023, and applicable rules made under either. Any disputes
              are subject to the exclusive jurisdiction of courts in India.
            </p>
          </Section>

          <div className="pt-4 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Questions about this policy?{" "}
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
