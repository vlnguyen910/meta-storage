"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  type QuoteRenewal,
  QuoteRenewalSchema,
  type RentalChargeDispute,
  RentalChargeDisputeSchema,
} from "@metastorage/contracts";
import { CUSTOMER_WORKSPACE as M } from "@metastorage/shared";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { customerApiError } from "@/features/bookings/customer-error";
import { money } from "@/features/returns/integration-utils";
import { useRentalFinance } from "./use-rental-finance";

export function CheckoutPostForm({
  checkoutUrl,
  fields,
}: {
  checkoutUrl: string;
  fields: Record<string, string | number>;
}) {
  return (
    <form action={checkoutUrl} method="POST">
      {Object.entries(fields).map(([name, value]) => (
        <input type="hidden" name={name} value={value} key={name} />
      ))}
      <Button>{M.openCheckout}</Button>
    </form>
  );
}
export function RentalFinancePanel({ rentalId }: { rentalId: string }) {
  const state = useRentalFinance(rentalId);
  const form = useForm<QuoteRenewal>({
    resolver: zodResolver(QuoteRenewalSchema),
    defaultValues: { months: 1, idempotencyKey: crypto.randomUUID() },
  });
  const renewal = state.renewal.data;
  const pending =
    state.quote.isPending ||
    state.accept.isPending ||
    state.pay.isPending ||
    state.dispute.isPending;
  return (
    <section className="my-6 grid gap-5 rounded-xl border bg-white p-5">
      <h2 className="text-xl font-bold">{M.renewal}</h2>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={form.handleSubmit((v) => state.quote.mutate(v.months))}
      >
        <label>
          {M.months}
          <input
            className="block min-h-11 w-24 rounded border p-2"
            type="number"
            min={1}
            max={12}
            {...form.register("months", { valueAsNumber: true })}
          />
        </label>
        <Button disabled={pending}>{M.quote}</Button>
      </form>
      {form.formState.errors.months && <p role="alert">{form.formState.errors.months.message}</p>}
      {state.renewal.isFetching && <p role="status">{M.loading}</p>}
      {renewal && (
        <article className="grid gap-3 rounded border p-4">
          <strong>{renewal.status}</strong>
          <p>
            {M.oldEnd}:{" "}
            {new Date(renewal.oldEndAt).toLocaleString("vi-VN", { timeZone: renewal.timezone })}
          </p>
          <p>
            {M.newEnd}:{" "}
            {new Date(renewal.newEndAt).toLocaleString("vi-VN", { timeZone: renewal.timezone })}
          </p>
          <p>
            {M.total}: {money(renewal.amount)}
          </p>
          <p>
            {M.expires}:{" "}
            {new Date(renewal.expiresAt).toLocaleString("vi-VN", { timeZone: renewal.timezone })}
          </p>
          <p className="whitespace-pre-wrap">{renewal.terms}</p>
          {renewal.failureReason && <p role="alert">{renewal.failureReason}</p>}
          {renewal.status === "QUOTED" && (
            <Button disabled={pending} onClick={() => state.accept.mutate()}>
              {M.accept}
            </Button>
          )}
          {renewal.status === "AWAITING_PAYMENT" && renewal.chargeId && (
            <Button disabled={pending} onClick={() => state.pay.mutate(renewal.chargeId!)}>
              {M.payment}
            </Button>
          )}
          {renewal.status === "APPLIED" ? (
            <p>{M.renewalApplied}</p>
          ) : renewal.status === "AWAITING_PAYMENT" ? (
            <p>{M.renewalWaiting}</p>
          ) : null}
        </article>
      )}
      <h3 className="text-lg font-bold">{M.history}</h3>
      {state.history.isPending ? (
        <LoadingState />
      ) : state.history.isError ? (
        <ErrorState
          message={customerApiError(state.history.error)}
          onRetry={() => state.history.refetch()}
        />
      ) : (
        <>
          {state.history.data.pages.flat().map((item) => (
            <Button key={item.id} variant="outline" onClick={() => state.selectRenewal(item.id)}>
              {item.status} ·{" "}
              {new Date(item.newEndAt).toLocaleString("vi-VN", { timeZone: item.timezone })} ·{" "}
              {money(item.amount)}
            </Button>
          ))}
          {state.history.hasNextPage && (
            <Button
              disabled={state.history.isFetchingNextPage}
              onClick={() => state.history.fetchNextPage()}
            >
              {M.more}
            </Button>
          )}
        </>
      )}
      <h2 className="text-xl font-bold">{M.charges}</h2>
      {state.charges.isPending ? (
        <LoadingState />
      ) : state.charges.isError ? (
        <ErrorState
          message={customerApiError(state.charges.error)}
          onRetry={() => state.charges.refetch()}
        />
      ) : (
        <>
          {!state.charges.data.pages.flatMap((page) => page.items).length && <p>{M.empty}</p>}
          {state.charges.data.pages
            .flatMap((page) => page.items)
            .map((c) => (
              <article className="grid gap-3 rounded border p-4" key={c.id}>
                <strong>
                  {M.source[c.source]} · {c.status}
                </strong>
                <p>{c.evidence}</p>
                <p>
                  {M.total}: {money(c.adjustedAmount)} · {M.outstanding}:{" "}
                  {money(c.outstandingAmount)}
                </p>
                <p>
                  {M.dueDate}: {c.dueDate ?? M.noDueDate}
                </p>
                {c.status === "OPEN" && (
                  <Button disabled={pending} onClick={() => state.pay.mutate(c.id)}>
                    {M.payment}
                  </Button>
                )}
                {c.source === "EXTRA" && c.status === "OPEN" && (
                  <ChargeDisputeForm
                    pending={pending}
                    onSubmit={(reason) => state.dispute.mutate({ chargeId: c.id, reason })}
                  />
                )}
              </article>
            ))}
          {state.charges.hasNextPage && (
            <Button
              variant="outline"
              disabled={state.charges.isFetchingNextPage}
              onClick={() => void state.charges.fetchNextPage()}
            >
              {M.more}
            </Button>
          )}
        </>
      )}
      {state.payment.data && (
        <>
          <p role="status">
            {M.paymentStatus}: {state.payment.data.status}
          </p>
          {state.payment.data.status === "PENDING" &&
            state.payment.data.checkoutUrl &&
            state.payment.data.checkoutFormFields && (
              <CheckoutPostForm
                checkoutUrl={state.payment.data.checkoutUrl}
                fields={state.payment.data.checkoutFormFields}
              />
            )}
          <Button
            variant="outline"
            disabled={state.payment.isFetching}
            onClick={() => state.payment.refetch()}
          >
            {M.checkPayment}
          </Button>
        </>
      )}
      {Object.entries({
        quote: state.quote,
        accept: state.accept,
        pay: state.pay,
        dispute: state.dispute,
        renewal: state.renewal,
        payment: state.payment,
      }).map(
        ([key, op]) =>
          op.isError && (
            <p role="alert" key={key}>
              {customerApiError(op.error)}
            </p>
          ),
      )}
    </section>
  );
}

function ChargeDisputeForm({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (reason: string) => void;
}) {
  const form = useForm<RentalChargeDispute>({
    resolver: zodResolver(RentalChargeDisputeSchema),
    defaultValues: { reason: "" },
  });
  return (
    <form
      className="flex flex-wrap gap-3"
      onSubmit={form.handleSubmit((input) => onSubmit(input.reason))}
    >
      <label className="grow">
        {M.reason}
        <textarea
          className="block min-h-11 w-full rounded border p-2"
          {...form.register("reason")}
          maxLength={4000}
        />
      </label>
      {form.formState.errors.reason && <p role="alert">{form.formState.errors.reason.message}</p>}
      <Button disabled={pending}>{M.dispute}</Button>
    </form>
  );
}
