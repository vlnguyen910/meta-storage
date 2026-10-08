"use client";

import {
  ArrowLeft,
  ExternalLink,
  Info,
  LayoutDashboard,
  Lock,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { roleHome, routes } from "@/config/routes";
import { AUTH_MESSAGES } from "@/features/auth/auth.messages";
import { useAuthStore } from "@/features/auth/auth-store";

const ROLE_LABELS: Record<string, string> = {
  CUSTOMER: "Khách hàng",
  FACILITY_STAFF: "Nhân viên cơ sở",
  FACILITY_MANAGER: "Quản lý cơ sở",
  BUSINESS_OPERATOR: "Vận hành",
  SYSTEM_ADMINISTRATOR: "Quản trị hệ thống",
};

export default function ForbiddenPage() {
  const router = useRouter();
  const session = useAuthStore((state) => state.session);

  const userName = session?.user.name || "Người dùng StoreX";
  const userRole = session?.user.role
    ? ROLE_LABELS[session.user.role] || session.user.role
    : "Khách";
  const userInitials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const destination = session?.user.role ? roleHome[session.user.role] : routes.login;

  return (
    <div className="bg-[#faf8ff] text-slate-900 antialiased min-h-screen flex flex-col justify-between selection:bg-[#165f4d] selection:text-white">
      {/* Top Authenticated App Header */}
      <header className="w-full bg-white border-b border-slate-200 shadow-xs sticky top-0 z-50">
        <div className="w-full max-w-7xl mx-auto px-4 md:px-8 flex items-center justify-between h-16">
          {/* Brand & Section Anchor */}
          <div className="flex items-center gap-4">
            <Link
              className="text-xl font-bold text-[#165f4d] tracking-tight transition-all duration-150 active:scale-95 flex items-center gap-2"
              href={routes.home}
            >
              <span className="w-8 h-8 rounded-lg bg-[#165f4d] flex items-center justify-center text-white shadow-xs">
                <Warehouse className="w-5 h-5" />
              </span>
              <span>{AUTH_MESSAGES.brandName}</span>
            </Link>
            <div className="hidden sm:flex items-center gap-2 px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
              <span className="w-1.5 h-1.5 rounded-full bg-[#165f4d]" />
              <span className="text-xs text-slate-600 font-medium">
                {AUTH_MESSAGES.verifyEmailTagline}
              </span>
            </div>
          </div>

          {/* Authenticated User Profile Pill */}
          {session ? (
            <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-full pl-1 pr-3 py-1">
              <div className="w-7 h-7 rounded-full bg-[#165f4d] text-white flex items-center justify-center text-xs font-semibold tracking-wide">
                {userInitials}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs md:text-sm font-semibold text-slate-900">{userName}</span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-200 text-slate-700">
                  {userRole}
                </span>
              </div>
            </div>
          ) : (
            <Link
              href={routes.login}
              className="text-xs md:text-sm font-semibold text-[#165f4d] hover:underline"
            >
              {AUTH_MESSAGES.topNavLogin}
            </Link>
          )}
        </div>
      </header>

      {/* Main Error Canvas */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 md:py-12">
        <div className="w-full max-w-[600px] bg-white rounded-[15px] border border-slate-200 shadow-[0px_1px_2px_0px_rgba(15,23,42,0.05)] overflow-hidden">
          {/* Panel Header */}
          <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span className="text-xs font-mono text-slate-600 tracking-wider uppercase font-semibold">
                {AUTH_MESSAGES.forbiddenHeaderTag}
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs font-mono text-slate-400">
              <Lock className="w-3.5 h-3.5" />
              <span>{AUTH_MESSAGES.forbiddenProtectAccess}</span>
            </div>
          </div>

          {/* Error Body */}
          <div className="p-6 md:p-8 flex flex-col items-center text-center">
            {/* Graphic Icon */}
            <div className="relative mb-6">
              <div className="w-20 h-20 rounded-full bg-[#e8f3ef] border border-[#c4e2d7] flex items-center justify-center text-[#165f4d] shadow-xs">
                <Shield className="w-10 h-10" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-[#fffbeb] border border-[#fde68a] flex items-center justify-center text-[#92400e] shadow-xs">
                <Lock className="w-4 h-4" />
              </div>
            </div>

            {/* Status Code Badge */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#fef2f2] border border-[#fecaca] text-[#991b1b] text-xs font-semibold mb-3">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>{AUTH_MESSAGES.forbiddenBadge}</span>
            </div>

            {/* Title */}
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight mb-2">
              {AUTH_MESSAGES.forbiddenTitle}
            </h1>

            {/* Explanation Text */}
            <p className="text-xs md:text-sm text-slate-600 leading-relaxed max-w-[500px] mb-6">
              {AUTH_MESSAGES.forbiddenSubtitle}
            </p>

            {/* Role Boundaries / Safety Details Tile */}
            <div className="w-full bg-slate-50 border border-slate-200 rounded-lg p-4 text-left mb-6">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-slate-400 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-xs md:text-sm text-slate-900 font-semibold">
                    {AUTH_MESSAGES.securityPolicyTitle}
                  </p>
                  <p className="text-xs text-slate-600 leading-normal">
                    {AUTH_MESSAGES.securityPolicyBody}
                  </p>
                </div>
              </div>
            </div>

            {/* Action CTAs */}
            <div className="w-full flex flex-col sm:flex-row gap-3 justify-center mb-6">
              <Link
                className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-lg bg-[#165f4d] text-white text-xs md:text-sm font-semibold hover:bg-[#0f493b] transition-all shadow-xs"
                href={destination}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>{AUTH_MESSAGES.backToDashboard}</span>
              </Link>
              <button
                type="button"
                onClick={() => router.back()}
                className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-lg bg-white text-slate-800 border border-slate-200 text-xs md:text-sm font-medium hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 text-slate-400" />
                <span>{AUTH_MESSAGES.goBack}</span>
              </button>
            </div>

            {/* System Hint */}
            <div className="w-full pt-4 border-t border-slate-200 text-xs text-slate-500">
              <p>
                {AUTH_MESSAGES.forbiddenHelpNote}{" "}
                <Link
                  href="/support"
                  className="text-[#165f4d] font-semibold hover:underline inline-flex items-center gap-0.5"
                >
                  <span>{AUTH_MESSAGES.storeXHelpCenter}</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>{" "}
                {AUTH_MESSAGES.submitTicketNote}
              </p>
            </div>
          </div>

          {/* Panel Footer Status Ticker */}
          <div className="px-6 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs font-mono text-slate-400">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#107012]" />
              <span>{AUTH_MESSAGES.secureSessionFooter}</span>
            </span>
            <span className="tabular-nums">{AUTH_MESSAGES.securityGuard}</span>
          </div>
        </div>
      </main>

      {/* Shared Global Footer */}
      <footer className="w-full bg-white border-t border-slate-200">
        <div className="w-full max-w-7xl mx-auto px-4 md:px-8 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-center sm:text-left">
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
