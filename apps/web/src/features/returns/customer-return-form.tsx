"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, PageHeader } from "@/components/ui/display";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { customerRoutes } from "@/config/routes";
import { useRental } from "@/features/rentals/hooks";
import { useCreateReturnRequest, useReturnSlots } from "./hooks";
import { RETURNS_MESSAGES as M } from "./returns.messages";

function localDateAfterToday() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function CustomerReturnForm({ rentalId }: { rentalId: string }) {
  const router = useRouter();
  const rental = useRental(rentalId);
  const [date, setDate] = useState("");
  const [slotId, setSlotId] = useState("");
  const [reason, setReason] = useState("");
  const slots = useReturnSlots(rentalId, date);
  const create = useCreateReturnRequest(rentalId);
  if (rental.isLoading) return <LoadingState variant="detail" />;
  if (rental.isError || !rental.data)
    return <ErrorState message={M.loadError} onRetry={() => rental.refetch()} />;
  return (
    <>
      <PageHeader
        eyebrow={M.sectionTitle}
        title={M.requestTitle}
        description={M.requestDescription}
      />
      <Card className="mx-auto grid max-w-3xl gap-5">
        <div className="grid gap-2">
          <label htmlFor="return-date" className="font-semibold">
            {M.date}
          </label>
          <input
            id="return-date"
            type="date"
            min={localDateAfterToday()}
            value={date}
            onChange={(event) => {
              setDate(event.target.value);
              setSlotId("");
            }}
            className="min-h-12 rounded-md border border-line bg-white px-3"
            required
          />
        </div>
        <fieldset className="grid gap-2">
          <legend className="mb-2 font-semibold">{M.slot}</legend>
          {!date ? (
            <p className="text-muted">{M.chooseDate}</p>
          ) : slots.isLoading ? (
            <p role="status" className="text-muted">
              {M.loadingSlots}
            </p>
          ) : slots.isError ? (
            <button
              type="button"
              onClick={() => void slots.refetch()}
              className="min-h-11 justify-self-start text-primary underline"
            >
              {M.retry}
            </button>
          ) : slots.data?.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {slots.data.map((slot) => (
                <label
                  key={slot.slotId}
                  className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-md border p-3 ${slotId === slot.slotId ? "border-primary bg-primary-soft" : "border-line"}`}
                >
                  <input
                    type="radio"
                    name="return-slot"
                    value={slot.slotId}
                    checked={slotId === slot.slotId}
                    onChange={() => setSlotId(slot.slotId)}
                    required
                  />
                  <span>
                    {new Date(slot.startsAt).toLocaleTimeString("vi-VN", {
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: slot.timezone,
                    })}{" "}
                    –{" "}
                    {new Date(slot.endsAt).toLocaleTimeString("vi-VN", {
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: slot.timezone,
                    })}
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-muted">{M.noSlots}</p>
          )}
        </fieldset>
        <div className="grid gap-2">
          <label htmlFor="return-reason" className="font-semibold">
            {M.reason}
          </label>
          <textarea
            id="return-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={4000}
            rows={4}
            className="rounded-md border border-line bg-white p-3"
            required
            aria-describedby="return-reason-hint"
          />
          <small id="return-reason-hint" className="text-muted">
            {M.reasonHint}
          </small>
        </div>
        {create.isError && (
          <p role="alert" className="text-red-700">
            {M.returnRequestFailed} {M.saveError}
          </p>
        )}
        <div className="flex flex-wrap justify-between gap-3">
          <button
            type="button"
            onClick={() => router.push(customerRoutes.rental(rentalId))}
            className="min-h-11 rounded-md border border-line px-4 font-semibold"
          >
            {M.back}
          </button>
          <button
            type="button"
            disabled={!date || !slotId || !reason.trim() || create.isPending}
            onClick={() =>
              create.mutate(
                { date, slotId, reason: reason.trim() },
                { onSuccess: (request) => router.push(customerRoutes.returnRequest(request.id)) },
              )
            }
            className="min-h-11 rounded-md bg-primary px-5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {create.isPending ? M.creating : M.submit}
          </button>
        </div>
      </Card>
    </>
  );
}
