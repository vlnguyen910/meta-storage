import { ArrowLeft, Warehouse } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { routes } from "@/config/routes";
import { AUTH_MESSAGES } from "@/features/auth/auth.messages";
import { ForgotPasswordForm } from "@/features/auth/forgot-password-form";

export const metadata = {
  title: "Khôi phục mật khẩu | StoreX",
};

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#faf8ff] text-slate-900 antialiased selection:bg-[#acf0d9] selection:text-[#002018]">
      {/* Header Navigation (Top Bar) */}
      <header className="w-full bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="w-full max-w-7xl mx-auto px-4 md:px-8 flex items-center justify-between h-16">
          {/* Brand Logo Anchor */}
          <Link
            href={routes.login}
            aria-label={AUTH_MESSAGES.homeAriaLabel}
            className="flex items-center gap-2 group transition-all duration-150 active:scale-95"
          >
            <div className="w-9 h-9 rounded-lg bg-[#165f4d] text-white flex items-center justify-center font-bold shadow-xs group-hover:bg-[#0f493b] transition-colors">
              <Warehouse className="w-5 h-5" />
            </div>
            <span className="text-xl font-bold text-[#165f4d] tracking-tight">
              {AUTH_MESSAGES.brandName}
            </span>
          </Link>

          {/* Status Metadata Badge & Return to Login */}
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#eaedff] text-slate-700 border border-slate-200">
              <span className="w-1.5 h-1.5 rounded-full bg-[#165f4d] animate-pulse" />
              {AUTH_MESSAGES.forgotPasswordBadge}
            </span>
            <Link
              href={routes.login}
              className="inline-flex items-center gap-1 text-xs md:text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors py-1.5 px-2.5 rounded-lg hover:bg-slate-100"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{AUTH_MESSAGES.topNavLogin}</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Canvas */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 md:py-14">
        <Suspense
          fallback={
            <div className="w-full max-w-[480px] rounded-[15px] bg-white p-8 border border-slate-200 shadow-xs text-center text-sm text-slate-500">
              Đang tải…
            </div>
          }
        >
          <ForgotPasswordForm />
        </Suspense>
      </main>

      {/* Semantic Footer */}
      <footer className="w-full bg-white border-t border-slate-200 mt-auto">
        <div className="w-full max-w-7xl mx-auto px-4 md:px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-600">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-center sm:text-left">
            <span className="text-base font-bold text-[#165f4d] tracking-tight">
              {AUTH_MESSAGES.brandName}
            </span>
            <span className="hidden sm:inline-block text-slate-300">|</span>
            <p>{AUTH_MESSAGES.footerCopyright}</p>
          </div>

          {/* Legal Links Group */}
          <nav
            aria-label="Footer navigation"
            className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2"
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
      </footer>
    </div>
  );
}
