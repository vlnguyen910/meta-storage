"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateRentalRenewalSchema } from "@metastorage/contracts";
import axios from "axios";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Button, buttonClassName } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { useRental } from "./hooks";
import { useRenewal, useRenewalHistory } from "./renewal.hooks";
import { RENEWAL_MESSAGES as M } from "./renewal.messages";

const schema = CreateRentalRenewalSchema.pick({ months: true });
export function RenewalScreen({
  rentalId,
  renewalId,
}: {
  rentalId: string;
  renewalId: string | null;
}) {
  const router = useRouter();
  const rental = useRental(rentalId);
  const history = useRenewalHistory(rentalId, 0);
  const { detail, payment, quote, checkout, now, identity } = useRenewal(rentalId, renewalId);
  const form = useForm<{ months: number }>({
    resolver: zodResolver(schema),
    defaultValues: { months: 1 },
  });
  const renewal = detail.data;
  const expired = renewal && Date.parse(renewal.expiresAt) <= now;
  const pending = history.data?.items.find((item) => item.status === "PENDING_PAYMENT");
  function submitCheckout(session: {
    checkoutUrl: string;
    checkoutFormFields: Record<string, string | number>;
  }) {
    const target = new URL(session.checkoutUrl);
    if (
      target.protocol !== "https:" &&
      !(target.protocol === "http:" && target.hostname === "localhost")
    )
      throw new Error(M.error);
    const element = document.createElement("form");
    element.method = "POST";
    element.action = target.href;
    for (const [name, value] of Object.entries(session.checkoutFormFields)) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = String(value);
      element.append(input);
    }
    document.body.append(element);
    element.submit();
    element.remove();
  }
  if (rental.isPending || (renewalId && detail.isPending)) return <LoadingState variant="detail" />;
  if (rental.isError || (renewalId && detail.isError))
    return (
      <ErrorState
        message={M.error}
        onRetry={() => {
          void rental.refetch();
          if (renewalId) void detail.refetch();
        }}
      />
    );
  const r = rental.data;
  if (!r) return <LoadingState variant="detail" />;
  const failure = quote.error || checkout.error;
  const canQuote = r.renewalWindow?.canRequest ?? r.status === "ACTIVE";
  const remaining = renewal
    ? Math.max(0, Math.ceil((Date.parse(renewal.expiresAt) - now) / 1000))
    : 0;
  return (
    <main className="mx-auto max-w-6xl space-y-6 pb-32 md:pb-8">
      <Link
        className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline underline-offset-4"
        href={`/customer/storage/${rentalId}`}
      >
        {M.back}
      </Link>
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-ink">{M.title}</h1>
        <p className="text-secondary">{M.intro}</p>
      </header>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6">
          {!renewalId ? (
            <>
              {pending ? (
                <div role="status" className="space-y-4">
                  <p>{M.pending}</p>
                  <Link className={buttonClassName()} href={`?renewalId=${pending.id}`}>
                    {M.open}
                  </Link>
                </div>
              ) : (
                <form
                  className="space-y-6"
                  onSubmit={form.handleSubmit(async ({ months }) => {
                    const result = await quote.mutateAsync(months).catch(() => null);
                    if (result) router.replace(`?renewalId=${result.id}`);
                  })}
                >
                  <div className="space-y-2">
                    <label htmlFor="renewal-months" className="block font-semibold">
                      {M.months}
                    </label>
                    <select
                      id="renewal-months"
                      className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 focus-visible:outline-2 focus-visible:outline-primary"
                      aria-describedby="renewal-duration"
                      {...form.register("months", { valueAsNumber: true })}
                    >
                      {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                        <option key={month} value={month}>
                          {month} {M.month}
                        </option>
                      ))}
                    </select>
                    <p id="renewal-duration" className="text-sm text-secondary">
                      {M.duration}
                    </p>
                    {form.formState.errors.months && (
                      <p role="alert" className="text-danger">
                        {M.blocked}
                      </p>
                    )}
                  </div>
                  {!canQuote && (
                    <p role="status" className="text-sm text-secondary">
                      {r.renewalWindow?.reason ?? M.blocked}
                    </p>
                  )}
                  <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:static md:border-0 md:p-0">
                    <Button
                      type="submit"
                      className="w-full rounded-lg"
                      loading={quote.isPending}
                      disabled={!canQuote || history.isPending || history.isError}
                    >
                      {M.quote}
                    </Button>
                  </div>
                </form>
              )}
              {history.isError && (
                <ErrorState message={M.error} onRetry={() => history.refetch()} />
              )}
            </>
          ) : (
            renewal && (
              <>
                <h2 className="text-xl font-bold">{M.status[renewal.status]}</h2>
                <p role="status" className="text-secondary">
                  {renewal.status === "APPLIED"
                    ? M.success
                    : renewal.status === "REFUND_REQUIRED"
                      ? payment.data?.status === "REFUNDED"
                        ? M.refunded
                        : M.refund
                      : expired
                        ? M.expired
                        : renewal.status === "PENDING_PAYMENT"
                          ? M.pending
                          : M.hold}
                </p>
                <dl className="space-y-4">
                  <Row label={M.currentEnd} value={formatDateTime(renewal.oldEndAt)} />
                  <Row
                    label={renewal.status === "APPLIED" ? M.newEnd : M.projectedEnd}
                    value={formatDateTime(renewal.newEndAt)}
                  />
                  <Row label={M.months} value={`${renewal.months} ${M.month}`} />
                  <Row label={M.rate} value={formatCurrency(Number(renewal.monthlyRateSnapshot))} />
                  <Row label={M.total} value={formatCurrency(Number(renewal.amount))} />
                </dl>
                {!["APPLIED", "REFUND_REQUIRED"].includes(renewal.status) && (
                  <div className="space-y-2 border-t border-slate-200 pt-4">
                    <p className="text-sm text-secondary">
                      {M.expires}: {formatDateTime(renewal.expiresAt)}
                    </p>
                    {!expired && (
                      <p className="font-semibold tabular-nums text-primary">
                        {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
                      </p>
                    )}
                  </div>
                )}
                {!expired && ["QUOTED", "PENDING_PAYMENT"].includes(renewal.status) && (
                  <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:static md:border-0 md:p-0">
                    <Button
                      className="w-full rounded-lg"
                      loading={checkout.isPending}
                      disabled={
                        renewal.status === "PENDING_PAYMENT" &&
                        (!payment.data?.checkoutUrl || payment.data.status !== "PENDING")
                      }
                      onClick={() => {
                        if (
                          renewal.status === "PENDING_PAYMENT" &&
                          payment.data?.checkoutUrl &&
                          payment.data.checkoutFormFields
                        )
                          submitCheckout({
                            checkoutUrl: payment.data.checkoutUrl,
                            checkoutFormFields: payment.data.checkoutFormFields,
                          });
                        else checkout.mutate(undefined, { onSuccess: submitCheckout });
                      }}
                    >
                      {renewal.status === "QUOTED" ? M.pay : M.resume}
                    </Button>
                  </div>
                )}
                <Button
                  variant="outline"
                  loading={detail.isFetching || payment.isFetching}
                  onClick={() => {
                    void detail.refetch();
                    if (renewal.paymentId) void payment.refetch();
                  }}
                >
                  {M.refresh}
                </Button>
                {expired &&
                  renewal.status !== "APPLIED" &&
                  renewal.status !== "REFUND_REQUIRED" &&
                  canQuote && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        localStorage.removeItem(
                          `renewal:${identity}:${rentalId}:quote:${renewal.months}`,
                        );
                        router.replace(`/customer/storage/${rentalId}/renew`);
                      }}
                    >
                      {M.newQuote}
                    </Button>
                  )}
                {payment.isError && (
                  <p role="alert" className="text-danger">
                    {M.error}
                  </p>
                )}
              </>
            )
          )}
          {failure && (
            <p role="alert" className="text-danger">
              {axios.isAxiosError(failure)
                ? (failure.response?.data?.error?.message ?? M.error)
                : failure.message || M.error}
            </p>
          )}
        </section>
        <aside className="space-y-5 rounded-2xl bg-primary/5 p-6">
          <h2 className="text-xl font-bold text-ink">{M.summary}</h2>
          <p className="font-semibold">
            {r.unitType.name} · {r.storageUnit?.code}
          </p>
          <p className="text-sm text-secondary">{r.facility.address}</p>
          <dl className="space-y-4">
            <Row label={M.currentEnd} value={formatDateTime(r.endAt)} />
            {r.renewalWindow?.cutoffAt && (
              <Row label={M.cutoff} value={formatDateTime(r.renewalWindow.cutoffAt)} />
            )}
          </dl>
          <p className="text-sm text-secondary">{M.duration}</p>
        </aside>
      </div>
    </main>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
      <dt className="text-sm text-secondary">{label}</dt>
      <dd className="font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  );
}
