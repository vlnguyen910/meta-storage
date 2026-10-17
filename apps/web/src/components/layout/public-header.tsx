"use client";
import { Menu, UserRound, Warehouse } from "lucide-react";
import Link from "next/link";
import { roleHome } from "@/config/routes";
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
          <a href="tel:19006868" className={s.hotline}>
            <small>{m.hotlineLabel}</small>
            <strong>{m.hotline}</strong>
          </a>
          <Link href="/facilities" className={s.primary}>
            {m.findNow}
          </Link>
          <Link href={accountHref} aria-label={m.login} className={s.account}>
            <UserRound size={18} />
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
