import { Phone, Warehouse } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { routes } from "@/config/routes";
import { AUTH_MESSAGES } from "@/features/auth/auth.messages";
import { VerifyEmailView } from "@/features/auth/verify-email-view";

export const metadata = {
  title: "A03 — Xác thực email | StoreX",
};

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex flex-col justify-between font-body-md text-slate-900 bg-[#faf8ff] selection:bg-[#165f4d] selection:text-white antialiased">
      {/* Minimal Linear Shell Header */}
      <header className="w-full bg-white border-b border-slate-200 py-3 px-4 md:px-8 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={routes.home} className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded bg-[#165f4d] flex items-center justify-center text-white shadow-xs">
                <Warehouse className="w-5 h-5" />
              </div>
              <span className="text-xl font-bold text-[#165f4d] tracking-tight">
                {AUTH_MESSAGES.brandName}
              </span>
            </Link>
            <div className="h-4 w-[1px] bg-slate-200 hidden sm:block" />
            <span className="hidden sm:inline-block text-xs text-slate-500 font-medium">
              {AUTH_MESSAGES.verifyEmailTagline}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <a
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-[#165f4d] transition-colors"
              href={`tel:${AUTH_MESSAGES.hotlineNumber.replace(/\s+/g, "")}`}
            >
              <Phone className="w-3.5 h-3.5 text-[#165f4d]" />
              <span className="hidden sm:inline">{AUTH_MESSAGES.hotlineNumber}</span>
            </a>
            <Link
              href={routes.login}
              className="text-xs font-semibold text-[#165f4d] hover:underline"
            >
              {AUTH_MESSAGES.topNavLogin}
            </Link>
          </div>
        </div>
      </header>

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
      <footer className="w-full bg-white border-t border-slate-200">
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
