"use client";
import {
  ArrowRight,
  Boxes,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Fingerprint,
  LockKeyhole,
  MapPin,
  Menu,
  Package,
  Phone,
  QrCode,
  ShieldCheck,
  Snowflake,
  Truck,
  UserRound,
  Warehouse,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Currency } from "@/components/ui/display";
import fonts from "@/features/facilities/metastorage-fonts.module.css";
import { landingMessages as m } from "./landing.messages";
import s from "./landing.module.css";
import { useLandingCatalog } from "./use-landing-catalog";

const benefitIcons = [LockKeyhole, Snowflake, Truck, CalendarDays];
const stepIcons = [Warehouse, ClipboardList, QrCode];
const assuranceIcons = [ShieldCheck, CalendarDays, Fingerprint];
const nav = [
  { label: m.home, href: "/" },
  { label: m.find, href: "/facilities" },
  { label: m.pricing, href: "#pricing" },
  { label: m.process, href: "#how-it-works" },
  { label: m.faq, href: "#booking-info" },
];

function LandingImage({ index, className }: { index: number; className?: string }) {
  return (
    <div className={`${s.image} ${className ?? ""}`}>
      <Image
        src={`/images/metastorage/landing/${index}.png`}
        alt={m.imageAlt}
        fill
        sizes="(max-width: 760px) 100vw, 500px"
      />
      <span className={s.imageLabel}>{m.illustration}</span>
    </div>
  );
}
function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className={s.sectionHeading}>
      <span className={s.eyebrow}>{eyebrow}</span>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
    </div>
  );
}

