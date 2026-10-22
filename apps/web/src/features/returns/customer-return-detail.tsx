"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, PageHeader } from "@/components/ui/display";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { customerRoutes } from "@/config/routes";
import { formatDate } from "@/lib/format";
import {
  useCancelReturnRequest,
  useReturnRequest,
  useReturnSlots,
  useUpdateReturnRequest,
} from "./hooks";
import { ReturnFinancePanel } from "./return-finance-panel";
import { ReturnInspectionReview } from "./return-property-form";
import { ReturnStatusBadge } from "./return-status-badge";
import { RETURNS_MESSAGES as M } from "./returns.messages";

export function CustomerReturnDetail({ requestId }: { requestId: string }) {
  const query = useReturnRequest(requestId);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const cancel = useCancelReturnRequest(requestId, query.data?.request.rentalId ?? "");
  if (query.isLoading) return <LoadingState variant="detail" />;
  if (query.isError || !query.data)
    return <ErrorState message={M.loadError} onRetry={() => query.refetch()} />;
  const { request, actualReturnAt, timeChanges } = query.data;
  const pending = request.status === "PENDING";
  return (
    <>
      <PageHeader
        eyebrow={M.sectionTitle}
        title={M.details}
        description={M.sectionDescription}
        action={<Link href={customerRoutes.rental(request.rentalId)}>{M.back}</Link>}
      />
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="m-0 text-xl font-bold">{M.details}</h2>
            <ReturnStatusBadge status={request.status} />
          </div>
          <div>
            <small className="block text-muted">{M.schedule}</small>
            <strong>
              {new Date(request.startsAt).toLocaleString("vi-VN", {
                dateStyle: "full",
                timeStyle: "short",
                timeZone: request.timezone,
              })}
            </strong>
          </div>
          <div>
            <small className="block text-muted">{M.requestReason}</small>
            <p className="mb-0">{request.reason}</p>
          </div>
          <div>
            <small className="block text-muted">{M.actualReceipt}</small>
            <strong>{actualReturnAt ? formatDate(actualReturnAt) : M.notReceived}</strong>
          </div>
          {timeChanges.length > 0 && (
            <section>
              <h3 className="text-lg font-semibold">Lịch sử đề xuất đổi giờ</h3>
              <ul className="grid gap-2">
                {timeChanges.map((change) => (
                  <li key={change.id} className="rounded border border-line p-3">
                    <strong>
                      {new Date(change.proposedAt).toLocaleString("vi-VN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </strong>
                    <span className="ml-3 text-muted">{change.status}</span>
                    <p className="mb-0 text-sm text-muted">
                      {change.decisionReason ?? change.reason}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <div className="flex flex-wrap gap-3">
            {pending && (
              <button
                type="button"
                onClick={() => setEditOpen((value) => !value)}
                className="min-h-11 rounded-md border border-line px-4 font-semibold"
              >
                {M.edit}
              </button>
            )}
            {pending && (
              <button
                type="button"
                onClick={() => setConfirmCancel(true)}
                className="min-h-11 rounded-md border border-red-700 px-4 font-semibold text-red-700"
              >
                {M.cancel}
              </button>
            )}
            {confirmCancel && (
              <div
                role="alertdialog"
                aria-labelledby="cancel-title"
                className="w-full rounded-md border border-line bg-slate-50 p-4"
              >
                <p id="cancel-title">{M.cancelConfirm}</p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setConfirmCancel(false)}
                    className="min-h-11 rounded border border-line px-3"
                  >
                    Giữ yêu cầu
                  </button>
                  <button
                    type="button"
                    disabled={cancel.isPending}
                    onClick={() =>
                      cancel.mutate(
                        { expectedVersion: request.version },
                        { onSuccess: () => setConfirmCancel(false) },
                      )
                    }
                    className="min-h-11 rounded bg-red-700 px-3 font-semibold text-white disabled:opacity-60"
                  >
                    Xác nhận hủy
                  </button>
                </div>
                {cancel.isError && (
                  <p role="alert" className="mt-2 text-red-700">
                    {M.stale}
                  </p>
                )}
              </div>
            )}
          </div>
          {editOpen && pending && (
            <ReturnRequestEditor
              requestId={request.id}
              rentalId={request.rentalId}
              version={request.version}
              initialDate={new Intl.DateTimeFormat("en-CA", {
                timeZone: request.timezone,
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
              }).format(new Date(request.startsAt))}
              initialReason={request.reason}
              onClose={() => setEditOpen(false)}
            />
          )}
        </Card>
        <div className="grid content-start gap-5">
          <ReturnInspectionReview detail={query.data} staff={false} />
          <ReturnFinancePanel detail={query.data} manager={false} />
        </div>
      </div>
    </>
  );
}

function ReturnRequestEditor({
  requestId,
  rentalId,
  version,
  initialDate,
  initialReason,
  onClose,
}: {
  requestId: string;
  rentalId: string;
  version: number;
  initialDate: string;
  initialReason: string;
  onClose: () => void;
}) {
  const [date, setDate] = useState(initialDate);
  const [slotId, setSlotId] = useState("");
  const [reason, setReason] = useState(initialReason);
  const slots = useReturnSlots(rentalId, date);
  const update = useUpdateReturnRequest(requestId, rentalId);
  return (
    <fieldset className="grid gap-3 rounded-md border border-line bg-slate-50 p-4">
      <legend className="px-1 font-semibold">{M.edit}</legend>
      <label className="grid gap-1 font-semibold">
        {M.date}
        <input
          type="date"
          value={date}
          onChange={(event) => {
            setDate(event.target.value);
            setSlotId("");
          }}
          className="min-h-11 rounded border border-line bg-white px-3 font-normal"
        />
      </label>
      <label className="grid gap-1 font-semibold">
        {M.chooseTime}
        <select
          value={slotId}
          onChange={(event) => setSlotId(event.target.value)}
          disabled={slots.isLoading || !slots.data?.length}
          className="min-h-11 rounded border border-line bg-white px-3 font-normal"
        >
          <option value="">{slots.isLoading ? M.loadingSlots : M.chooseTime}</option>
          {slots.data?.map((slot) => (
            <option key={slot.slotId} value={slot.slotId}>
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
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 font-semibold">
        {M.reason}
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={4000}
          rows={3}
          className="rounded border border-line bg-white p-3 font-normal"
        />
      </label>
      {slots.isError && (
        <p role="alert" className="text-sm text-red-700">
          {M.loadError}
        </p>
      )}
      {update.isError && (
        <p role="alert" className="text-sm text-red-700">
          {M.stale}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 rounded border border-line px-4"
        >
          {M.keep}
        </button>
        <button
          type="button"
          disabled={!slotId || !reason.trim() || update.isPending}
          onClick={() =>
            update.mutate(
              { expectedVersion: version, date, slotId, reason: reason.trim() },
              { onSuccess: onClose },
            )
          }
          className="min-h-11 rounded bg-primary px-4 font-semibold text-white disabled:opacity-50"
        >
          {update.isPending ? M.saving : M.edit}
        </button>
      </div>
    </fieldset>
  );
}
