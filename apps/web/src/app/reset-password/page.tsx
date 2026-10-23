import { Suspense } from "react";
import { PublicHeader } from "@/components/layout/public-header";
import { AUTH_MESSAGES as m } from "@/features/auth/auth.messages";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";

export const metadata = {
  title: m.resetTitle,
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#faf8ff] text-slate-900">
      <PublicHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <Suspense fallback={<p role="status">{m.resetLoading}</p>}>
          <ResetPasswordForm />
        </Suspense>
      </main>
    </div>
  );
}
