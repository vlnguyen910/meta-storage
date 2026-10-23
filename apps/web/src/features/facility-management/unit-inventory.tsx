"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  type CreateStorageUnitInput,
  CreateStorageUnitSchema,
  type StorageUnitDetail,
  type StorageUnitMaintenanceTransition,
  StorageUnitMaintenanceTransitionSchema,
  StorageUnitStatus,
} from "@metastorage/contracts";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form-controls";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { isMockMode } from "@/config/api-mode";
import { formatDateTime } from "@/lib/format";
import {
  managementError,
  useCreateUnit,
  useFacilityOptions,
  useFacilityTypeOptions,
  useMaintenanceHistory,
  useUnitDetail,
  useUnitInventory,
  useUnitMaintenance,
  useUpdateUnit,
} from "./hooks";
import { F5 } from "./management.messages";
import type { Flow5ScopeProps, InventoryPanelProps } from "./management.types";
import {
  ManagementDialog,
  ManagementField,
  PageControls,
  panelClass,
  textareaClass,
} from "./management-ui";

const UNIT_STATUS_BADGE_CLASS: Record<StorageUnitStatus, string> = {
  [StorageUnitStatus.AVAILABLE]: "border-emerald-200 bg-emerald-50 text-emerald-900",
  [StorageUnitStatus.RESERVED]: "border-sky-200 bg-sky-50 text-sky-900",
  [StorageUnitStatus.OCCUPIED]: "border-blue-200 bg-blue-50 text-blue-900",
  [StorageUnitStatus.MAINTENANCE]: "border-amber-200 bg-amber-50 text-amber-950",
  [StorageUnitStatus.INSPECTION]: "border-violet-200 bg-violet-50 text-violet-900",
  [StorageUnitStatus.RETURN_PENDING]: "border-orange-200 bg-orange-50 text-orange-950",
  [StorageUnitStatus.LOCKED]: "border-slate-300 bg-slate-100 text-slate-800",
  [StorageUnitStatus.INACTIVE]: "border-slate-300 bg-slate-100 text-slate-700",
};

export function UnitInventoryWorkspace({ global = false }: Flow5ScopeProps) {
  const scope = useFacilityOptions(global);
  if (isMockMode) return <p role="status">{F5.noMock}</p>;
  if (scope.query.isPending) return <LoadingState variant="table" />;
  if (scope.query.isError)
    return <ErrorState message={F5.loadError} onRetry={() => scope.query.refetch()} />;
  return (
    <div className="grid gap-6">
      <header>
        <h1 className="text-3xl font-bold">{F5.inventory}</h1>
        <p className="mt-2 text-slate-600">{F5.description}</p>
      </header>
      {scope.query.data.length === 0 ? (
        <p role="status">{F5.noFacility}</p>
      ) : (
        <>
          <ManagementField label={F5.facility}>
            <Select value={scope.facilityId} onChange={(event) => scope.select(event.target.value)}>
              {scope.query.data.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} · {item.name}
                </option>
              ))}
            </Select>
          </ManagementField>
          <InventoryPanel key={scope.facilityId} facilityId={scope.facilityId} canEdit={!global} />
        </>
      )}
    </div>
  );
}

