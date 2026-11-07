"use client";

import { ArrowUpRight, MapPin, Ruler, Warehouse } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Currency } from "@/components/ui/display";
import { routes } from "@/config/routes";
import type { FacilityCatalogItem } from "@/features/facilities/facility-catalog.types";
import { cn } from "@/lib/cn";
import { landingMessages as m } from "./landing.messages";
import {
  CatalogFeedback,
  LandingAction,
  landingContainer,
  landingSection,
  SectionHeading,
  StorageImage,
} from "./landing-ui";
import type { useLandingCatalog } from "./use-landing-catalog";

type CatalogState = ReturnType<typeof useLandingCatalog>;

function FacilityPhoto({ facility, index }: { facility: FacilityCatalogItem; index: number }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  // Facility covers are managed by the catalog. The bundled fallback is explicitly illustrative.
  if (!facility.coverUrl || failedSource === facility.coverUrl)
    return (
      <StorageImage index={index % 2 === 0 ? 3 : 4} className="absolute inset-0" showCaption />
    );
  return (
    <Image
      unoptimized
      src={facility.coverUrl}
      alt={m.facilityImageAlt(facility.name)}
      fill
      sizes="(max-width: 640px) 100vw, 33vw"
      className="object-cover"
      onError={() => setFailedSource(facility.coverUrl)}
    />
  );
}

export function LandingFacilities({ state }: { state: CatalogState }) {
  return (
    <section id="locations" className={`${landingSection} scroll-mt-24 bg-canvas`}>
      <div className={landingContainer}>
        <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-2">
          <SectionHeading title={m.networkTitle} description={m.networkDescription} align="left" />
          <Link
            href={routes.facilities}
            className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"
          >
            {m.allFacilities}
            <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        </div>
        <CatalogFeedback
          loading={state.facilitiesQuery.isLoading}
          error={state.facilitiesQuery.isError}
          empty={false}
          onRetry={() => void state.facilitiesQuery.refetch()}
        />
        {!state.facilitiesQuery.isLoading &&
        !state.facilitiesQuery.isError &&
        !state.facilities.length ? (
          <p className="text-sm text-muted">{m.noFacilities}</p>
        ) : null}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {state.facilities.slice(0, 3).map((facility, index) => (
            <article
              key={facility.id}
              className="overflow-hidden rounded-2xl border border-line bg-surface"
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <FacilityPhoto facility={facility} index={index} />
              </div>
              <div className="p-5">
                <h3 className="text-lg font-semibold">{facility.name}</h3>
                <p className="mt-3 flex items-start gap-2 text-sm text-muted">
                  <MapPin size={16} className="mt-1" aria-hidden="true" />
                  {facility.address}
                </p>
                {facility.startingMonthlyPrice !== null ? (
                  <p className="mt-4 text-xs text-muted">
                    {m.from}{" "}
                    <strong className="text-base text-primary">
                      <Currency value={facility.startingMonthlyPrice} />
                    </strong>{" "}
                    {m.monthly}
                  </p>
                ) : null}
                <Link
                  href={state.searchHref}
                  className="mt-4 flex min-h-11 items-center justify-between border-t border-line pt-3 text-sm font-semibold text-primary"
                >
                  {m.selectFacility}
                  <ArrowUpRight size={18} aria-hidden="true" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingUnitCatalog({ state }: { state: CatalogState }) {
  return (
    <section id="pricing" className={`${landingSection} scroll-mt-24 bg-canvas`}>
      <div className={landingContainer}>
        <SectionHeading title={m.sizesTitle} description={m.sizesDescription} />
        <div className="mb-7 flex flex-wrap items-center justify-between gap-5">
          <label className="flex min-w-0 max-w-full items-center gap-3 text-sm font-medium">
            <MapPin size={18} className="text-primary" aria-hidden="true" />
            <span className="sr-only">{m.location}</span>
            <select
              value={state.facilityId}
              disabled={!state.facilities.length}
              onChange={(e) => state.setFacility(e.target.value)}
              className="min-h-12 min-w-0 max-w-full rounded-xl border border-outline-variant bg-surface px-3 focus-visible:outline-2 focus-visible:outline-primary"
            >
              {!state.facilityId ? <option value="">{m.facilityPlaceholder}</option> : null}
              {state.facilities.map((facility) => (
                <option key={facility.id} value={facility.id}>
                  {facility.name}
                </option>
              ))}
            </select>
          </label>
          <fieldset aria-label={m.filterLabel} className="flex flex-wrap gap-2">
            {[
              { value: "all", label: m.allSizes },
              { value: "small", label: m.personal },
              { value: "large", label: m.large },
            ].map((filter) => (
              <button
                key={filter.value}
                type="button"
                aria-pressed={state.filter === filter.value}
                onClick={() => state.setFilter(filter.value)}
                className={cn(
                  "min-h-11 rounded-full border px-4 text-xs font-medium transition-colors",
                  state.filter === filter.value
                    ? "border-primary bg-primary text-white"
                    : "border-outline-variant bg-surface text-ink hover:bg-primary-soft",
                )}
              >
                {filter.label}
              </button>
            ))}
          </fieldset>
        </div>
        {state.facilitiesQuery.isError ? (
          <CatalogFeedback
            loading={false}
            error
            empty={false}
            onRetry={() => void state.facilitiesQuery.refetch()}
          />
        ) : state.facilityId ? (
          <CatalogFeedback
            loading={state.availabilityQuery.isLoading}
            error={state.availabilityQuery.isError}
            empty={state.options?.length === 0}
            onRetry={() => void state.availabilityQuery.refetch()}
          />
        ) : (
          <p className="text-sm text-muted">
            {state.facilitiesQuery.isLoading ? m.loading : m.noFacilities}
          </p>
        )}
        {!state.facilitiesQuery.isError && !state.availabilityQuery.isError ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {state.options?.map((unit, index) => (
              <article
                key={unit.unitTypeId}
                className="overflow-hidden rounded-2xl border border-line bg-surface"
              >
                <div className="relative">
                  <StorageImage index={4 + (index % 3)} className="aspect-[16/10]" showCaption />
                  <span className="absolute right-3 bottom-3 rounded-lg bg-surface px-3 py-2 text-sm font-semibold text-primary">
                    {unit.sizeSqm} m²
                  </span>
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-semibold">{unit.unitType}</h3>
                  <p className="mt-3 flex items-center gap-2 text-xs text-muted">
                    <Ruler size={16} aria-hidden="true" />
                    {m.dimensions}: {unit.lengthM} × {unit.widthM} × {unit.heightM} m
                  </p>
                  <div className="mt-5 border-t border-line pt-4">
                    <p className="text-xs text-muted">
                      <strong className="text-xl font-bold text-primary">
                        <Currency value={unit.monthlyPrice} />
                      </strong>{" "}
                      {m.monthly}
                    </p>
                  </div>
                  <LandingAction href={state.searchHref} className="mt-5 w-full">
                    {m.book}
                  </LandingAction>
                </div>
              </article>
            ))}
          </div>
        ) : null}
        <p className="mt-6 flex items-start justify-center gap-2 text-center text-xs leading-6 text-muted">
          <Warehouse size={16} className="mt-1" aria-hidden="true" />
          {m.rentalHint}
        </p>
      </div>
    </section>
  );
}
