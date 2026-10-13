"use client";
import { Check, MapPin } from "lucide-react";
import { Currency } from "@/components/ui/display";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { checkoutMessages as m } from "./checkout.messages";
import s from "./checkout.module.css";
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
      <div className={s.branch}>
        <div className={s.branchInfo}>
          <MapPin size={24} />
          <div>
            <span className={s.caption}>{m.currentFacility}</span>
            <strong>{facility?.name ?? m.selectFacility}</strong>
            <p className={s.address}>{facility?.address}</p>
          </div>
        </div>
        <button
          type="button"
          className={s.secondary}
          onClick={() => state.setChangingFacility(!changingFacility)}
        >
          {changingFacility && facility ? m.cancel : m.changeFacility}
        </button>
      </div>
      {changingFacility || !facility ? (
        <section className={`${s.panel} mb-6`}>
          <h2>{m.selectFacility}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {state.facilitiesQuery.data?.items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`${s.secondary} text-left`}
                onClick={() => state.changeFacility(item.id)}
              >
                <strong className="block">{item.name}</strong>
                <span className={s.address}>{item.address}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}
      <div className={s.filters}>
        {m.areaFilters.map((filter) => (
          <button
            key={filter.value}
            className={s.filter}
            type="button"
            aria-pressed={areaFilter === filter.value}
            onClick={() => state.setAreaFilter(filter.value)}
          >
            {filter.label}
          </button>
        ))}
      </div>
      <div className={s.layout}>
        <div className={s.stack}>
          {availabilityQuery.isLoading ? <LoadingState label={m.loading} /> : null}
          {availabilityQuery.isError ? (
            <ErrorState message={m.availabilityError} onRetry={() => availabilityQuery.refetch()} />
          ) : null}
          {options?.length === 0 ? (
            <EmptyState title={m.noUnits} description={m.noUnitsDescription} />
          ) : null}
          {options?.map((option) => (
            <article
              key={option.unitTypeId}
              className={s.unitCard}
              data-selected={selected?.unitTypeId === option.unitTypeId}
              data-unavailable={option.availableCount === 0}
            >
              <div className={s.unitImage}>
                <UnitPhoto
                  index={availabilityQuery.data?.findIndex(
                    (item) => item.unitTypeId === option.unitTypeId,
                  )}
                />
                <span className={s.imageCaption}>{m.illustration}</span>
              </div>
              <div className={s.unitBody}>
                <h2>{option.unitType}</h2>
                <p
                  className={s.availabilityBadge}
                  role="status"
                  data-unavailable={option.availableCount === 0}
                >
                  {option.availableCount === 0
                    ? m.unavailablePeriod
                    : m.availableCount(option.availableCount)}
                </p>
                <div className={s.specs}>
                  <div>
                    <span className={s.caption}>{m.area}</span>
                    <strong>{option.sizeSqm} m²</strong>
                  </div>
                  <div>
                    <span className={s.caption}>{m.dimensions}</span>
                    <span>{m.updating}</span>
                  </div>
                </div>
                <div className={s.unitBottom}>
                  <div>
                    <span className={s.caption}>{m.unitPrice}</span>
                    <strong className={s.price}>
                      <Currency value={option.monthlyPrice} />
                    </strong>
                    <span className={s.caption}>{m.monthly}</span>
                  </div>
                  <button
                    type="button"
                    aria-pressed={selected?.unitTypeId === option.unitTypeId}
                    disabled={option.availableCount === 0 || availabilityQuery.isFetching}
                    className={`${s.cardSelect} ${selected?.unitTypeId === option.unitTypeId ? s.primary : s.secondary}`}
                    onClick={() =>
                      state.form.setValue("unitTypeId", option.unitTypeId, { shouldValidate: true })
                    }
                  >
                    {option.availableCount === 0 ? (
                      m.unavailable
                    ) : selected?.unitTypeId === option.unitTypeId ? (
                      <>
                        <Check size={14} />
                        {m.selected}
                      </>
                    ) : (
                      m.select
                    )}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
        <CheckoutSummary state={state} />
      </div>
    </>
  );
}
