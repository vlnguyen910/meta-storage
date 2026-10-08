"use client";

import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronRight,
  Headphones,
  Home,
  Phone,
  Ruler,
  Search,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { routes } from "@/config/routes";
import { AUTH_MESSAGES } from "@/features/auth/auth.messages";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="bg-[#faf8ff] text-slate-900 antialiased min-h-screen flex flex-col justify-between selection:bg-[#165f4d] selection:text-white">
      {/* Top App Bar */}
      <header className="w-full bg-white border-b border-slate-200 shadow-xs sticky top-0 z-50">
        <div className="w-full max-w-7xl mx-auto px-4 md:px-8 flex items-center justify-between h-16">
          {/* Brand Logo */}
          <Link href={routes.home} className="flex items-center gap-2 group">
            <span className="w-8 h-8 rounded-lg bg-[#165f4d] flex items-center justify-center text-white shadow-xs transition-all duration-150 group-hover:opacity-90">
              <Warehouse className="w-5 h-5" />
            </span>
            <span className="text-xl font-bold text-[#165f4d] tracking-tight">
              {AUTH_MESSAGES.brandName}
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center space-x-8 text-sm font-medium text-slate-600">
            <Link href={routes.home} className="hover:text-slate-900 transition-colors">
              {AUTH_MESSAGES.topNavFindStorage}
            </Link>
            <Link href="/about" className="hover:text-slate-900 transition-colors">
              {AUTH_MESSAGES.navAbout}
            </Link>
            <Link href="/guide" className="hover:text-slate-900 transition-colors">
              {AUTH_MESSAGES.topNavGuide}
            </Link>
            <Link href="/contact" className="hover:text-slate-900 transition-colors">
              {AUTH_MESSAGES.topNavContact}
            </Link>
          </nav>

          {/* Trailing Action Buttons */}
          <div className="flex items-center gap-3">
            <a
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-50 transition-colors"
              href={`tel:${AUTH_MESSAGES.hotlineNumber.replace(/\s+/g, "")}`}
            >
              <Phone className="w-3.5 h-3.5 text-[#165f4d]" />
              <span className="font-medium">{AUTH_MESSAGES.hotlineNumber}</span>
            </a>
            <Link
              className="text-slate-700 text-xs md:text-sm font-medium px-3 py-1.5 hover:bg-slate-50 rounded-lg transition-all"
              href={routes.login}
            >
              {AUTH_MESSAGES.topNavLogin}
            </Link>
            <Link
              className="bg-[#165f4d] text-white px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-medium hover:bg-[#0f493b] transition-all shadow-xs"
              href={routes.register}
            >
              {AUTH_MESSAGES.topNavRegister}
            </Link>
          </div>
        </div>
      </header>

      {/* Main Error Canvas */}
      <main className="flex-1 flex items-center justify-center px-4 py-12 md:py-16">
        <div className="w-full max-w-[600px] bg-white border border-slate-200 rounded-[15px] p-6 sm:p-8 md:p-10 shadow-[0px_1px_2px_0px_rgba(15,23,42,0.05)] text-center">
          {/* Isometric Storage Locker Graphic with 404 Badge */}
          <div className="relative w-28 h-28 mx-auto mb-6 flex items-center justify-center">
            <div className="absolute inset-0 bg-[#e8f3ef] rounded-2xl rotate-3 border border-[#c4e2d7]" />
            <div className="relative w-full h-full bg-white rounded-2xl border border-slate-200 flex flex-col items-center justify-center p-3 shadow-xs">
              <svg
                className="w-16 h-16"
                fill="none"
                viewBox="0 0 64 64"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <rect
                  fill="#FAFAFA"
                  height="46"
                  rx="4"
                  stroke="#165F4D"
                  strokeWidth="2"
                  width="48"
                  x="8"
                  y="10"
                />
                <line stroke="#E2E8F0" strokeWidth="1.5" x1="8" x2="56" y1="25" y2="25" />
                <line stroke="#E2E8F0" strokeWidth="1.5" x1="8" x2="56" y1="40" y2="40" />
                <rect
                  fill="#E8F3EF"
                  height="8"
                  rx="2"
                  stroke="#C4E2D7"
                  strokeWidth="1"
                  width="18"
                  x="12"
                  y="14"
                />
                <rect
                  fill="none"
                  height="18"
                  rx="3"
                  stroke="#165F4D"
                  strokeDasharray="3 3"
                  strokeWidth="1.5"
                  width="18"
                  x="23"
                  y="29"
                />
                <path d="M29 38H35" stroke="#165F4D" strokeLinecap="round" strokeWidth="1.5" />
                <circle cx="46" cy="18" fill="#165F4D" r="3" />
              </svg>
            </div>
            <span className="absolute -bottom-2 -right-2 px-2.5 py-0.5 rounded-full bg-[#e8f3ef] border border-[#c4e2d7] text-[#165f4d] text-xs font-mono font-bold">
              404
            </span>
          </div>

          {/* Status Code Eyebrow */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-[#165f4d] text-xs font-medium mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-[#165f4d]" />
            <span>{AUTH_MESSAGES.notFoundStatusEyebrow}</span>
          </div>

          {/* Title */}
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight mb-2">
            {AUTH_MESSAGES.notFoundTitle}
          </h1>

          {/* Subtitle */}
          <p className="text-xs md:text-sm text-slate-600 max-w-md mx-auto mb-6 leading-relaxed">
            {AUTH_MESSAGES.notFoundSubtitle}{" "}
            <span className="font-semibold text-[#165f4d]">{AUTH_MESSAGES.brandName}</span>.
          </p>

          {/* Quick Search Bar */}
          <form action={routes.home} method="GET" className="relative mb-6">
            <div className="relative flex items-center">
              <Search
                className="absolute left-3.5 text-slate-400 w-4 h-4 pointer-events-none"
                aria-hidden="true"
              />
              <input
                name="search"
                type="text"
                placeholder={AUTH_MESSAGES.notFoundSearchPlaceholder}
                className="w-full h-11 pl-10 pr-20 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 text-xs md:text-sm focus:outline-none focus:border-[#165f4d] focus:ring-1 focus:ring-[#165f4d] transition-all shadow-xs"
              />
              <button
                type="submit"
                className="absolute right-1.5 h-8 px-3 rounded-md bg-[#165f4d] text-white text-xs font-medium hover:bg-[#0f493b] transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span>{AUTH_MESSAGES.notFoundSearchBtn}</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </form>

          {/* Quick Navigation Links */}
          <div className="bg-[#f8fafc] border border-slate-200 rounded-lg p-3.5 mb-6 text-left">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2 mb-2">
              {AUTH_MESSAGES.quickNavHeader}
            </p>
            <div className="space-y-1">
              <Link
                href={routes.home}
                className="flex items-center justify-between p-2 rounded-md hover:bg-slate-100 transition-colors duration-150 group"
              >
                <div className="flex items-center gap-2.5">
                  <Warehouse className="w-4 h-4 text-[#165f4d]" aria-hidden="true" />
                  <span className="text-xs md:text-sm font-medium text-slate-900 group-hover:text-[#165f4d]">
                    {AUTH_MESSAGES.navFacilitiesTitle}
                  </span>
                </div>
                <ChevronRight
                  className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform"
                  aria-hidden="true"
                />
              </Link>
              <Link
                href={routes.home}
                className="flex items-center justify-between p-2 rounded-md hover:bg-slate-100 transition-colors duration-150 group"
              >
                <div className="flex items-center gap-2.5">
                  <Ruler className="w-4 h-4 text-[#165f4d]" aria-hidden="true" />
                  <span className="text-xs md:text-sm font-medium text-slate-900 group-hover:text-[#165f4d]">
                    {AUTH_MESSAGES.navPricingTitle}
                  </span>
                </div>
                <ChevronRight
                  className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform"
                  aria-hidden="true"
                />
              </Link>
              <Link
                href="/guide"
                className="flex items-center justify-between p-2 rounded-md hover:bg-slate-100 transition-colors duration-150 group"
              >
                <div className="flex items-center gap-2.5">
                  <BookOpen className="w-4 h-4 text-[#165f4d]" aria-hidden="true" />
                  <span className="text-xs md:text-sm font-medium text-slate-900 group-hover:text-[#165f4d]">
                    {AUTH_MESSAGES.navGuideTitle}
                  </span>
                </div>
                <ChevronRight
                  className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform"
                  aria-hidden="true"
                />
              </Link>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 mb-6">
            <Link
              href={routes.home}
              className="w-full sm:flex-1 h-11 bg-[#165f4d] hover:bg-[#0f493b] text-white text-xs md:text-sm font-medium rounded-lg inline-flex items-center justify-center gap-2 transition-all shadow-xs"
            >
              <Home className="w-4 h-4" aria-hidden="true" />
              <span>{AUTH_MESSAGES.backToHome}</span>
            </Link>
            <button
              type="button"
              onClick={() => router.back()}
              className="w-full sm:flex-1 h-11 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-xs md:text-sm font-medium rounded-lg inline-flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-slate-500" aria-hidden="true" />
              <span>{AUTH_MESSAGES.goBack}</span>
            </button>
          </div>

          {/* Help Note */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-center gap-2 text-slate-500 text-xs">
            <Headphones className="w-4 h-4 text-[#165f4d]" aria-hidden="true" />
            <span>
              {AUTH_MESSAGES.emergencySupportNote}{" "}
              <a
                href={`tel:${AUTH_MESSAGES.hotlineNumber.replace(/\s+/g, "")}`}
                className="font-semibold text-[#165f4d] hover:underline"
              >
                {AUTH_MESSAGES.hotlineNumber}
              </a>
            </span>
          </div>
        </div>
      </main>

      {/* Shared Global Footer */}
      <footer className="w-full bg-white border-t border-slate-200">
        <div className="w-full max-w-7xl mx-auto px-4 md:px-8 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-[#165f4d] flex items-center justify-center text-white">
                <Warehouse className="w-4 h-4" />
              </span>
              <span className="text-base font-bold text-[#165f4d]">{AUTH_MESSAGES.brandName}</span>
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

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left text-xs text-slate-500">
            <p>{AUTH_MESSAGES.footerCopyright}</p>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>{AUTH_MESSAGES.systemOperational}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
