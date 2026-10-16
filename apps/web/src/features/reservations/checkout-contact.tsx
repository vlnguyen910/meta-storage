"use client";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { FieldShell, Input, Select } from "@/components/ui/form-controls";
import { checkoutMessages as m } from "./checkout.messages";
import s from "./checkout.module.css";
import type { CheckoutState } from "./checkout.types";
import { CheckoutSummary } from "./checkout-parts";
import { toLocalDateTimeInput } from "./checkout-validation";

export function CheckoutContact({ state }: { state: CheckoutState }) {
  const { form } = state;

  return (
    <div className={s.layout}>
      <form
        className={s.panel}
        onSubmit={(event) => {
          event.preventDefault();
          void state.next();
        }}
        noValidate
      >
        <span className={s.badge}>{m.contactBadge}</span>
        <h1 className={s.title}>{m.contactTitle}</h1>
        <p className={s.description}>{m.contactDescription}</p>
        <div className={s.formGrid}>
          <div className={s.wide}>
            <FieldShell label={m.fullName} error={form.formState.errors.fullName?.message}>
              <Input autoComplete="name" {...form.register("fullName")} />
            </FieldShell>
          </div>
          <div>
            <FieldShell label={m.phone} error={form.formState.errors.phone?.message}>
              <Input
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="0901234567"
                {...form.register("phone")}
              />
            </FieldShell>
            <p className={s.fieldHint}>{m.phoneHint}</p>
          </div>
          <div>
            <FieldShell label={m.email} error={form.formState.errors.email?.message}>
              <Input type="email" autoComplete="email" {...form.register("email")} />
            </FieldShell>
            <p className={s.fieldHint}>{m.emailHint}</p>
          </div>
          <FieldShell label={m.duration} error={form.formState.errors.durationMonths?.message}>
            <Select {...form.register("durationMonths", { valueAsNumber: true })}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                <option key={month} value={month}>
                  {m.month(month)}
                </option>
              ))}
            </Select>
          </FieldShell>
          <FieldShell label={m.date} error={form.formState.errors.checkInDate?.message}>
            <Input
              type="date"
              min={toLocalDateTimeInput(new Date(Date.now() + 86400000)).slice(0, 10)}
              {...form.register("checkInDate")}
            />
          </FieldShell>
          <FieldShell label={m.time} error={form.formState.errors.checkInSlotId?.message}>
            <Select {...form.register("checkInSlotId")} disabled={state.slotsQuery.isLoading}>
              <option value="">{m.selectSlot}</option>
              {state.slotsQuery.data?.map((slot) => (
                <option key={slot.id} value={slot.id}>
                  {m.slotLabel(slot.name, slot.startTime, slot.endTime)}
                </option>
              ))}
            </Select>
          </FieldShell>
          {state.slotsQuery.isError ? (
            <button type="button" onClick={() => state.slotsQuery.refetch()}>
              {m.refreshSlots}
            </button>
          ) : null}
          <div className={s.wide}>
            <FieldShell label={m.note} hint={m.optional}>
              <textarea
                value={state.note}
                placeholder={m.notePlaceholder}
                onChange={(event) => state.setNote(event.target.value)}
              />
            </FieldShell>
          </div>
        </div>
        {state.submissionError ? (
          <p role="alert" className={s.fieldError}>
            {state.submissionError}
          </p>
        ) : null}
        {state.selectedOption?.availableCount === 0 ? (
          <div className={s.capacityNotice} role="alert">
            <p>{m.unavailablePeriod}</p>
            <button type="button" className={s.secondary} onClick={() => state.setStep(0)}>
              {m.chooseAnother}
            </button>
            <button
              type="button"
              className={s.secondary}
              disabled={state.availabilityQuery.isFetching}
              onClick={() => void state.availabilityQuery.refetch()}
            >
              {m.refreshAvailability}
            </button>
          </div>
        ) : null}
        <div className={s.actions}>
          <button type="button" className={s.secondary} onClick={() => state.setStep(0)}>
            <ArrowLeft size={14} className="inline mr-2" />
            {m.back}
          </button>
          <button
            type="submit"
            className={s.primary}
            disabled={
              state.busy ||
              state.availabilityQuery.isFetching ||
              state.availabilityQuery.isError ||
              state.selectedOption?.availableCount === 0
            }
          >
            {state.busy ? m.loading : m.review}
            <ArrowRight size={15} />
          </button>
        </div>
      </form>
      <CheckoutSummary state={state} />
    </div>
  );
}
