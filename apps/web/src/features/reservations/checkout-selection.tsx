"use client";

import { CUSTOMER_WORKSPACE as C } from "@metastorage/shared";
import { Check, Info, Sparkles } from "lucide-react";
import { Currency } from "@/components/ui/display";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { cn } from "@/lib/utils";
import { checkoutMessages as m } from "./checkout.messages";
import type { CheckoutState } from "./checkout.types";
import { CheckoutSummary, UnitPhoto } from "./checkout-parts";

export function CheckoutSelection({ state }: { state: CheckoutState }) {
  const {
    selectedFacility: facility,
    selectedOption: selected,
    changingFacility,
    areaFilter,
    availabilityQuery,
  } = state;

  const options = availabilityQuery.data?.filter(
    (option) =>
      areaFilter === "all" ||
      (areaFilter === "small"
        ? option.sizeSqm < 3
        : areaFilter === "medium"
          ? option.sizeSqm >= 3 && option.sizeSqm <= 6
          : option.sizeSqm > 6),
  );

  return (
    <>
      <h1 className="sr-only">{m.selectUnit}</h1>

      {/* Facility Switcher (shown when user clicks Đổi chi nhánh) */}
      {changingFacility || !facility ? (
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900">{m.selectFacility}</h2>
              <p className="text-xs text-slate-500">
                Chọn cơ sở kho bạn muốn kiểm tra diện tích và đặt chỗ
              </p>
            </div>
            {facility ? (
              <button
                type="button"
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
                onClick={() => state.setChangingFacility(false)}
              >
                {m.cancel}
              </button>
            ) : null}
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {state.facilitiesQuery.data?.items.map((item) => {
              const isSelected = item.id === facility?.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={cn(
                    "text-left p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between",
                    isSelected
                      ? "border-[#165f4d] bg-emerald-50/40 ring-1 ring-[#165f4d]"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50",
                  )}
                  onClick={() => state.changeFacility(item.id)}
                >
                  <strong className="block text-xs font-bold text-slate-900">{item.name}</strong>
                  <span className="text-[11px] text-slate-500 block mt-1 line-clamp-1">
                    {item.address}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Area filter tabs */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-100 border border-slate-200/60 w-fit">
          {m.areaFilters.map((filter) => {
            const active = areaFilter === filter.value;
            return (
              <button
                key={filter.value}
                type="button"
                aria-pressed={active}
                onClick={() => state.setAreaFilter(filter.value)}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                  active
                    ? "bg-[#165f4d] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60",
                )}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-slate-400 flex items-center gap-1.5">
          <Info size={13} className="text-slate-400" />
          <span>{C.snapshot}</span>
        </p>
      </div>

      {availabilityQuery.availability.isError && (
        <ErrorState
          message={m.availabilityError}
          onRetry={() => availabilityQuery.availability.refetch()}
        />
      )}

      {/* Main Layout: Unit Type list + Summary Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-3.5">
          {availabilityQuery.isLoading ? <LoadingState label={m.loading} variant="form" /> : null}
          {availabilityQuery.isError ? (
            <ErrorState message={m.availabilityError} onRetry={() => availabilityQuery.refetch()} />
          ) : null}
          {options?.length === 0 ? (
            <EmptyState title={m.noUnits} description={m.noUnitsDescription} />
          ) : null}

          {options?.map((option) => {
            const isSelected = selected?.unitTypeId === option.unitTypeId;
            const isUnavailable = option.availableCount === 0;

            return (
              <article
                key={option.unitTypeId}
                className={cn(
                  "group relative rounded-2xl border bg-white p-4 transition-all duration-150 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between",
                  isSelected
                    ? "border-[#165f4d] bg-emerald-50/20 shadow-xs ring-1 ring-[#165f4d]"
                    : "border-slate-200 hover:border-slate-300 hover:shadow-xs",
                  isUnavailable && "opacity-60 bg-slate-50 cursor-not-allowed",
                )}
              >
                {/* Unit Photo */}
                <div className="relative w-full sm:w-36 h-28 shrink-0 rounded-xl overflow-hidden border border-slate-100 bg-slate-50">
                  <UnitPhoto
                    index={availabilityQuery.data?.findIndex(
                      (item) => item.unitTypeId === option.unitTypeId,
                    )}
                  />
                  <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-medium text-white backdrop-blur-xs">
                    {m.illustration}
                  </span>
                </div>

                {/* Unit Details */}
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-slate-900 group-hover:text-[#165f4d] transition-colors">
                      {option.unitType}
                    </h2>
                    {!option.unitType.includes(`${option.sizeSqm} m²`) && (
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                        {option.sizeSqm} m²
                      </span>
                    )}
                  </div>

                  {isUnavailable ? (
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-rose-800 bg-rose-50 w-fit px-2 py-0.5 rounded-md font-medium">
                      <span>{m.unavailablePeriod}</span>
                    </div>
                  ) : option.availableCount !== null ? (
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-emerald-800 bg-emerald-50 w-fit px-2 py-0.5 rounded-md font-medium">
                      <Sparkles size={11} className="text-emerald-700" />
                      <span>{m.availableCount(option.availableCount)}</span>
                    </div>
                  ) : null}

                  <div className="mt-2.5 flex items-center gap-4 text-xs text-slate-500">
                    <div>
                      <span className="text-[11px] text-slate-400 block">{m.area}</span>
                      <strong className="text-slate-800 font-semibold">{option.sizeSqm} m²</strong>
                    </div>
                    <div className="h-4 w-px bg-slate-200" />
                    <div>
                      <span className="text-[11px] text-slate-400 block">{m.dimensions}</span>
                      <span className="text-slate-800 font-medium">
                        {option.lengthM}m × {option.widthM}m × {option.heightM}m
                      </span>
                    </div>
                  </div>
                </div>

                {/* Price and CTA */}
                <div className="w-full sm:w-auto flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 border-slate-100 pt-3 sm:pt-0 shrink-0 gap-2">
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      {m.unitPrice}
                    </span>
                    <strong className="text-base font-bold text-[#165f4d]">
                      <Currency value={option.monthlyPrice} />
                    </strong>
                    <span className="text-[11px] text-slate-400 block">{m.monthly}</span>
                  </div>

                  <button
                    type="button"
                    aria-pressed={isSelected}
                    disabled={isUnavailable || availabilityQuery.isFetching}
                    className={cn(
                      "h-9 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs",
                      isUnavailable && "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none",
                      isSelected &&
                        "bg-[#165f4d] hover:bg-[#0f493b] text-white ring-2 ring-[#165f4d]/20",
                      !isSelected &&
                        !isUnavailable &&
                        "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300",
                    )}
                    onClick={() => {
                      if (isSelected) {
                        void state.next();
                      } else {
                        state.form.setValue("unitTypeId", option.unitTypeId, {
                          shouldValidate: true,
                        });
                      }
                    }}
                  >
                    {isUnavailable ? (
                      m.unavailable
                    ) : isSelected ? (
                      <>
                        <Check size={14} className="stroke-[2.5]" />
                        <span>{m.selected}</span>
                      </>
                    ) : (
                      m.select
                    )}
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {/* Sidebar Summary */}
        <div className="lg:col-span-5">
          <CheckoutSummary state={state} />
        </div>
      </div>

      {/* Mobile Sticky Bar */}
      {selected && (
        <div className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-between border-t border-slate-200 bg-white/95 p-3 px-4 shadow-lg backdrop-blur md:hidden">
          <div className="min-w-0 pr-2">
            <span className="block truncate text-xs text-slate-500">{selected.unitType}</span>
            <strong className="text-sm font-bold text-[#165f4d]">
              <Currency value={selected.monthlyPrice} /> / tháng
            </strong>
          </div>
          <button
            type="button"
            className="h-10 px-4 rounded-xl bg-[#165f4d] text-white text-xs font-bold shadow-xs shrink-0 flex items-center gap-1.5"
            onClick={() => void state.next()}
          >
            <span>{m.nextContact}</span>
            <span>→</span>
          </button>
        </div>
      )}
    </>
  );
}