export function LandingScreen() {
  const state = useLandingCatalog();
  return (
    <div className={`${fonts.page} ${s.page}`}>
      <header className={s.header}>
        <div className={s.headerInner}>
          <Link href="/" className={s.brand}>
            <Warehouse size={29} />
            <span>
              <strong>{m.brand}</strong>
              <small>{m.tagline}</small>
            </span>
          </Link>
          <nav className={s.desktopNav}>
            {nav.map((item) => (
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
            <Link href="/login" aria-label={m.login} className={s.account}>
              <UserRound size={18} />
            </Link>
            <details className={s.mobileMenu}>
              <summary aria-label={m.menu}>
                <Menu size={23} />
              </summary>
              <nav>
                {nav.map((item) => (
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
      <main>
        <section className={s.hero}>
          <div className={s.container}>
            <div className={s.heroGrid}>
              <div>
                <span className={s.badge}>
                  <span />
                  {m.badge}
                </span>
                <h1>{m.heroTitle}</h1>
                <p className={s.lead}>{m.heroDescription}</p>
                <form className={s.search} action="/reservations/new">
                  <div className={s.searchGrid}>
                    <label>
                      <span>
                        <MapPin size={16} />
                        {m.location}
                      </span>
                      <select
                        name="facilityId"
                        value={state.facilityId}
                        onChange={(e) => state.setFacility(e.target.value)}
                        required
                        disabled={state.facilitiesQuery.isLoading}
                      >
                        {!state.facilityId ? <option value="">{m.facilityRequired}</option> : null}
                        {state.facilities.map((f) => (
                          <option value={f.id} key={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>
                        <Package size={16} />
                        {m.need}
                      </span>
                      <select
                        name="area"
                        value={state.need}
                        onChange={(e) => state.setNeed(e.target.value)}
                      >
                        {m.needs.map((n) => (
                          <option key={n.value} value={n.value}>
                            {n.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button className={s.primary} disabled={!state.facilityId} type="submit">
                      {m.search}
                      <ArrowRight size={17} />
                    </button>
                  </div>
                  <div className={s.searchHints}>
                    {m.searchHints.map((h) => (
                      <span key={h}>
                        <CheckCircle2 size={15} />
                        {h}
                      </span>
                    ))}
                  </div>
                </form>
              </div>
              <div className={s.heroVisual}>
                <div className={s.heroPhoto}>
                  <LandingImage index={2} className={s.heroImage} />
                  <span className={s.lobbyBadge}>
                    <ShieldCheck size={18} />
                    {m.lobby}
                  </span>
                </div>
              </div>
            </div>
            {state.facilitiesQuery.isError ? (
              <p role="alert" className={s.error}>
                {m.error}
                <button type="button" onClick={() => state.facilitiesQuery.refetch()}>
                  {m.retry}
                </button>
              </p>
            ) : null}
            <div className={s.stats}>
              {m.stats.map((stat) => (
                <div key={stat.value}>
                  <strong>{stat.value}</strong>
                  <span>{stat.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className={s.section}>
          <div className={s.container}>
            <SectionHeading
              eyebrow={m.whyEyebrow}
              title={m.whyTitle}
              description={m.whyDescription}
            />
            <div className={s.benefits}>
              {m.benefits.map((b, i) => {
                const Icon = benefitIcons[i] ?? ShieldCheck;
                return (
                  <article key={b.title}>
                    <span className={s.iconBox}>
                      <Icon size={25} />
                    </span>
                    <h3>{b.title}</h3>
                    <p>{b.description}</p>
                    <span className={s.detail}>
                      {b.detail}
                      <ArrowRight size={15} />
                    </span>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
        <section className={`${s.section} ${s.tinted}`} id="pricing">
          <div className={s.container}>
            <div className={s.headingRow}>
              <SectionHeading
                eyebrow={m.sizesEyebrow}
                title={m.sizesTitle}
                description={m.sizesDescription}
              />
              <div className={s.filters}>
                {[
                  { value: "all", label: m.allSizes },
                  { value: "small", label: m.personal },
                  { value: "large", label: m.large },
                ].map((f) => (
                  <button
                    type="button"
                    key={f.value}
                    aria-pressed={state.filter === f.value}
                    onClick={() => state.setFilter(f.value)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <label className={s.facilityPicker}>
              <MapPin size={16} />
              <span>{m.location}</span>
              <select value={state.facilityId} onChange={(e) => state.setFacility(e.target.value)}>
                {state.facilities.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
            <div className={s.unitList}>
              {state.availabilityQuery.isLoading ? <p role="status">{m.loading}</p> : null}
              {state.availabilityQuery.isError ? (
                <p role="alert">
                  {m.error}
                  <button type="button" onClick={() => state.availabilityQuery.refetch()}>
                    {m.retry}
                  </button>
                </p>
              ) : null}
              {state.options?.length === 0 ? <p>{m.noUnits}</p> : null}
              {state.options?.map((unit, i) => (
                <article key={unit.unitTypeId} className={s.unitCard}>
                  <LandingImage index={4 + (i % 4)} />
                  <div className={s.unitInfo}>
                    <span className={s.badge}>
                      {unit.availableCount > 0 ? m.available(unit.availableCount) : m.unavailable}
                    </span>
                    <h3>
                      {unit.unitType}
                      <span>{unit.sizeSqm} m²</span>
                    </h3>
                    <p>{m.unitDescription}</p>
                    <div className={s.specs}>
                      <span>
                        <Boxes size={18} />
                        {m.area}
                        <strong>{unit.sizeSqm} m²</strong>
                      </span>
                      <span>
                        <Warehouse size={18} />
                        {m.dimensions}
                        <strong>{m.updating}</strong>
                      </span>
                    </div>
                  </div>
                  <div className={s.unitPrice}>
                    <span>{m.priceLabel}</span>
                    <strong>
                      <Currency value={unit.monthlyPrice} />
                    </strong>
                    <small>{m.monthly}</small>
                    <p>{m.rentalHint}</p>
                    {unit.availableCount > 0 ? (
                      <Link className={s.primary} href={state.bookingHref(unit.unitTypeId)}>
                        {m.book}
                        <ArrowRight size={16} />
                      </Link>
                    ) : (
                      <button type="button" disabled className={s.primary}>
                        {m.unavailable}
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section id="how-it-works" className={s.section}>
          <div className={s.container}>
            <SectionHeading
              eyebrow={m.processEyebrow}
              title={m.processTitle}
              description={m.processDescription}
            />
            <div className={s.steps}>
              {m.steps.map((step, i) => {
                const Icon = stepIcons[i] ?? QrCode;
                return (
                  <article key={step.title}>
                    <span className={s.stepIndex}>{String(i + 1).padStart(2, "0")}</span>
                    <Icon size={30} />
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
        <section className={`${s.section} ${s.tinted}`} id="locations">
          <div className={s.container}>
            <div className={s.headingRow}>
              <SectionHeading
                eyebrow={m.networkEyebrow}
                title={m.networkTitle}
                description={m.networkDescription}
              />
              <Link className={s.textLink} href="/facilities">
                {m.allFacilities}
                <MapPin size={16} />
              </Link>
            </div>
            <div className={s.locations}>
              {state.facilities.slice(0, 3).map((f, i) => (
                <article key={f.id}>
                  <LandingImage index={8 + i} />
                  <div className={s.locationInfo}>
                    <span className={s.eyebrow}>{f.code}</span>
                    <h3>{f.name}</h3>
                    <p>
                      <MapPin size={16} />
                      {f.address}
                    </p>
                    <div>
                      <span>{m.available(f.availableUnits)}</span>
                      <Link
                        className={s.primary}
                        href={`/reservations/new?facilityId=${encodeURIComponent(f.id)}`}
                      >
                        {m.selectFacility}
                        <ArrowRight size={14} />
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section id="booking-info" className={s.section}>
          <div className={`${s.container} ${s.trustGrid}`}>
            <div>
              <SectionHeading eyebrow={m.reviewsEyebrow} title={m.reviewsTitle} description="" />
              <div className={s.stories}>
                {m.stories.map((story) => (
                  <article key={story.name}>
                    <Package size={24} />
                    <p>{story.text}</p>
                    <div className={s.storyPerson}>
                      <span>{story.initials}</span>
                      <div>
                        <strong>{story.name}</strong>
                        <small>{story.context}</small>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
            <aside className={s.assurance}>
              <h3>{m.assuranceTitle}</h3>
              {m.assurances.map((a, i) => {
                const Icon = assuranceIcons[i] ?? ShieldCheck;
                return (
                  <div key={a.title}>
                    <span className={s.iconBox}>
                      <Icon size={23} />
                    </span>
                    <div>
                      <h4>{a.title}</h4>
                      <p>{a.description}</p>
                    </div>
                  </div>
                );
              })}
            </aside>
          </div>
        </section>
        <section className={s.final}>
          <div className={s.container}>
            <span className={s.eyebrow}>{m.finalEyebrow}</span>
            <h2>{m.finalTitle}</h2>
            <p>{m.finalDescription}</p>
            <div className={s.finalActions}>
              <Link href="/facilities" className={s.primary}>
                {m.finalFind}
                <ArrowRight size={18} />
              </Link>
              <a href="tel:19006868" className={s.secondary}>
                <Phone size={18} />
                {m.finalCall}
              </a>
            </div>
            <div className={s.finalHints}>
              {m.finalHints.map((h) => (
                <span key={h}>
                  <CheckCircle2 size={16} />
                  {h}
                </span>
              ))}
            </div>
          </div>
        </section>
      </main>
      <footer className={s.footer}>
        <div className={s.container}>
          <div className={s.footerGrid}>
            <div>
              <h3>{m.brand} Vietnam</h3>
              <p>{m.footerDescription}</p>
            </div>
            <div>
              <h3>{m.footerLocations}</h3>
              {state.facilities.slice(0, 4).map((f) => (
                <Link key={f.id} href={`/reservations/new?facilityId=${encodeURIComponent(f.id)}`}>
                  <MapPin size={14} />
                  {f.name}
                </Link>
              ))}
            </div>
            <div>
              <h3>{m.footerLinks}</h3>
              {nav.slice(1).map((item) => (
                <Link key={item.href} href={item.href}>
                  {item.label}
                </Link>
              ))}
            </div>
            <div>
              <h3>{m.footerHelp}</h3>
              <Link href="/login">
                {m.login}
                <ChevronRight size={14} />
              </Link>
              <a href="tel:19006868">{m.finalCall}</a>
              <Link href="/facilities">{m.findNow}</Link>
            </div>
          </div>
          <div className={s.footerBottom}>
            <span>{m.copyright}</span>
            <span>
              {m.hotlineLabel}: {m.hotline}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