export function InventoryPanel({ facilityId, canEdit }: InventoryPanelProps) {
  const [status, setStatus] = useState<StorageUnitStatus | "">("");
  const [typeId, setTypeId] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, select] = useState("");
  const [creating, setCreating] = useState(false);
  const types = useFacilityTypeOptions(facilityId);
  const query = useUnitInventory({
    facilityId,
    limit: 20,
    offset,
    ...(status ? { status } : {}),
    ...(typeId ? { unitTypeId: typeId } : {}),
  });
  return (
    <div className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
        <ManagementField label={F5.status}>
          <Select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as StorageUnitStatus | "");
              setOffset(0);
            }}
          >
            {<option value="">{F5.all}</option>}
            {Object.values(StorageUnitStatus).map((value) => (
              <option key={value} value={value}>
                {F5.statuses[value]}
              </option>
            ))}
          </Select>
        </ManagementField>
        <ManagementField label={F5.unitType}>
          <Select
            value={typeId}
            onChange={(event) => {
              setTypeId(event.target.value);
              setOffset(0);
            }}
          >
            <option value="">{F5.all}</option>
            {types.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.sizeLabel}
              </option>
            ))}
          </Select>
        </ManagementField>
        <div className="flex items-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
          >
            {F5.refresh}
          </Button>
          {canEdit && (
            <Button type="button" onClick={() => setCreating(true)}>
              {F5.newUnit}
            </Button>
          )}
        </div>
      </div>
      {types.isError && <ErrorState message={F5.loadError} onRetry={() => types.refetch()} />}
      {query.isPending ? (
        <LoadingState variant="table" />
      ) : query.isError ? (
        <ErrorState message={F5.loadError} onRetry={() => query.refetch()} />
      ) : (
        <>
          {query.data.items.length === 0 && (
            <p role="status" className={panelClass}>
              {F5.empty}
            </p>
          )}
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {query.data.items.map((unit) => (
              <li
                key={unit.id}
                className={
                  canEdit
                    ? `${panelClass} flex min-h-44 flex-col gap-3 transition duration-150 hover:border-emerald-300 hover:shadow-md`
                    : panelClass
                }
              >
                <h2
                  className={
                    canEdit
                      ? "break-words text-lg font-extrabold tracking-tight text-ink"
                      : "break-words text-lg font-bold"
                  }
                >
                  {unit.code}
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  {unit.unitTypeName} · {unit.unitTypeSizeLabel}
                </p>
                {canEdit ? (
                  <span
                    className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-bold ${UNIT_STATUS_BADGE_CLASS[unit.status]}`}
                  >
                    {F5.statuses[unit.status]}
                  </span>
                ) : (
                  <p className="my-3 text-sm font-semibold">{F5.statuses[unit.status]}</p>
                )}
                <Button
                  type="button"
                  variant={canEdit ? "primary" : "outline"}
                  className={canEdit ? "mt-auto w-full sm:w-auto" : ""}
                  aria-pressed={selected === unit.id}
                  onClick={() => select(unit.id)}
                >
                  {F5.detail}
                </Button>
              </li>
            ))}
          </ul>
          <PageControls
            label={F5.inventory}
            offset={offset}
            count={query.data.items.length}
            total={query.data.total}
            onChange={setOffset}
            pending={query.isFetching}
          />
        </>
      )}
      {selected && (
        <UnitDetails
          key={selected}
          id={selected}
          facilityId={facilityId}
          canEdit={canEdit}
          onClose={() => select("")}
        />
      )}
      {creating && (
        <UnitEditor
          facilityId={facilityId}
          onClose={() => setCreating(false)}
          onSaved={(unit) => {
            setCreating(false);
            select(unit.id);
          }}
        />
      )}
    </div>
  );
}

function UnitDetails({
  id,
  facilityId,
  canEdit,
  onClose,
}: InventoryPanelProps & { id: string; onClose: () => void }) {
  const query = useUnitDetail(id);
  const detailRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (query.data?.id) detailRef.current?.scrollIntoView({ block: "start" });
  }, [query.data?.id]);
  const [offset, setOffset] = useState(0);
  const history = useMaintenanceHistory(id, offset);
  const [editing, setEditing] = useState(false);
  const [maintaining, setMaintaining] = useState(false);
  if (query.isPending) return <LoadingState variant="detail" />;
  if (query.isError)
    return <ErrorState message={managementError(query.error)} onRetry={() => query.refetch()} />;
  const unit = query.data;
  const canEnter = ["AVAILABLE", "INSPECTION", "RETURN_PENDING"].includes(unit.status);
  return (
    <section
      ref={detailRef}
      aria-label={unit.code}
      className={`${panelClass} grid scroll-mt-20 gap-4`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">{unit.code}</h2>
        <Button type="button" variant="outline" onClick={onClose}>
          {F5.close}
        </Button>
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-600">{F5.status}</dt>
          <dd className="mt-1">
            {canEdit ? (
              <span
                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${UNIT_STATUS_BADGE_CLASS[unit.status]}`}
              >
                {F5.statuses[unit.status]}
              </span>
            ) : (
              F5.statuses[unit.status]
            )}
          </dd>
        </div>
        <div>
          <dt className="text-slate-600">{F5.floor}</dt>
          <dd>{unit.floor || "—"}</dd>
        </div>
        <div>
          <dt className="text-slate-600">{F5.location}</dt>
          <dd>{unit.locationDescription || "—"}</dd>
        </div>
      </dl>
      <div className="flex flex-wrap gap-3">
        {canEdit && (
          <Button type="button" variant="outline" onClick={() => setEditing(true)}>
            {F5.edit}
          </Button>
        )}
        {(canEnter || unit.status === "MAINTENANCE") && (
          <Button type="button" onClick={() => setMaintaining(true)}>
            {unit.status === "MAINTENANCE" ? F5.exitMaintenance : F5.enterMaintenance}
          </Button>
        )}
      </div>
      <h3 className="text-lg font-bold">{F5.maintenanceHistory}</h3>
      {history.isPending ? (
        <LoadingState variant="table" />
      ) : history.isError ? (
        <ErrorState message={managementError(history.error)} onRetry={() => history.refetch()} />
      ) : (
        <>
          {history.data.items.length === 0 && <p>{F5.empty}</p>}
          <ol className="grid gap-3">
            {history.data.items.map((item) => (
              <li key={item.id} className="rounded-xl border border-slate-200 p-4 text-sm">
                <p className="font-semibold">
                  {item.action === "ENTER_MAINTENANCE" ? F5.enterMaintenance : F5.exitMaintenance}
                </p>
                <p>
                  {item.changedByName} · {formatDateTime(item.changedAt)}
                </p>
                <p className="whitespace-pre-wrap break-words">{item.reason}</p>
              </li>
            ))}
          </ol>
          <PageControls
            label={F5.maintenanceHistory}
            offset={offset}
            count={history.data.items.length}
            total={history.data.total}
            onChange={setOffset}
            pending={history.isFetching}
          />
        </>
      )}
      {editing && (
        <UnitEditor
          facilityId={facilityId}
          unit={unit}
          onClose={() => setEditing(false)}
          onSaved={() => setEditing(false)}
        />
      )}
      {maintaining && (
        <MaintenanceEditor
          unit={unit}
          onClose={() => setMaintaining(false)}
          onSaved={() => {
            setMaintaining(false);
            setOffset(0);
          }}
        />
      )}
    </section>
  );
}

function UnitEditor({
  facilityId,
  unit,
  onClose,
  onSaved,
}: {
  facilityId: string;
  unit?: StorageUnitDetail;
  onClose: () => void;
  onSaved: (unit: StorageUnitDetail) => void;
}) {
  const types = useFacilityTypeOptions(facilityId);
  const create = useCreateUnit(facilityId);
  const update = useUpdateUnit(unit?.id ?? "");
  const mutation = unit ? update : create;
  const form = useForm<CreateStorageUnitInput>({
    resolver: zodResolver(CreateStorageUnitSchema),
    defaultValues: {
      unitTypeId: unit?.unitTypeId ?? "",
      code: unit?.code ?? "",
      floor: unit?.floor ?? "",
      locationDescription: unit?.locationDescription ?? "",
    },
  });
  const save = form.handleSubmit(async (input) => {
    const values = {
      code: input.code,
      floor: input.floor || null,
      locationDescription: input.locationDescription || null,
    };
    try {
      const result = unit
        ? await update.mutateAsync({
            ...values,
            ...(input.unitTypeId !== unit.unitTypeId ? { unitTypeId: input.unitTypeId } : {}),
          })
        : await create.mutateAsync({ ...values, unitTypeId: input.unitTypeId });
      onSaved(result);
    } catch {
      /* Keep form values and show server error below. */
    }
  });
  return (
    <ManagementDialog
      title={unit ? F5.editUnit : F5.newUnit}
      onClose={onClose}
      pending={mutation.isPending}
    >
      <form noValidate onSubmit={save} className="grid gap-4">
        <ManagementField label={F5.code} error={form.formState.errors.code?.message}>
          <Input {...form.register("code")} />
        </ManagementField>
        <ManagementField label={F5.unitType} error={form.formState.errors.unitTypeId?.message}>
          <Select {...form.register("unitTypeId")}>
            <option value="">{F5.choose}</option>
            {unit && !types.data?.some((item) => item.id === unit.unitTypeId) && (
              <option value={unit.unitTypeId}>{unit.unitTypeId}</option>
            )}
            {types.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.sizeLabel}
              </option>
            ))}
          </Select>
        </ManagementField>
        <ManagementField label={F5.floor} error={form.formState.errors.floor?.message}>
          <Input {...form.register("floor")} />
        </ManagementField>
        <ManagementField
          label={F5.location}
          error={form.formState.errors.locationDescription?.message}
        >
          <Input {...form.register("locationDescription")} />
        </ManagementField>
        {types.isError && <ErrorState message={F5.loadError} onRetry={() => types.refetch()} />}
        {mutation.isError && (
          <p role="alert" className="text-danger">
            {managementError(mutation.error)}
          </p>
        )}
        <Button type="submit" disabled={mutation.isPending || types.isPending || types.isError}>
          {F5.save}
        </Button>
      </form>
    </ManagementDialog>
  );
}

