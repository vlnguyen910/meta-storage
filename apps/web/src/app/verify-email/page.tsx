import Link from "next/link";
import { Suspense } from "react";
import { PublicHeader } from "@/components/layout/public-header";
import { AUTH_MESSAGES } from "@/features/auth/auth.messages";
import { VerifyEmailView } from "@/features/auth/verify-email-view";

export const metadata = {
  title: "A03 — Xác thực email | StoreX",
};

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex flex-col justify-between font-body-md text-slate-900 bg-[#faf8ff] selection:bg-[#165f4d] selection:text-white antialiased">
      {/* Minimal Linear Shell Header */}
      <PublicHeader />

      {/* Main Content Workspace */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 md:py-12">
        <Suspense
          fallback={
            <div className="w-full max-w-[560px] bg-white rounded-[15px] border border-slate-200 p-8 text-center text-sm text-slate-500">
              Đang tải…
            </div>
          }
        >
          <VerifyEmailView />
        </Suspense>
      </main>

      {/* Shared Global Footer Component */}
      <footer className="w-full bg-[#faf8ff] border-t border-slate-200">
        <div className="w-full max-w-7xl mx-auto px-4 md:px-8 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
              <span className="text-base font-bold text-[#165f4d] tracking-tight">
                {AUTH_MESSAGES.brandName}
              </span>
              <span className="hidden sm:inline text-slate-300">|</span>
              <p className="text-xs text-slate-500">{AUTH_MESSAGES.footerCopyright}</p>
            </div>
            <nav
              aria-label="Footer navigation"
              className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-600"
            >
              <Link href="/about" className="hover:text-[#165f4d] transition-colors">
                {AUTH_MESSAGES.navAbout}
              </Link>
              <Link href="/locations-hcm" className="hover:text-[#165f4d] transition-colors">
                {AUTH_MESSAGES.navLocationsHcm}
              </Link>
              <Link href="/locations-hn" className="hover:text-[#165f4d] transition-colors">
                {AUTH_MESSAGES.navLocationsHn}
              </Link>
              <Link href="/privacy" className="hover:text-[#165f4d] transition-colors">
                {AUTH_MESSAGES.navPrivacy}
              </Link>
              <Link href="/terms" className="hover:text-[#165f4d] transition-colors">
                {AUTH_MESSAGES.navTerms}
              </Link>
              <Link href="/support" className="hover:text-[#165f4d] transition-colors">
                {AUTH_MESSAGES.navSupport}
              </Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
