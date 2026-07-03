import type { Metadata } from "next";
import { Shield } from "lucide-react";
import { PublicNav, PublicFooter } from "@/components/layout/PublicNav";

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
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PublicNav />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-16">

        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-violet-500/10 mb-5">
            <Shield className="w-6 h-6 text-violet-500" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Privacy Policy</h1>
          <p className="text-xs text-muted-foreground">Last updated: June 2026</p>
        </div>

        <div className="space-y-10">

          <Section title="1. Who we are">
            <p>
              WealthyNest ("we", "our", "us") is a personal finance application built for Indian families.
              We are operated as an independent product. For questions, contact us at{" "}
              <a href="mailto:support@wealthynest.in" className="text-indigo-500 hover:underline">
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
              or advertising purposes — ever.
            </p>
            <p>The only third-party service we use is a transactional email provider to send verification
              and notification emails. They process your email address only to deliver these messages.</p>
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
              <li>Delete your account and all associated data — available in Settings → Close Account</li>
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
              We may update this Privacy Policy occasionally. When we do, we will update the "Last updated" date at the top.
              For significant changes, we will notify you via email or an in-app notice.
            </p>
          </Section>

          <Section title="10. Governing law">
            <p>
              This Privacy Policy is governed by the laws of India, including the Information Technology Act, 2000
              and applicable rules. Any disputes are subject to the exclusive jurisdiction of courts in India.
            </p>
          </Section>

          <div className="pt-4 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Questions about this policy?{" "}
              <a href="mailto:support@wealthynest.in" className="text-indigo-500 hover:underline">
                support@wealthynest.in
              </a>
            </p>
          </div>

        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
