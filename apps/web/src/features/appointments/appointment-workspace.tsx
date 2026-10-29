"use client";
import type {
  AppointmentRecordDto,
  FacilityStaffMember,
  HandoverChecklistItemResult,
  InspectionRecord,
  UpdateInspectionInput,
} from "@metastorage/contracts";
import {
  HANDOVER_CHECKLIST_ITEMS,
  HandoverChecklistCompletionSchema,
  HandoverChecklistItemResultSchema,
  INSPECTION_PHOTO_MAX_COUNT,
} from "@metastorage/contracts";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { customerApiError } from "@/features/bookings/customer-error";
import { useAppointmentCheckIn, useAppointmentList } from "./appointments.hooks";
import { APPOINTMENTS_UI as m } from "./appointments.messages";

export function AppointmentWorkspace({
  facilityId,
  manager = false,
}: {
  facilityId: string;
  manager?: boolean;
}) {
  const state = useAppointmentList(facilityId, manager);
  const [date, setDate] = useState("");
  if (state.appointments.isPending) return <LoadingState variant="table" />;
  if (state.appointments.isError)
    return <ErrorState message={m.error} onRetry={() => state.appointments.refetch()} />;
  const items = state.appointments.data.filter((item) => !date || item.scheduledDate === date);
  return (
    <section className="space-y-5">
      <h2 className="text-xl font-semibold">{manager ? m.title : m.assigned}</h2>
      <label className="block text-sm">
        {m.date}
        <input
          type="date"
          className="ml-3 min-h-11 rounded-lg border border-line px-3"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
      </label>
      {state.update.isError && (
        <p role="alert" className="text-red-700">
          {customerApiError(state.update.error)}
        </p>
      )}
      {!items.length && <EmptyState title={m.empty} description={m.slotHint} />}
      <ul className="divide-y divide-line rounded-xl border border-line bg-white">
        {items.map((item) => (
          <AppointmentRow
            key={item.id}
            item={item}
            manager={manager}
            staff={state.staff.data ?? []}
            busy={state.update.isPending}
            onAssign={(staffId) => state.update.mutate({ id: item.id, staffId })}
            onCancel={() => {
              if (window.confirm(m.confirmCancel))
                state.update.mutate({ id: item.id, cancel: true });
            }}
          />
        ))}
      </ul>
    </section>
  );
}
function AppointmentRow({
  item,
  manager,
  staff,
  busy,
  onAssign,
  onCancel,
}: {
  item: AppointmentRecordDto;
  manager: boolean;
  staff: FacilityStaffMember[];
  busy: boolean;
  onAssign: (id: string) => void;
  onCancel: () => void;
}) {
  const [staffId, setStaffId] = useState(item.assignedStaffId ?? "");
  const closed = ["COMPLETED", "CANCELLED", "NO_SHOW"].includes(item.status);
  return (
    <li className="flex flex-wrap items-start justify-between gap-5 p-5">
      <div className="min-w-0 space-y-1">
        <h3 className="font-semibold">
          {m.types[item.appointmentType]} · {item.customerName ?? item.customerId}
        </h3>
        <p className="text-sm text-muted">
          {item.scheduledDate} · {item.slotStart?.slice(0, 5)}–{item.slotEnd?.slice(0, 5)}
        </p>
        <p className="text-sm">
          {m.statuses[item.status]}
          {item.contactPhone ? ` · ${item.contactPhone}` : ""}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {manager && !closed ? (
          <>
            <label className="text-sm">
              <span className="sr-only">{m.staff}</span>
              <select
                value={staffId}
                onChange={(event) => setStaffId(event.target.value)}
                disabled={busy}
                className="min-h-11 rounded-lg border border-line px-3"
              >
                <option value="">{m.chooseStaff}</option>
                {staff.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
            </label>
            <Button disabled={!staffId || busy} onClick={() => onAssign(staffId)}>
              {m.confirm}
            </Button>
            <Button variant="outline" disabled={busy} onClick={onCancel}>
              {m.cancel}
            </Button>
          </>
        ) : (
          !manager &&
          item.appointmentType === "CHECK_IN" && (
            <Link
              className="inline-flex min-h-11 items-center text-primary underline underline-offset-4"
              href={`/staff/check-in?appointmentId=${item.id}`}
            >
              {m.open}
            </Link>
          )
        )}
      </div>
    </li>
  );
}
export function AppointmentCheckInScreen() {
  return (
    <Suspense fallback={<LoadingState />}>
      <CheckInContent />
    </Suspense>
  );
}
function CheckInContent() {
  const id = useSearchParams().get("appointmentId") ?? "";
  const flow = useAppointmentCheckIn(id);
  const [unitId, setUnitId] = useState("");
  const [received, setReceived] = useState(false);
  if (!id) return <p>{m.assigned}</p>;
  if (flow.appointment.isPending) return <LoadingState variant="detail" />;
  const appointment = flow.appointment.data;
  if (appointment && appointment.appointmentType !== "CHECK_IN") return <p>{m.nonCheckIn}</p>;
  return (
    <section className="mx-auto max-w-3xl space-y-5">
      <Link className="text-primary underline underline-offset-4" href="/staff/tasks">
        {m.back}
      </Link>
      <h1 className="text-2xl font-semibold">
        {m.types[appointment?.appointmentType ?? "CHECK_IN"]} · {appointment?.customerName}
      </h1>
      {flow.error && <ErrorState message={customerApiError(flow.error)} onRetry={flow.refresh} />}
      {appointment && (
        <p>
          {appointment.scheduledDate} · {appointment.slotName} · {m.statuses[appointment.status]}
        </p>
      )}
      {appointment?.status === "COMPLETED" ? (
        <p role="status">{m.done}</p>
      ) : (
        <>
          {flow.task?.status === "ASSIGNED" && (
            <>
              <p className="text-sm text-muted">{m.slotHint}</p>
              <Button disabled={flow.busy} onClick={() => flow.start.mutate()}>
                {m.start}
              </Button>
            </>
          )}
          {flow.task?.status === "IN_PROGRESS" && !flow.record && (
            <div className="space-y-3">
              <label className="block text-sm">
                {m.chooseUnit}
                <select
                  className="mt-2 block min-h-11 w-full rounded-lg border border-line px-3"
                  value={unitId}
                  onChange={(event) => setUnitId(event.target.value)}
                >
                  <option value="">{m.chooseUnit}</option>
                  {flow.units.data?.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.code}
                    </option>
                  ))}
                </select>
              </label>
              <Button disabled={!unitId || flow.busy} onClick={() => flow.inspect.mutate(unitId)}>
                {m.inspect}
              </Button>
            </div>
          )}
          {flow.record && (
            <InspectionChecklist
              key={`${flow.record.id}:${flow.record.status}`}
              record={flow.record}
              busy={flow.busy}
              onSave={(input) => flow.save.mutate(input)}
              onUpload={(file) => flow.upload.mutate(file)}
              onRemove={(id) => flow.removePhoto.mutate(id)}
            />
          )}
          {flow.record?.status === "PASSED" && (
            <div className="space-y-4">
              <label className="flex min-h-11 items-center gap-3">
                <input
                  type="checkbox"
                  checked={received}
                  onChange={(event) => setReceived(event.target.checked)}
                  disabled={flow.busy}
                />
                {m.received}
              </label>
              <Button disabled={!received || flow.busy} onClick={() => flow.handover.mutate()}>
                {m.handover}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
function InspectionChecklist({
  record,
  busy,
  onSave,
  onUpload,
  onRemove,
}: {
  record: InspectionRecord;
  busy: boolean;
  onSave: (input: UpdateInspectionInput) => void;
  onUpload: (file: File) => void;
  onRemove: (id: string) => void;
}) {
  const [results, setResults] = useState<HandoverChecklistItemResult[]>(() =>
    Array.isArray(record.checklist.results)
      ? record.checklist.results.flatMap((entry) => {
          const parsed = HandoverChecklistItemResultSchema.safeParse(entry);
          return parsed.success ? [parsed.data] : [];
        })
      : [],
  );
  const [notes, setNotes] = useState(record.notes ?? "");
  const [condition, setCondition] = useState<"GOOD" | "MINOR_DAMAGE" | "MAJOR_DAMAGE">(
    record.condition ?? "GOOD",
  );
  const locked = record.status === "PASSED" || record.status === "FAILED";
  const payload = (status: "IN_PROGRESS" | "PASSED"): UpdateInspectionInput => ({
    status,
    condition,
    notes,
    checklist: { ...record.checklist, results },
  });
  return (
    <fieldset className="space-y-5 rounded-xl border border-line p-5" disabled={locked || busy}>
      <legend className="px-2 font-semibold">{m.checklist}</legend>
      {HANDOVER_CHECKLIST_ITEMS.map((item) => (
        <fieldset key={item.code}>
          <legend className="mb-2 text-sm">{item.label}</legend>
          <div className="flex gap-6">
            {(["PASS", "FAIL"] as const).map((value) => (
              <label key={value} className="flex min-h-11 items-center gap-2">
                <input
                  type="radio"
                  name={item.code}
                  checked={results.find((entry) => entry.itemCode === item.code)?.result === value}
                  onChange={() =>
                    setResults((previous) => [
                      ...previous.filter((entry) => entry.itemCode !== item.code),
                      {
                        itemCode: item.code,
                        resultType: "PASS_FAIL",
                        result: value,
                        note: null,
                        photos: [],
                      },
                    ])
                  }
                />
                {value === "PASS" ? m.pass : m.fail}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <label className="block text-sm">
        {m.condition}
        <select
          value={condition}
          onChange={(event) => setCondition(event.target.value as typeof condition)}
          className="ml-3 min-h-11 rounded-lg border border-line px-3"
        >
          <option value="GOOD">{m.good}</option>
          <option value="MINOR_DAMAGE">{m.minor}</option>
          <option value="MAJOR_DAMAGE">{m.major}</option>
        </select>
      </label>
      <label className="block text-sm">
        {m.notes}
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          maxLength={4000}
          className="mt-2 block min-h-24 w-full rounded-lg border border-line p-3"
        />
      </label>
      <div className="space-y-3">
        {record.evidence.map((photo) => (
          <figure key={photo.id}>
            <Image
              src={photo.url}
              alt={photo.filename}
              width={480}
              height={320}
              unoptimized
              className="h-auto max-w-full rounded-lg"
            />
            {!locked && (
              <Button type="button" variant="outline" onClick={() => onRemove(photo.id)}>
                {m.removePhoto}
              </Button>
            )}
          </figure>
        ))}
        {!locked && (
          <label className="block text-sm">
            {m.photo}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy || record.evidence.length >= INSPECTION_PHOTO_MAX_COUNT}
              className="mt-2 block min-h-11 w-full"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onUpload(file);
                event.target.value = "";
              }}
            />
          </label>
        )}
      </div>
      {record.status === "FAILED" && <p role="alert">{m.failed}</p>}
      {!locked && (
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => onSave(payload("IN_PROGRESS"))}>
            {m.save}
          </Button>
          <Button
            disabled={
              !HandoverChecklistCompletionSchema.safeParse(results).success ||
              condition === "MAJOR_DAMAGE"
            }
            onClick={() => onSave(payload("PASSED"))}
          >
            {m.passInspection}
          </Button>
        </div>
      )}
    </fieldset>
  );
}
