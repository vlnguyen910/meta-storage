"use client";
import { ChevronRight, KeyRound, Menu, UserRound, Warehouse } from "lucide-react";
import Link from "next/link";
import { roleHome, routes } from "@/config/routes";
import { useAuthStore } from "@/features/auth/auth-store";
import fonts from "@/features/facilities/metastorage-fonts.module.css";
import { landingMessages as m } from "@/features/landing/landing.messages";
import s from "@/features/landing/landing.module.css";

export const publicNavigation = [
  { label: m.home, href: "/" },
  { label: m.find, href: "/facilities" },
  { label: m.pricing, href: "/#pricing" },
  { label: m.process, href: "/#how-it-works" },
  { label: m.faq, href: "/#booking-info" },
];
export function PublicHeader() {
  const session = useAuthStore((state) => state.session);
  const accountHref = session?.user.role ? roleHome[session.user.role] : "/login";
  return (
    <header className={`${fonts.page} ${s.page} ${s.header}`}>
      <div className={s.headerInner}>
        <Link href="/" className={s.brand}>
          <Warehouse size={29} />
          <span>
            <strong>{m.brand}</strong>
            <small>{m.tagline}</small>
          </span>
        </Link>
        <nav className={s.desktopNav}>
          {publicNavigation.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className={s.headerActions}>
          <Link href="/facilities" className={s.primary}>
            {m.findNow}
          </Link>
          {!session ? (
            <Link href={routes.bookingTracking} className={s.tracking}>
              <KeyRound size={16} aria-hidden="true" />
              <span className={s.trackingLong}>{m.myStorageLookup}</span>
              <span className={s.trackingShort}>{m.myStorageLookupShort}</span>
            </Link>
          ) : null}
          <Link
            href={accountHref}
            aria-label={session ? m.openAccount(session.user.name) : m.login}
            className={`${s.account} ${session ? s.accountSession : s.accountLogin}`}
          >
            {session ? (
              <>
                <span className={s.accountAvatar} aria-hidden="true">
                  {session.user.name.trim().slice(0, 1).toLocaleUpperCase("vi")}
                </span>
                <span className={s.accountIdentity}>
                  <small>{m.signedIn}</small>
                  <strong>{session.user.name}</strong>
                </span>
                <ChevronRight size={16} aria-hidden="true" />
              </>
            ) : (
              <>
                <UserRound size={18} aria-hidden="true" />
                <span>{m.login}</span>
              </>
            )}
          </Link>
          <details className={s.mobileMenu}>
            <summary aria-label={m.menu}>
              <Menu size={23} />
            </summary>
            <nav>
              {publicNavigation.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
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
      </div>
    </header>
  );
}
