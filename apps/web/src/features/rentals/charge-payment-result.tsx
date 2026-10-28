"use client";
import { CUSTOMER_WORKSPACE as M } from "@metastorage/shared";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { customerApiError } from "@/features/bookings/customer-error";

import { useFlow3Identity } from "@/features/returns/use-flow3-identity";
import { api } from "@/lib/api";
import { CheckoutPostForm } from "./rental-finance-panel";

export function ChargePaymentResult() {
  const params = useSearchParams();
  const id = params.get("paymentId");
  const chargeId = params.get("chargeId");
  const identity = useFlow3Identity();
  const query = useQuery({
    queryKey: ["charge-payment-result", identity, id],
    queryFn: () => {
      if (!id) throw new Error();
      return api.payments.status(id);
    },
    enabled: Boolean(id) && !identity.startsWith("anonymous:"),
    retry: false,
    refetchInterval: (q) =>
      q.state.data?.status === "PENDING" && q.state.dataUpdateCount < 150 ? 2000 : false,
  });
  return (
    <main className="mx-auto grid min-h-[60vh] max-w-2xl content-center gap-5 p-5">
      <h1 className="text-2xl font-bold">{M.payment}</h1>
      {id && (
        <a
          className="min-h-11 rounded border p-3"
          href={`metastorage://payment-result?${new URLSearchParams({ paymentId: id, ...(chargeId ? { chargeId } : {}) })}`}
        >
          {M.openApp}
        </a>
      )}
      {query.isError && <p role="alert">{customerApiError(query.error)}</p>}
      <p role="status">
        {query.data?.status ?? (identity.startsWith("anonymous:") ? M.signIn : M.loading)}
      </p>
      {query.data?.status === "SUCCEEDED" && <p>{M.renewalWaiting}</p>}
      {query.data?.checkoutUrl &&
        query.data.checkoutFormFields &&
        query.data.status === "PENDING" && (
          <CheckoutPostForm
            checkoutUrl={query.data.checkoutUrl}
            fields={query.data.checkoutFormFields}
          />
        )}
      <Button
        disabled={query.isFetching || !id || identity.startsWith("anonymous:")}
        onClick={() => query.refetch()}
      >
        {M.checkPayment}
      </Button>
      <Link href="/customer/storage">{M.storage}</Link>
      {identity.startsWith("anonymous:") && <Link href="/login">{M.signIn}</Link>}
    </main>
  );
}
