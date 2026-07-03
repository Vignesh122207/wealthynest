"use client";

import { useState } from "react";
import { ArrowLeft, Copy, Check, ExternalLink, Heart } from "lucide-react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { Header } from "@/components/layout/Header";
import { PageWrapper } from "@/components/layout/PageWrapper";

const UPI_ID   = "vikkysachin12-1@oksbi";
const UPI_LINK = `upi://pay?pa=${UPI_ID}&pn=WealthyNest&cu=INR&tn=Support%20WealthyNest`;

export default function SupportWealthyNestPage() {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(UPI_ID).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  return (
    <div className="flex flex-col flex-1">
      <Header title="Support WealthyNest" />
      <PageWrapper>
        <div className="max-w-md mx-auto space-y-5">

          <Link href="/settings"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            Settings
          </Link>

          {/* Hero card */}
          <div className="bg-card border border-border rounded-2xl p-6 text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center mx-auto">
              <Heart className="w-6 h-6 text-indigo-500" />
            </div>
            <p className="text-lg font-bold text-foreground">Support WealthyNest</p>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
              WealthyNest is free, open and ad-free. If it has helped your family manage money better,
              your support keeps the servers running and inspires new features.
            </p>
          </div>

          {/* QR code */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Scan to Pay · UPI</p>
            </div>
            <div className="flex flex-col items-center gap-4 p-6">
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <QRCodeSVG
                  value={UPI_LINK}
                  size={180}
                  level="M"
                  marginSize={0}
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Scan with GPay, PhonePe, Paytm, or any UPI app
              </p>
            </div>
          </div>

          {/* UPI ID copy */}
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">UPI ID</p>
            <div className="flex items-center gap-3 bg-background border border-border rounded-xl px-4 py-3">
              <span className="flex-1 text-sm font-mono font-medium text-foreground select-all">{UPI_ID}</span>
              <button onClick={handleCopy} aria-label="Copy UPI ID"
                className="shrink-0 p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            {copied && <p className="text-xs text-emerald-600 dark:text-emerald-400 text-center">Copied! Paste in any UPI app.</p>}
          </div>

          {/* Deep link CTA */}
          <a href={UPI_LINK}
            className="flex items-center justify-center gap-2.5 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm py-3.5 rounded-2xl transition-colors">
            <ExternalLink className="w-4 h-4" />
            Open UPI App to Pay
          </a>
          <p className="text-xs text-muted-foreground text-center">Opens on mobile · GPay · PhonePe · Paytm</p>

        </div>
      </PageWrapper>
    </div>
  );
}
