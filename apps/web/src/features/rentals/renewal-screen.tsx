"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateRentalRenewalSchema } from "@metastorage/contracts";
import axios from "axios";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  MapPin,
  ShieldCheck,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Button, buttonClassName } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { cn } from "@/lib/cn";
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
  const selectedMonths = form.watch("months");
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
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary hover:underline underline-offset-4"
        href={`/customer/storage/${rentalId}`}
      >
        <ArrowLeft size={16} aria-hidden="true" />
        {M.back}
      </Link>
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-ink">{M.title}</h1>
        <p className="text-secondary">{M.intro}</p>
      </header>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
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
                    <fieldset aria-describedby="renewal-duration">
                      <legend className="mb-4 text-lg font-bold">{M.months}</legend>
                      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                        {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                          <label key={month} className="cursor-pointer">
                            <input
                              type="radio"
                              name="months"
                              value={month}
                              checked={selectedMonths === month}
                              onChange={() =>
                                form.setValue("months", month, {
                                  shouldValidate: true,
                                  shouldDirty: true,
                                })
                              }
                              className="peer sr-only"
                            />
                            <span
                              className={cn(
                                "flex min-h-16 items-center justify-center gap-1.5 rounded-xl border transition hover:border-primary/50 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-primary",
                                selectedMonths === month
                                  ? "border-primary bg-primary/5 text-primary ring-1 ring-primary"
                                  : "border-slate-200 bg-white text-secondary",
                              )}
                            >
                              <span className="text-xl font-bold">{month}</span>{" "}
                              <span className="text-sm">{M.month}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <p id="renewal-duration" className="pt-2 text-sm leading-6 text-secondary">
                      {M.duration}
                    </p>
                    {form.formState.errors.months && (
                      <p role="alert" className="text-danger">
                        {M.blocked}
                      </p>
                    )}
                  </div>
                  <div className="flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
                    <CalendarDays
                      size={21}
                      className="mt-0.5 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                    <div className="space-y-1">
                      <p className="text-sm text-secondary">{M.projectedEnd}</p>
                      <p className="font-bold text-primary">
                        {formatDateTime(
                          new Date(
                            Date.parse(r.endAt) + Number(selectedMonths) * 30 * 86400000,
                          ).toISOString(),
                        )}
                      </p>
                      <p className="text-xs leading-5 text-secondary">{M.previewHint}</p>
                    </div>
                  </div>
                  {!canQuote && (
                    <p role="status" className="text-sm text-secondary">
                      {r.renewalWindow?.reason ?? M.blocked}
                    </p>
                  )}
                  <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:static md:border-0 md:p-0">
                    <Button
                      type="submit"
                      className="min-h-12 w-full rounded-xl"
                      loading={quote.isPending}
                      disabled={!canQuote || history.isPending || history.isError}
                    >
                      {quote.isPending ? M.quoting : M.quote}
                      {!quote.isPending && <ArrowRight size={18} aria-hidden="true" />}
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
                {renewal.status === "APPLIED" ? (
                  <div
                    role="status"
                    className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950"
                  >
                    <CheckCircle2
                      aria-hidden="true"
                      className="mt-0.5 size-6 shrink-0 text-emerald-700"
                    />
                    <div>
                      <h2 className="text-xl font-bold">{M.successTitle}</h2>
                      <p className="mt-2 text-sm leading-6">{M.success}</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <h2 className="text-xl font-bold">{M.status[renewal.status]}</h2>
                    <p role="status" className="text-secondary">
                      {renewal.status === "REFUND_REQUIRED"
                        ? payment.data?.status === "REFUNDED"
                          ? M.refunded
                          : M.refund
                        : expired
                          ? M.expired
                          : renewal.status === "PENDING_PAYMENT"
                            ? M.pending
                            : M.hold}
                    </p>
                  </>
                )}
                <dl className="space-y-4">
                  <Row
                    label={renewal.status === "APPLIED" ? M.previousEnd : M.currentEnd}
                    value={formatDateTime(renewal.oldEndAt)}
                  />
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
                {renewal.status === "APPLIED" ? (
                  <Link
                    className={buttonClassName("primary")}
                    href={`/customer/storage/${rentalId}`}
                  >
                    {M.viewRental}
                  </Link>
                ) : (
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
                )}
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
        <aside className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7 lg:sticky lg:top-6">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-primary/5 text-primary">
              <Warehouse size={22} aria-hidden="true" />
            </span>
            <h2 className="text-xl font-bold text-ink">{M.summary}</h2>
          </div>
          <p className="font-semibold">
            {r.unitType.name} · {r.storageUnit?.code}
          </p>
          <p className="flex items-start gap-2 text-sm leading-6 text-secondary">
            <MapPin size={16} className="mt-1 shrink-0" aria-hidden="true" />
            {r.facility.address}
          </p>
          <dl className="space-y-4 border-t border-slate-100 pt-5">
            <Row label={M.currentEnd} value={formatDateTime(r.endAt)} />
            {r.renewalWindow?.cutoffAt && (
              <Row label={M.cutoff} value={formatDateTime(r.renewalWindow.cutoffAt)} />
            )}
          </dl>
          <p className="flex items-start gap-2 rounded-xl bg-primary/5 p-3 text-sm leading-6 text-primary">
            <ShieldCheck size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            {M.depositUnchanged}
          </p>
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
