import { ArrowRight, ChevronRight, KeyRound, MapPin, Sparkles } from "lucide-react";
import Link from "next/link";
import { PublicHeader } from "@/components/layout/public-header";
import { routes } from "@/config/routes";
import { facilitiesMessages as m } from "./facilities.messages";
import { FacilityList } from "./facility-list";
import styles from "./metastorage-fonts.module.css";

export function PublicFacilitiesScreen() {
  return (
    <div className={`${styles.page} bg-[#fbfbfa] text-[#0f172a]`}>
      <PublicHeader />
      <main className="mx-auto w-[min(1180px,calc(100%_-_40px))] py-8 sm:py-10">
        <nav
          aria-label={m.breadcrumb}
          className="mb-7 flex items-center gap-2 text-xs text-[#64748b]"
        >
          <Link href={routes.home}>{m.home}</Link>
          <ChevronRight size={12} />
          <span>{m.breadcrumb}</span>
        </nav>
        <section className="mb-8 flex items-end justify-between gap-8 max-[800px]:flex-col max-[800px]:items-start">
          <div className="max-w-[700px]">
            <span className="mb-3 inline-flex items-center gap-2 text-[10px] font-semibold tracking-[0.14em] text-[#125345] uppercase">
              <span className="size-1.5 rounded-full bg-[#125345]" />
              {m.eyebrow}
            </span>
            <h1 className="mb-3 text-[44px] leading-tight font-bold tracking-[-0.04em] sm:text-5xl">
              {m.title}
            </h1>
            <p className="max-w-[650px] text-sm text-[#64748b]">{m.description}</p>
          </div>
          <div className="grid shrink-0 gap-3 rounded-lg border border-[#e2e8f0] bg-white px-5 py-4 text-xs text-[#64748b]">
            <span className="flex items-center gap-2">
              <MapPin size={15} className="text-[#125345]" />
              {m.network}
            </span>
            <span className="flex items-center gap-2">
              <KeyRound size={15} className="text-[#125345]" />
              {m.secure}
            </span>
          </div>
        </section>
        <FacilityList />
        <section className="my-7 flex items-center justify-between gap-6 rounded-lg bg-[#125345] p-7 text-white max-[800px]:flex-col max-[800px]:items-start">
          <div className="flex items-center gap-4">
            <span className="rounded-lg bg-white/10 p-3">
              <Sparkles size={25} />
            </span>
            <div>
              <h2 className="mb-1 text-lg font-semibold">{m.helpTitle}</h2>
              <p className="max-w-[650px] text-xs text-white/75">{m.helpDescription}</p>
            </div>
          </div>
          <Link
            href={`${routes.home}#how-it-works`}
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded bg-white px-4 text-xs font-semibold text-[#125345] hover:bg-[#e8f5f1]"
          >
            {m.helpAction}
            <ArrowRight size={15} />
          </Link>
        </section>
      </main>
      <footer className="border-t border-[#e2e8f0] bg-white">
        <div className="mx-auto grid w-[min(1180px,calc(100%_-_40px))] gap-10 py-12 md:grid-cols-[2fr_1fr_1fr]">
          <div>
            <Link href={routes.home} className="text-2xl font-bold text-[#125345]">
              {m.brand}
            </Link>
            <p className="mt-4 max-w-[420px] text-xs text-[#64748b]">{m.footerDescription}</p>
          </div>
          <div className="grid content-start gap-3 text-xs text-[#64748b]">
            <h2 className="mb-2 font-semibold text-[#0f172a]">{m.about}</h2>
            <Link href={routes.home}>{m.home}</Link>
            <Link href={routes.facilities}>{m.title}</Link>
            <Link href={`${routes.home}#how-it-works`}>{m.how}</Link>
          </div>
          <div className="grid content-start gap-3 text-xs text-[#64748b]">
            <h2 className="mb-2 font-semibold text-[#0f172a]">{m.account}</h2>
            <Link href={routes.login}>{m.login}</Link>
            <Link href={routes.register}>{m.register}</Link>
          </div>
        </div>
        <div className="mx-auto w-[min(1180px,calc(100%_-_40px))] border-t border-[#e2e8f0] py-5 text-[10px] text-[#64748b]">
          {m.copyright}
        </div>
      </footer>
    </div>
  );
}
