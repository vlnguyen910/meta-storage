"use client";

import { Check } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { landingMessages as m } from "./landing.messages";
import { landingContainer, StorageImage } from "./landing-ui";

export function LandingHero() {
  const reduceMotion = useReducedMotion();
  return (
    <section className={`${landingContainer} pt-5 pb-8 sm:pt-7`}>
      <div className="relative isolate flex min-h-116 items-center justify-center overflow-hidden rounded-3xl bg-primary px-6 pt-16 pb-16 text-center sm:min-h-132 sm:py-20">
        <StorageImage index={3} priority alt={m.heroImageAlt} className="absolute inset-0 -z-20" />
        <div className="absolute inset-0 -z-10 bg-linear-to-b from-primary-dark/65 via-primary-dark/75 to-primary-dark/90" />
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.8, ease: "easeOut" }}
          className="max-w-3xl text-white"
        >
          <h1 className="whitespace-pre-line text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
            {m.heroTitle}
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-sm leading-7 sm:text-base">
            {m.heroDescription}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <a
              href="#pricing"
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-6 text-sm font-bold text-primary shadow-soft transition-transform hover:scale-105 active:scale-95"
            >
              {m.pricing}
            </a>
            <a
              href="#locations"
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/30 bg-white/10 px-6 text-sm font-semibold text-white backdrop-blur-xs transition-colors hover:bg-white/20"
            >
              {m.networkTitle}
            </a>
          </div>
          <div className="mx-auto mt-8 h-1 w-12 rounded-full bg-white/70" aria-hidden="true" />
        </motion.div>
        <span className="absolute top-4 right-4 rounded-md bg-primary-dark px-2 py-1 text-[10px] text-white">
          {m.imageLabel}
        </span>
      </div>
      <div className="mt-7 flex flex-wrap justify-center gap-x-7 gap-y-3 text-xs text-muted sm:text-sm">
        {m.searchHints.map((hint) => (
          <span key={hint} className="flex items-center gap-2">
            <Check size={16} className="text-primary" aria-hidden="true" />
            {hint}
          </span>
        ))}
      </div>
    </section>
  );
}
