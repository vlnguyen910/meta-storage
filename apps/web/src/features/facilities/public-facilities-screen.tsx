import { ArrowRight, ChevronRight, KeyRound, MapPin, Sparkles } from "lucide-react";
import Link from "next/link";
import { PublicHeader } from "@/components/layout/public-header";
import { BrandLogo } from "@/components/ui/brand-logo";
import { routes } from "@/config/routes";
import { facilitiesMessages as m } from "./facilities.messages";
import { FacilityList } from "./facility-list";
import styles from "./metastorage-fonts.module.css";

export function PublicFacilitiesScreen() {
  return (
    <div className={`${styles.page} bg-surface text-ink`}>
      <PublicHeader />
      <main className="mx-auto w-[min(1180px,calc(100%_-_40px))] py-8 sm:py-10">
        <nav
          aria-label={m.breadcrumb}
          className="mb-7 flex items-center gap-2 text-xs text-slate-500"
        >
          <Link href={routes.home}>{m.home}</Link>
          <ChevronRight size={12} />
          <span>{m.breadcrumb}</span>
        </nav>
        <section className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div className="max-w-[700px]">
            <span className="mb-3 inline-flex items-center gap-2 text-[10px] font-semibold tracking-[0.14em] text-primary uppercase">
              <span className="size-1.5 rounded-full bg-primary" />
              {m.eyebrow}
            </span>
            <h1 className="mb-3 text-[44px] leading-tight font-bold tracking-[-0.04em] sm:text-5xl text-slate-900">
              {m.title}
            </h1>
            <p className="max-w-[650px] text-sm text-slate-600">{m.description}</p>
          </div>
          <div className="grid shrink-0 gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 text-xs text-slate-600 shadow-2xs">
            <span className="flex items-center gap-2 font-medium">
              <MapPin size={15} className="text-primary" />
              {m.network}
            </span>
            <span className="flex items-center gap-2 font-medium">
              <KeyRound size={15} className="text-primary" />
              {m.secure}
            </span>
          </div>
        </section>
        <FacilityList />
        <section className="my-7 flex flex-col md:flex-row md:items-center justify-between gap-6 rounded-2xl bg-primary p-7 text-white shadow-xs">
          <div className="flex items-center gap-4">
            <span className="rounded-xl bg-white/10 p-3">
              <Sparkles size={25} />
            </span>
            <div>
              <h2 className="mb-1 text-lg font-bold text-white">{m.helpTitle}</h2>
              <p className="max-w-[650px] text-xs text-white/80">{m.helpDescription}</p>
            </div>
          </div>
          <Link
            href={`${routes.home}#how-it-works`}
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-white px-4 text-xs font-bold text-primary hover:bg-primary-soft shadow-xs transition-colors"
          >
            {m.helpAction}
            <ArrowRight size={15} />
          </Link>
        </section>
      </main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto grid w-[min(1180px,calc(100%_-_40px))] gap-10 py-12 md:grid-cols-[2fr_1fr_1fr]">
          <div>
            <Link
              href={routes.home}
              className="inline-flex items-center gap-2 text-2xl font-bold text-primary"
            >
              <BrandLogo />
              {m.brand}
            </Link>
            <p className="mt-4 max-w-[420px] text-xs text-slate-500">{m.footerDescription}</p>
          </div>
          <div className="grid content-start gap-3 text-xs text-slate-600">
            <h2 className="mb-2 font-bold text-slate-900">{m.about}</h2>
            <Link href={routes.home} className="hover:text-primary transition-colors">
              {m.home}
            </Link>
            <Link href={routes.facilities} className="hover:text-primary transition-colors">
              {m.title}
            </Link>
            <Link
              href={`${routes.home}#how-it-works`}
              className="hover:text-primary transition-colors"
            >
              {m.how}
            </Link>
          </div>
          <div className="grid content-start gap-3 text-xs text-slate-600">
            <h2 className="mb-2 font-bold text-slate-900">{m.account}</h2>
            <Link href={routes.login} className="hover:text-primary transition-colors">
              {m.login}
            </Link>
            <Link href={routes.register} className="hover:text-primary transition-colors">
              {m.register}
            </Link>
          </div>
        </div>
        <div className="mx-auto w-[min(1180px,calc(100%_-_40px))] border-t border-slate-100 py-5 text-[10px] text-slate-400">
          {m.copyright}
        </div>
      </footer>
    </div>
  );
}
