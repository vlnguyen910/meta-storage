"use client";
import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { FileText, Info, Warehouse } from "lucide-react";
import { useEffect } from "react";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { PaymentRecords, PrivatePdf } from "@/features/rentals/rental-records";
import { F3 } from "@/features/returns/integration.messages";
import { integrationError } from "@/features/returns/integration-utils";
import { api } from "@/lib/api";

export function GuestRentalRecords({ code, onExpired }: { code: string; onExpired: () => void }) {
  const rental = useQuery({
    queryKey: ["booking-tracking", code, "rental"],
    queryFn: ({ signal }) => api.guestRentals.get(code, signal),
    retry: false,
    gcTime: 0,
    staleTime: 0,
  });
  const contracts = useQuery({
    queryKey: ["booking-tracking", code, "contracts"],
    queryFn: ({ signal }) => api.guestRentals.contracts(code, signal),
    retry: false,
    gcTime: 0,
    staleTime: 0,
  });
  const payments = useQuery({
    queryKey: ["booking-tracking", code, "payments"],
    queryFn: ({ signal }) => api.guestRentals.payments(code, signal),
    enabled: Boolean(rental.data),
    retry: false,
    gcTime: 0,
    staleTime: 0,
  });
  const expired = [rental.error, payments.error, contracts.error].some(
    (error) => isAxiosError(error) && error.response?.status === 401,
  );
  useEffect(() => {
    if (expired) onExpired();
  }, [expired, onExpired]);
  if (expired) return null;
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-lg bg-emerald-50 text-primary">
            <Warehouse size={18} />
          </div>
          <h2 className="text-lg font-bold text-ink">{F3.guestStorage}</h2>
        </div>
        {rental.isPending ? (
          <LoadingState variant="detail" />
        ) : rental.isError ? (
          isAxiosError(rental.error) && rental.error.response?.status === 404 ? (
            <div className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/80 p-4 text-sm text-muted">
              <Info size={16} className="text-slate-400 shrink-0" />
              <span>{F3.guestNoRental}</span>
            </div>
          ) : (
            <ErrorState message={integrationError(rental.error)} onRetry={() => rental.refetch()} />
          )
        ) : (
          <dl className="grid gap-3.5 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
              <dt className="text-xs font-semibold text-muted uppercase tracking-wider">
                {rental.data.unitType.name}
              </dt>
              <dd className="mt-1 font-mono text-sm font-bold text-ink">
                {rental.data.physicalUnit?.code ?? rental.data.bookingCode}
              </dd>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
              <dt className="text-xs font-semibold text-muted uppercase tracking-wider">
                {F3.facility}
              </dt>
              <dd className="mt-1 text-sm font-semibold text-ink">{rental.data.facility.name}</dd>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 sm:col-span-2">
              <dt className="text-xs font-semibold text-muted uppercase tracking-wider">
                {F3.status[rental.data.status as keyof typeof F3.status] ?? rental.data.status}
              </dt>
              <dd className="mt-1 text-sm font-semibold text-ink">
                {new Date(rental.data.startAt).toLocaleDateString("vi-VN")} –{" "}
                {new Date(rental.data.expectedEndAt).toLocaleDateString("vi-VN")}
              </dd>
            </div>
          </dl>
        )}
      </section>
      {rental.data && (
        <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs space-y-4">
          <h2 className="text-lg font-bold text-ink">{F3.payments}</h2>
          {payments.isPending ? (
            <LoadingState variant="table" />
          ) : payments.isError ? (
            <ErrorState
              message={integrationError(payments.error)}
              onRetry={() => payments.refetch()}
            />
          ) : (
            <PaymentRecords items={payments.data} />
          )}
        </section>
      )}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-lg bg-emerald-50 text-primary">
            <FileText size={18} />
          </div>
          <h2 className="text-lg font-bold text-ink">{F3.contracts}</h2>
        </div>
        {contracts.isPending ? (
          <LoadingState variant="table" />
        ) : contracts.isError ? (
          <ErrorState
            message={integrationError(contracts.error)}
            onRetry={() => contracts.refetch()}
          />
        ) : !contracts.data.length ? (
          <div className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/80 p-4 text-sm text-muted">
            <Info size={16} className="text-slate-400 shrink-0" />
            <span>{F3.noContracts}</span>
          </div>
        ) : (
          <ul className="list-none space-y-3 p-0">
            {contracts.data.map((doc) => (
              <li
                key={doc.id}
                className="space-y-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs"
              >
                <strong className="block text-sm text-ink break-all">
                  {F3.version(doc.version)} · {doc.filename}
                </strong>
                <PrivatePdf
                  filename={doc.filename}
                  load={async (signal) => {
                    try {
                      return await api.guestRentals.pdf(code, doc.id, signal);
                    } catch (error) {
                      if (isAxiosError(error) && error.response?.status === 401) onExpired();
                      throw error;
                    }
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