function MaintenanceEditor({
  unit,
  onClose,
  onSaved,
}: {
  unit: StorageUnitDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const action = unit.status === "MAINTENANCE" ? "EXIT_MAINTENANCE" : "ENTER_MAINTENANCE";
  const mutation = useUnitMaintenance(unit.id);
  const form = useForm<StorageUnitMaintenanceTransition>({
    resolver: zodResolver(StorageUnitMaintenanceTransitionSchema),
    defaultValues: { action, reason: "" },
  });
  return (
    <ManagementDialog
      pending={mutation.isPending}
      title={action === "ENTER_MAINTENANCE" ? F5.enterMaintenance : F5.exitMaintenance}
      onClose={onClose}
    >
      <form
        noValidate
        className="grid gap-4"
        onSubmit={form.handleSubmit(async (input) => {
          try {
            await mutation.mutateAsync(input);
            onSaved();
          } catch {
            /* Render mutation error. */
          }
        })}
      >
        <p className="text-sm text-slate-600">
          {action === "ENTER_MAINTENANCE" ? F5.maintenanceHint : F5.exitHint}
        </p>
        <p className="font-bold">{unit.code}</p>
        {action === "ENTER_MAINTENANCE" && (
          <ManagementField
            label={F5.maintenanceReason}
            error={form.formState.errors.reason?.message}
          >
            <textarea className={textareaClass} {...form.register("reason")} />
          </ManagementField>
        )}
        {mutation.isError && (
          <p role="alert" className="text-danger">
            {managementError(mutation.error)}
          </p>
        )}
        <Button type="submit" disabled={mutation.isPending}>
          {F5.save}
        </Button>
      </form>
    </ManagementDialog>
  );
}
