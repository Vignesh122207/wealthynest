"use client";

import { useSearchParams } from "next/navigation";
import { ResetPasswordForm } from "@/features/auth/components/ResetPasswordForm";

export function ResetPasswordPageClient() {
  const params = useSearchParams();
  const token  = params.get("token") ?? "";
  return <ResetPasswordForm token={token} />;
}
