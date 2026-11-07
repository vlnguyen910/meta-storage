"use client";

import { ChevronRight, KeyRound, Menu, UserRound } from "lucide-react";
import Link from "next/link";
import { BrandLogo } from "@/components/ui/brand-logo";
import { roleHome, routes } from "@/config/routes";
import { useAuthStore } from "@/features/auth/auth-store";
import { landingMessages as m } from "@/features/landing/landing.messages";

export const publicNavigation = [
  { label: m.find, href: routes.facilities },
  { label: m.pricing, href: "/#pricing" },
  { label: m.process, href: "/#how-it-works" },
  { label: m.faq, href: "/#booking-info" },
];

const headerLink =
  "inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 text-sm font-semibold transition-colors hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary";

export function PublicHeader() {
  const session = useAuthStore((state) => state.session);
  const accountHref = session?.user.role ? roleHome[session.user.role] : routes.login;
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 text-ink backdrop-blur-lg">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-5 py-4 sm:flex-nowrap sm:px-8 xl:grid xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] xl:gap-6 [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-offset-4 [&_a:focus-visible]:outline-primary">
        <Link href={routes.home} className="order-1 flex shrink-0 items-center gap-2 text-primary">
          <BrandLogo />
          <span>
            <strong className="block text-xl font-bold tracking-tight">{m.brand}</strong>
            <small className="text-xs text-muted">{m.tagline}</small>
          </span>
        </Link>
        <nav
          aria-label={m.mainNavigation}
          className="order-2 hidden items-center justify-center gap-6 whitespace-nowrap text-base font-medium xl:flex"
        >
          {publicNavigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-h-11 items-center transition-colors hover:text-primary"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="order-3 flex w-full items-center justify-between gap-2 sm:ml-auto sm:w-auto xl:ml-0 xl:justify-self-end">
          {!session ? (
            <Link
              href={routes.bookingTracking}
              aria-label={m.myStorageLookup}
              className={`${headerLink} text-primary`}
            >
              <KeyRound size={16} aria-hidden="true" />
              <span>{m.myStorageLookupShort}</span>
            </Link>
          ) : null}
          <Link
            href={accountHref}
            aria-label={session ? m.openAccount(session.user.name) : m.login}
            className={`${headerLink} border border-outline-variant`}
          >
            {session ? (
              <>
                <span
                  className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-white"
                  aria-hidden="true"
                >
                  {session.user.name.trim().slice(0, 1).toLocaleUpperCase("vi")}
                </span>
                <span className="max-w-28 truncate">{session.user.name}</span>
                <ChevronRight size={16} aria-hidden="true" />
              </>
            ) : (
              <>
                <UserRound size={16} aria-hidden="true" />
                <span>{m.login}</span>
              </>
            )}
          </Link>
        </div>
        <details className="group order-2 ml-auto sm:order-4 sm:ml-0 xl:hidden">
          <summary
            aria-label={m.menu}
            className="flex size-11 cursor-pointer list-none items-center justify-center rounded-xl border border-outline-variant focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary [&::-webkit-details-marker]:hidden"
          >
            <Menu size={22} aria-hidden="true" />
          </summary>
          <nav
            aria-label={m.mobileNavigation}
            className="absolute top-full right-5 left-5 grid gap-1 rounded-xl border border-line bg-surface p-4 shadow-soft sm:left-auto sm:min-w-64"
          >
            {publicNavigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex min-h-12 items-center rounded-lg px-3 text-base hover:bg-primary-soft"
                onClick={(event) => {
                  const menu = event.currentTarget.closest("details");
                  if (menu) menu.open = false;
                }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </details>
      </div>
    </header>
  );
}
