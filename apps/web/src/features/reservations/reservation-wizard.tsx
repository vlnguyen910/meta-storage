"use client";

import { ArrowLeft, MapPin } from "lucide-react";
import Link from "next/link";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { customerRoutes } from "@/config/routes";
import { checkoutMessages as m } from "./checkout.messages";
import { CheckoutConfirmation } from "./checkout-confirmation";
import { CheckoutContact } from "./checkout-contact";
import { CheckoutProgress } from "./checkout-parts";
import { CheckoutPayment } from "./checkout-payment";
import { CheckoutReview } from "./checkout-review";
import { CheckoutSelection } from "./checkout-selection";
import { useReservationCheckout } from "./use-reservation-checkout";

export function ReservationWizard() {
  const state = useReservationCheckout();

  if (state.facilitiesQuery.isLoading) return <LoadingState label={m.loading} variant="form" />;
  if (state.facilitiesQuery.isError)
    return <ErrorState message={m.facilityError} onRetry={() => state.facilitiesQuery.refetch()} />;

  const facility = state.selectedFacility;

  return (
    <div className="w-full">
      {/* Top Header: Navigation, Page Title and Current Branch inline */}
      <div className="mb-3 sm:mb-4 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href={customerRoutes.facilities}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#165f4d] transition-colors mb-0.5"
          >
            <ArrowLeft size={13} aria-hidden="true" />
            <span>{m.backToFacilities}</span>
          </Link>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 leading-tight">
            {m.customerTitle}
          </h1>
          <p className="text-[11px] text-slate-500">{m.customerDescription}</p>
        </div>

        {/* Chi nhánh hiện tại đặt ngang hàng với tiêu đề trang */}
        {facility ? (
          <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/90 bg-white p-2 px-3 shadow-xs shrink-0">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-[#165f4d]">
              <MapPin size={16} />
            </div>
            <div className="min-w-0 pr-1">
              <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                {m.currentFacility}
              </span>
              <p className="max-w-[180px] truncate text-xs font-bold text-slate-900">
                {facility.name}
              </p>
              <p className="max-w-[180px] truncate text-[10px] text-slate-500">
                {facility.address}
              </p>
            </div>
            <button
              type="button"
              onClick={() => state.setChangingFacility(!state.changingFacility)}
              className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-all cursor-pointer"
            >
              {state.changingFacility ? m.cancel : m.changeFacility}
            </button>
          </div>
        ) : null}
      </div>

      {/* Stepper */}
      <CheckoutProgress step={state.step} />

      {/* Step Content */}
      {state.step === 0 ? <CheckoutSelection state={state} /> : null}
      {state.step === 1 ? <CheckoutContact state={state} /> : null}
      {state.step === 2 ? <CheckoutReview state={state} /> : null}
      {state.step === 3 ? <CheckoutPayment state={state} /> : null}
      {state.step === 4 ? <CheckoutConfirmation state={state} /> : null}
    </div>
  );
}
