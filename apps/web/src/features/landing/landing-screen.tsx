"use client";

import { PublicHeader } from "@/components/layout/public-header";
import { landingMessages as m } from "./landing.messages";
import { LandingFacilities, LandingUnitCatalog } from "./landing-catalog";
import { LandingHero } from "./landing-hero";
import { LandingReveal } from "./landing-reveal";
import {
  LandingAbout,
  LandingBenefits,
  LandingFaq,
  LandingFooter,
  LandingProcess,
  LandingUseCases,
} from "./landing-sections";
import { useLandingCatalog } from "./use-landing-catalog";

export function LandingScreen() {
  const state = useLandingCatalog();
  return (
    <div className="min-h-screen bg-surface text-ink [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-offset-4 [&_a:focus-visible]:outline-primary [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-offset-4 [&_button:focus-visible]:outline-primary">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-xl focus:bg-primary focus:px-5 focus:py-3 focus:text-white"
      >
        {m.skip}
      </a>
      <PublicHeader />
      <main id="main-content" tabIndex={-1}>
        <LandingHero state={state} />
        <LandingUseCases />
        <LandingReveal>
          <LandingFacilities state={state} />
        </LandingReveal>
        <LandingBenefits />
        <LandingReveal>
          <LandingUnitCatalog state={state} />
        </LandingReveal>
        <LandingProcess />
        <LandingReveal>
          <LandingAbout />
        </LandingReveal>
        <LandingReveal>
          <LandingFaq />
        </LandingReveal>
      </main>
      <LandingFooter />
    </div>
  );
}
