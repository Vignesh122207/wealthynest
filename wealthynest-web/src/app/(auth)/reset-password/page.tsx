import {Suspense} from "react";
import {ResetPasswordPageClient} from "./ResetPasswordPageClient";

export const metadata = { title: "Reset Password — WealthyNest" };

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordPageClient />
    </Suspense>
  );
}
