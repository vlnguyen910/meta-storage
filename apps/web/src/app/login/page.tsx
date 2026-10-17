import Link from "next/link";
import { Suspense } from "react";
import { PublicHeader } from "@/components/layout/public-header";
import { AUTH_MESSAGES } from "@/features/auth/auth.messages";
import { LoginForm } from "@/features/auth/login-form";

export const metadata = {
  title: "A01 — Đăng nhập | StoreX",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#faf8ff] text-slate-900 antialiased selection:bg-[#acf0d9] selection:text-[#002018]">
      {/* Header Navigation (Top Bar) */}
      <PublicHeader />

      {/* Main Canvas */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 md:py-12">
        <Suspense
          fallback={
            <div className="w-full max-w-[440px] rounded-[15px] bg-white p-8 border border-slate-200 shadow-xs text-center text-sm text-slate-500">
              Đang tải…
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </main>

      {/* Semantic Footer */}
      <footer className="w-full bg-[#faf8ff] border-t border-slate-200">
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
            aria-label="Legal and support links"
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
