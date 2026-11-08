"use client";

import { Check, MapPin, Search, Warehouse } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { landingMessages as m } from "./landing.messages";
import { actionClass, CatalogFeedback, landingContainer, StorageImage } from "./landing-ui";
import type { useLandingCatalog } from "./use-landing-catalog";

export function LandingHero({ state }: { state: ReturnType<typeof useLandingCatalog> }) {
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  return (
    <section className={`${landingContainer} pt-5 pb-8 sm:pt-7`}>
      <div className="relative isolate flex min-h-116 items-center justify-center overflow-hidden rounded-3xl bg-primary px-6 pt-12 pb-28 text-center sm:min-h-132 sm:pb-32">
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
          <div className="mx-auto mt-7 h-1 w-12 rounded-full bg-white/70" aria-hidden="true" />
        </motion.div>
        <span className="absolute top-4 right-4 rounded-md bg-primary-dark px-2 py-1 text-[10px] text-white">
          {m.imageLabel}
        </span>
      </div>
      <div className="relative z-10 mx-auto -mt-16 w-[calc(100%-2rem)] max-w-4xl rounded-2xl border border-line bg-surface p-5 shadow-soft sm:p-7">
        <h2 className="mb-5 text-base font-semibold sm:text-lg">{m.searchTitle}</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (state.authReady) router.push(state.searchHref);
          }}
          className="grid items-end gap-4 sm:grid-cols-[1fr_1fr_auto]"
        >
          <div className="grid min-w-0 gap-2 text-xs font-medium text-muted text-left">
            <span className="flex items-center gap-2">
              <MapPin size={16} aria-hidden="true" />
              {m.location}
            </span>
            <DropdownSelect
              id="hero-facility-select"
              options={state.facilities.map((facility) => ({
                value: facility.id,
                label: facility.name,
              }))}
              value={state.facilityId}
              onChange={(val) => state.setFacility(val)}
              placeholder={m.facilityPlaceholder}
              disabled={state.facilitiesQuery.isLoading || state.facilitiesQuery.isError}
              className="min-h-12 h-12 w-full rounded-lg border border-outline-variant bg-surface text-sm text-ink shadow-xs"
            />
          </div>
          <div className="grid min-w-0 gap-2 text-xs font-medium text-muted text-left">
            <span className="flex items-center gap-2">
              <Warehouse size={16} aria-hidden="true" />
              {m.need}
            </span>
            <DropdownSelect
              id="hero-need-select"
              options={m.needs.map((need) => ({
                value: need.value,
                label: need.label,
              }))}
              value={state.need}
              onChange={(val) => state.setNeed(val)}
              className="min-h-12 h-12 w-full rounded-lg border border-outline-variant bg-surface text-sm text-ink shadow-xs"
            />
          </div>
          <button type="submit" disabled={!state.authReady} className={actionClass}>
            <Search size={18} aria-hidden="true" />
            {m.search}
          </button>
        </form>
        <div className="mt-4">
          <CatalogFeedback
            loading={state.facilitiesQuery.isLoading}
            error={state.facilitiesQuery.isError}
            empty={false}
            onRetry={() => void state.facilitiesQuery.refetch()}
          />
        </div>
        {!state.facilitiesQuery.isLoading &&
        !state.facilitiesQuery.isError &&
        !state.facilities.length ? (
          <p className="text-sm text-muted">{m.noFacilities}</p>
        ) : null}
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
