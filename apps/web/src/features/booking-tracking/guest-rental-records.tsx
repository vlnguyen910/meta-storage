"use client";
import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useEffect } from "react";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { PaymentRecords, PrivatePdf } from "@/features/rentals/rental-records";
import { F3 } from "@/features/returns/integration.messages";
import { f3Panel, integrationError } from "@/features/returns/integration-utils";
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
    <div className="space-y-5">
      <section className={f3Panel}>
        <h2 className="text-lg font-bold">{F3.guestStorage}</h2>
        {rental.isPending ? (
          <LoadingState variant="detail" />
        ) : rental.isError ? (
          isAxiosError(rental.error) && rental.error.response?.status === 404 ? (
            <p>{F3.guestNoRental}</p>
          ) : (
            <ErrorState message={integrationError(rental.error)} onRetry={() => rental.refetch()} />
          )
        ) : (
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt>{rental.data.unitType.name}</dt>
              <dd className="font-bold">
                {rental.data.physicalUnit?.code ?? rental.data.bookingCode}
              </dd>
            </div>
            <div>
              <dt>{F3.facility}</dt>
              <dd>{rental.data.facility.name}</dd>
            </div>
            <div>
              <dt>
                {F3.status[rental.data.status as keyof typeof F3.status] ?? rental.data.status}
              </dt>
              <dd>
                {new Date(rental.data.startAt).toLocaleDateString("vi-VN")} –{" "}
                {new Date(rental.data.expectedEndAt).toLocaleDateString("vi-VN")}
              </dd>
            </div>
          </dl>
        )}
      </section>
      {rental.data && (
        <section className={f3Panel}>
          <h2 className="text-lg font-bold">{F3.payments}</h2>
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
      <section className={f3Panel}>
        <h2 className="text-lg font-bold">{F3.contracts}</h2>
        {contracts.isPending ? (
          <LoadingState variant="table" />
        ) : contracts.isError ? (
          <ErrorState
            message={integrationError(contracts.error)}
            onRetry={() => contracts.refetch()}
          />
        ) : (
          <ul className="space-y-4">
            {!contracts.data.length && <li>{F3.noContracts}</li>}
            {contracts.data.map((doc) => (
              <li key={doc.id} className="space-y-2">
                <strong className="break-all">
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
