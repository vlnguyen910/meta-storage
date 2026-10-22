"use client";
import type { ReturnRequestDetailDto } from "@metastorage/contracts";
import { ConfirmReturnRefundSchema } from "@metastorage/contracts";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { F3 } from "./integration.messages";
import { f3Input, f3Panel, integrationError, money, readWholeVnd } from "./integration-utils";
import { ReturnEvidenceUpload } from "./return-evidence-upload";
import { useReturnWrite } from "./use-return-write";

export function ReturnFinancePanel({
  detail,
  manager,
}: {
  detail: ReturnRequestDetailDto;
  manager: boolean;
}) {
  const settlement = detail.settlements[0];
  return (
    <section className={f3Panel}>
      <h2 className="font-bold text-lg">{F3.settlement}</h2>
      {!settlement && <p>{F3.noSettlement}</p>}
      {manager && detail.request.status !== "CANCELLED" && !settlement && (
        <>
          <p
            id="settlement-blocked"
            className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"
          >
            {F3.settlementBlocked}
          </p>
          <Button disabled aria-describedby="settlement-blocked">
            {F3.settle}
          </Button>
        </>
      )}
      {detail.settlements.map((entry) => (
        <details
          key={entry.id}
          open={entry.id === settlement?.id}
          className="border-t border-slate-200 pt-3"
        >
          <summary className="min-h-11 cursor-pointer font-bold">
            {F3.version(entry.revision)}
          </summary>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {[
              [F3.deposit, entry.depositSnapshot],
              [F3.overdue, entry.overdueFeeAmount],
              [F3.damage, entry.damageAmount],
              [F3.rentRefund, entry.unusedRentRefundAmount],
              [F3.entitlement, entry.refundEntitlement],
              [F3.remaining, entry.remainingRefund],
              [F3.debt, entry.debtAmount],
            ].map(([label, value]) => (
              <div key={label} className="col-span-2 flex flex-wrap justify-between gap-2">
                <dt>{label}</dt>
                <dd className="font-bold">{money(value ?? "0")}</dd>
              </div>
            ))}
          </dl>
        </details>
      ))}
      <h3 className="font-semibold">{F3.refundHistory}</h3>
      <ul className="space-y-2">
        {detail.refunds.map((refund) => (
          <li
            key={refund.id}
            className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm break-words"
          >
            <strong>{money(refund.amount)}</strong> · {refund.reference}
            <p>
              {new Date(refund.confirmedAt).toLocaleString("vi-VN", {
                timeZone: detail.request.timezone,
              })}
            </p>
          </li>
        ))}
      </ul>
      {manager &&
        settlement &&
        (readWholeVnd(settlement.remainingRefund) ?? 0n) > 0n &&
        (readWholeVnd(settlement.unusedRentRefundAmount) === 0n ? (
          <RefundConfirmation detail={detail} />
        ) : (
          <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
            {F3.refundBlocked}
          </p>
        ))}
    </section>
  );
}

function RefundConfirmation({ detail }: { detail: ReturnRequestDetailDto }) {
  const [evidence, setEvidence] = useState<string[]>([]);
  const form = useForm<{ amount: string; reference: string; confirmed: boolean }>({
    defaultValues: { amount: "", reference: "", confirmed: false },
  });
  const attempt = useRef<{ payload: string; key: string } | null>(null);
  const mutation = useReturnWrite(
    detail.request.id,
    async (values: { amount: string; reference: string; confirmed: boolean }) => {
      const payload = {
        amount: values.amount,
        reference: values.reference.trim(),
        evidencePhotoIds: evidence,
      };
      const serialized = JSON.stringify(payload);
      if (attempt.current?.payload !== serialized)
        attempt.current = { payload: serialized, key: crypto.randomUUID() };
      const parsed = ConfirmReturnRefundSchema.safeParse({
        ...payload,
        expectedVersion: detail.request.version,
        idempotencyKey: attempt.current.key,
      });
      if (
        !values.confirmed ||
        !parsed.success ||
        BigInt(parsed.data.amount) >
          (readWholeVnd(detail.settlements[0]?.remainingRefund ?? "0") ?? 0n)
      ) {
        form.setError("root", { message: F3.invalid });
        throw new Error("validation");
      }
      return api.returnActions.confirmRefund(detail.request.id, parsed.data);
    },
  );
  return (
    <form
      className="space-y-4 border-t border-slate-200 pt-4"
      onSubmit={form.handleSubmit((values) => {
        form.clearErrors();
        mutation.mutate(values, {
          onSuccess: () => {
            form.reset();
            setEvidence([]);
            attempt.current = null;
          },
        });
      })}
    >
      <h3 className="font-bold">{F3.refund}</h3>
      <p className="text-sm text-slate-600">{F3.refundHelp}</p>
      <label className="grid gap-2 font-semibold text-sm">
        {F3.refundAmount}
        <input
          className={f3Input}
          inputMode="numeric"
          pattern="[0-9]+"
          required
          {...form.register("amount")}
        />
      </label>
      <label className="grid gap-2 font-semibold text-sm">
        {F3.reference}
        <input className={f3Input} maxLength={128} required {...form.register("reference")} />
      </label>
      <ReturnEvidenceUpload
        requestId={detail.request.id}
        version={detail.request.version}
        purpose="REFUND"
        selected={evidence}
        onSelect={setEvidence}
      />
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" required {...form.register("confirmed")} />
        {F3.confirmTransfer}
      </label>
      <Button
        loading={mutation.isPending}
        disabled={mutation.isPending || !evidence.length || !form.watch("confirmed")}
      >
        {F3.refund}
      </Button>
      {(form.formState.errors.root || mutation.isError) && (
        <p role="alert" className="text-red-700">
          {form.formState.errors.root?.message ?? integrationError(mutation.error)}
        </p>
      )}
      {mutation.isSuccess && (
        <p role="status" className="text-emerald-800">
          {F3.saved}
        </p>
      )}
    </form>
  );
}
