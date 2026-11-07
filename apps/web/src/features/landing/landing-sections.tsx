import {
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardCheck,
  CreditCard,
  Mail,
  MousePointer2,
  Package,
  Ruler,
  Search,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { BrandLogo } from "@/components/ui/brand-logo";
import { routes } from "@/config/routes";
import { landingMessages as m } from "./landing.messages";
import { LandingReveal } from "./landing-reveal";
import {
  LandingAction,
  landingContainer,
  landingSection,
  SectionHeading,
  StorageImage,
} from "./landing-ui";

export function LandingUseCases() {
  return (
    <section className={`${landingContainer} ${landingSection}`}>
      <SectionHeading title={m.needsTitle} description={m.needsDescription} />
      <div className="grid gap-5 md:grid-cols-3">
        {m.useCases.map((item, index) => (
          <LandingReveal key={item.title} delay={index * 0.12}>
            <article
              key={item.title}
              className="relative isolate flex min-h-76 items-end overflow-hidden rounded-2xl p-6 text-white sm:min-h-80"
            >
              <StorageImage index={item.image} className="absolute inset-0 -z-20" />
              <div className="absolute inset-0 -z-10 bg-linear-to-t from-primary-dark via-primary-dark/65 to-transparent" />
              <div>
                <h3 className="text-xl font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6">{item.description}</p>
              </div>
            </article>
          </LandingReveal>
        ))}
      </div>
      <div className="mt-7 text-center">
        <Link
          href={routes.facilities}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"
        >
          {m.discover}
          <ArrowUpRight size={18} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

const benefitIcons = [Ruler, CreditCard, MousePointer2, CalendarDays, Mail, Search];
export function LandingBenefits() {
  return (
    <section className={`${landingContainer} ${landingSection}`}>
      <SectionHeading title={m.whyTitle} description={m.whyDescription} />
      <div className="grid gap-x-12 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {m.benefits.map((item, index) => {
          const Icon = benefitIcons[index] ?? Package;
          return (
            <LandingReveal key={item.title} delay={(index % 3) * 0.12}>
              <article className="mx-auto max-w-80 text-center">
                <div className="relative mx-auto mb-5 flex size-20 items-center justify-center rounded-[1.5rem] bg-primary-soft text-primary">
                  <Icon size={34} strokeWidth={1.5} aria-hidden="true" />
                  <span className="absolute -right-1 -bottom-1 flex size-7 items-center justify-center rounded-full border-4 border-surface bg-primary text-white">
                    <Check size={13} aria-hidden="true" />
                  </span>
                </div>
                <h3 className="text-base font-semibold">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-muted">{item.description}</p>
              </article>
            </LandingReveal>
          );
        })}
      </div>
    </section>
  );
}

const stepIcons = [Warehouse, CalendarDays, CreditCard, ClipboardCheck];
export function LandingProcess() {
  return (
    <section id="how-it-works" className={`${landingContainer} ${landingSection} scroll-mt-24`}>
      <SectionHeading title={m.processTitle} description={m.processDescription} />
      <ol className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {m.steps.map((step, index) => {
          const Icon = stepIcons[index] ?? Package;
          return (
            <li key={step.title} className="relative text-center">
              <LandingReveal delay={index * 0.12}>
                <div className="mx-auto mb-6 flex size-24 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <Icon size={38} strokeWidth={1.5} aria-hidden="true" />
                </div>
                <div className="mb-3 flex items-baseline justify-center gap-2">
                  <span className="text-lg font-bold text-primary">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="text-sm font-semibold">{step.title}</h3>
                </div>
                <p className="text-sm leading-7 text-muted">{step.description}</p>
              </LandingReveal>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function LandingAbout() {
  return (
    <section className={`${landingContainer} pb-14 sm:pb-20`}>
      <div className="grid overflow-hidden rounded-3xl bg-primary-soft md:grid-cols-2">
        <StorageImage index={2} alt={m.aboutImageAlt} className="min-h-64 md:min-h-96" />
        <div className="flex flex-col items-start justify-center p-7 sm:p-10">
          <h2 className="max-w-sm text-2xl font-bold leading-snug text-primary sm:text-3xl">
            {m.aboutTitle}
          </h2>
          <p className="mt-5 text-sm leading-7 text-ink">{m.aboutDescription}</p>
          <LandingAction href={routes.facilities} className="mt-7">
            {m.aboutAction}
          </LandingAction>
        </div>
      </div>
      <p className="mt-2 text-right text-[10px] text-muted">{m.illustration}</p>
    </section>
  );
}

export function LandingFaq() {
  return (
    <section id="booking-info" className={`${landingContainer} scroll-mt-24 pb-14 sm:pb-20`}>
      <div className="mx-auto max-w-3xl">
        <SectionHeading title={m.faq} description={m.faqDescription} />
        <div className="divide-y divide-line border-y border-line">
          {m.questions.map((item) => (
            <details key={item.question} className="group">
              <summary className="flex min-h-18 cursor-pointer list-none items-center justify-between gap-5 py-5 text-sm font-semibold focus-visible:rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
                {item.question}
                <ChevronDown
                  size={19}
                  aria-hidden="true"
                  className="text-primary transition-transform group-open:rotate-180 motion-reduce:transition-none"
                />
              </summary>
              <p className="max-w-2xl pb-6 pr-7 text-sm leading-7 text-muted">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer>
      <div className="bg-primary py-14 text-white sm:py-16">
        <div className={`${landingContainer} flex flex-wrap items-center justify-between gap-8`}>
          <div>
            <h2 className="whitespace-pre-line text-3xl font-bold leading-snug sm:text-4xl">
              {m.finalTitle}
            </h2>
            <p className="mt-4 max-w-lg text-sm leading-7">{m.finalDescription}</p>
          </div>
          <LandingAction
            href={routes.facilities}
            className="border border-white bg-white text-primary hover:bg-primary-soft"
          >
            {m.findNow}
          </LandingAction>
        </div>
      </div>
      <div className={`${landingContainer} grid gap-9 py-12 sm:grid-cols-[2fr_1fr_1fr]`}>
        <div>
          <Link
            href={routes.home}
            className="inline-flex items-center gap-2 text-xl font-bold text-primary"
          >
            <BrandLogo />
            {m.brand}
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-7 text-muted">{m.footerDescription}</p>
        </div>
        <div>
          <h3 className="mb-4 text-sm font-semibold">{m.footerLinks}</h3>
          <div className="grid gap-1 text-sm text-muted">
            {[
              { label: m.find, href: routes.facilities },
              { label: m.pricing, href: "/#pricing" },
              { label: m.process, href: "/#how-it-works" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex min-h-11 items-center hover:text-primary"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        <div>
          <h3 className="mb-4 text-sm font-semibold">{m.footerHelp}</h3>
          <div className="grid gap-1 text-sm text-muted">
            {[
              { label: m.myStorageLookup, href: routes.bookingTracking },
              { label: m.login, href: routes.login },
              { label: m.faq, href: "/#booking-info" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex min-h-11 items-center hover:text-primary"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
      <div className={`${landingContainer} border-t border-line py-6 text-xs text-muted`}>
        {m.copyright}
      </div>
    </footer>
  );
}
