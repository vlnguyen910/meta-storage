import Link from "next/link";
import { AUTH_MESSAGES } from "./auth.messages";

export function AuthFooter() {
  return (
    <footer className="w-full bg-[#faf8ff] border-t border-slate-200">
      <div className="w-full max-w-7xl mx-auto px-4 md:px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-600">
        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-center sm:text-left">
          <span className="text-base font-bold text-[#165f4d] tracking-tight">
            {AUTH_MESSAGES.brandName}
          </span>
          <span className="hidden sm:inline-block text-slate-300">|</span>
          <p>{AUTH_MESSAGES.footerCopyright}</p>
        </div>
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
  );
}
