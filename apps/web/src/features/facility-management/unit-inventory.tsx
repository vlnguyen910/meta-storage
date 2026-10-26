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
import { Boxes, Eye, Pencil, Plus, RefreshCw, Search, Wrench } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { Input, Select } from "@/components/ui/form-controls";
import { ListPagination } from "@/components/ui/list-pagination";
import { ErrorState, LoadingState } from "@/components/ui/states";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isMockMode } from "@/config/api-mode";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
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
  [StorageUnitStatus.AVAILABLE]: "border-emerald-200 bg-emerald-50 text-emerald-800",
  [StorageUnitStatus.RESERVED]: "border-sky-200 bg-sky-50 text-sky-800",
  [StorageUnitStatus.OCCUPIED]: "border-blue-200 bg-blue-50 text-blue-800",
  [StorageUnitStatus.MAINTENANCE]: "border-amber-200 bg-amber-50 text-amber-900",
  [StorageUnitStatus.INSPECTION]: "border-violet-200 bg-violet-50 text-violet-800",
  [StorageUnitStatus.RETURN_PENDING]: "border-orange-200 bg-orange-50 text-orange-900",
  [StorageUnitStatus.LOCKED]: "border-slate-300 bg-slate-100 text-slate-700",
  [StorageUnitStatus.INACTIVE]: "border-slate-300 bg-slate-100 text-slate-700",
};

const PAGE_SIZE = 10;

export function UnitInventoryWorkspace({ global = false }: Flow5ScopeProps) {
  const scope = useFacilityOptions(global);
  if (isMockMode) return <p role="status">{F5.noMock}</p>;
  if (scope.query.isPending) return <LoadingState variant="table" />;
  if (scope.query.isError)
    return <ErrorState message={F5.loadError} onRetry={() => scope.query.refetch()} />;
  return (
    <div className="flex flex-col h-full w-full overflow-hidden min-h-0 gap-3">
      <header className="shrink-0">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{F5.inventory}</h1>
        <p className="mt-1 text-xs text-slate-500">{F5.description}</p>
      </header>
      {scope.query.data.length === 0 ? (
        <p role="status" className={panelClass}>
          {F5.noFacility}
        </p>
      ) : (
        <InventoryPanel
          key={scope.facilityId}
          facilityId={scope.facilityId}
          facilityOptions={scope.query.data}
          onSelectFacility={scope.select}
          canEdit={!global}
        />
      )}
    </div>
  );
}

export function InventoryPanel({
  facilityId,
  canEdit = true,
  facilityOptions,
  onSelectFacility,
}: InventoryPanelProps) {
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [status, setStatus] = useState<StorageUnitStatus | "">("");
  const [typeId, setTypeId] = useState("");
  const [offset, setOffset] = useState(0);

  const [detailUnitId, setDetailUnitId] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingUnit, setEditingUnit] = useState<StorageUnitDetail | null>(null);
  const [maintainingUnit, setMaintainingUnit] = useState<StorageUnitDetail | null>(null);

  const types = useFacilityTypeOptions(facilityId);
  const query = useUnitInventory({
    facilityId,
    limit: PAGE_SIZE,
    offset,
    ...(status ? { status } : {}),
    ...(typeId ? { unitTypeId: typeId } : {}),
  });

  const rawItems = query.data?.items ?? [];
  const totalItems = query.data?.total ?? 0;

  // Real-time client search on fetched page for quick lookup
  const items = useMemo(() => {
    if (!searchQuery.trim()) return rawItems;
    const q = searchQuery.trim().toLowerCase();
    return rawItems.filter(
      (unit) =>
        unit.code.toLowerCase().includes(q) ||
        Boolean(unit.unitTypeName?.toLowerCase().includes(q)) ||
        Boolean(unit.floor?.toLowerCase().includes(q)) ||
        Boolean(unit.locationDescription?.toLowerCase().includes(q)),
    );
  }, [rawItems, searchQuery]);

  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSearchQuery(searchInput);
    setOffset(0);
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden min-h-0 gap-3">
      {/* Toolbar / Filters */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          {/* Facility switcher if provided */}
          {facilityOptions && facilityOptions.length > 0 && onSelectFacility && (
            <div className="w-56">
              <DropdownSelect
                value={facilityId}
                onChange={(val) => {
                  onSelectFacility(val);
                  setOffset(0);
                }}
                className="w-full"
                triggerClassName="h-9 w-full text-xs font-semibold bg-slate-50 border-slate-200"
                options={facilityOptions.map((f) => ({
                  value: f.id,
                  label: `${f.code} · ${f.name}`,
                }))}
                maxVisibleItems={6}
              />
            </div>
          )}

          {/* Search box with submit button */}
          <form
            onSubmit={handleSearchSubmit}
            className="flex items-center gap-2 flex-1 min-w-[220px]"
          >
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 size-4 text-slate-400" />
              <Input
                placeholder={F5.searchUnit}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-8.5 h-9 text-xs bg-slate-50 border-slate-200"
              />
            </div>
            <Button
              type="submit"
              variant="outline"
              className="h-9 px-3 text-xs font-semibold gap-1.5 shrink-0 border-slate-200"
            >
              <Search className="size-3.5" />
              <span>Tìm kiếm</span>
            </Button>
          </form>

          {/* Status filter */}
          <div className="w-40">
            <DropdownSelect
              value={status}
              onChange={(val) => {
                setStatus(val as StorageUnitStatus | "");
                setOffset(0);
              }}
              className="w-full"
              triggerClassName="h-9 w-full text-xs bg-slate-50 border-slate-200"
              options={[
                { value: "", label: F5.allStatuses },
                ...Object.values(StorageUnitStatus).map((value) => ({
                  value,
                  label: F5.statuses[value],
                })),
              ]}
              maxVisibleItems={6}
            />
          </div>

          {/* Unit Type filter */}
          <div className="w-44">
            <DropdownSelect
              value={typeId}
              onChange={(val) => {
                setTypeId(val);
                setOffset(0);
              }}
              className="w-full"
              triggerClassName="h-9 w-full text-xs bg-slate-50 border-slate-200"
              options={[
                { value: "", label: F5.allTypes },
                ...(types.data?.map((item) => ({
                  value: item.id,
                  label: `${item.name} (${item.sizeLabel})`,
                })) ?? []),
              ]}
              maxVisibleItems={6}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
            className="h-9 px-3 text-xs gap-1.5"
            title={F5.refresh}
          >
            <RefreshCw className={cn("size-3.5", query.isFetching && "animate-spin")} />
            <span>{F5.refresh}</span>
          </Button>

          {canEdit && (
            <Button
              type="button"
              variant="primary"
              onClick={() => setCreating(true)}
              className="h-9 px-3.5 text-xs font-semibold gap-1.5 shadow-xs"
            >
              <Plus className="size-3.5" />
              <span>{F5.newUnit}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Main Table Area (Scrollable within container) */}
      <div className="flex-1 overflow-y-auto min-h-0 border border-slate-200/90 rounded-xl bg-white shadow-xs">
        {query.isPending ? (
          <div className="p-8">
            <LoadingState variant="table" />
          </div>
        ) : query.isError ? (
          <div className="p-8">
            <ErrorState message={F5.loadError} onRetry={() => query.refetch()} />
          </div>
        ) : (
          <Table className="w-full">
            <TableHeader className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-xs border-b border-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider">
              <TableRow>
                <TableHead className="w-44 px-4 py-3">{F5.unit}</TableHead>
                <TableHead className="w-56 px-4 py-3">{F5.unitType}</TableHead>
                <TableHead className="w-36 px-4 py-3">{F5.sizeLabel}</TableHead>
                <TableHead className="px-4 py-3">{F5.location}</TableHead>
                <TableHead className="w-36 px-4 py-3">{F5.status}</TableHead>
                <TableHead className="w-36 text-right px-4 py-3">{F5.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-44 text-center text-slate-500 text-xs">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Boxes className="size-8 text-slate-300 stroke-1" />
                      <p>{F5.empty}</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                items.map((unit) => {
                  const badgeClass =
                    UNIT_STATUS_BADGE_CLASS[unit.status] ??
                    "border-slate-200 bg-slate-50 text-slate-700";

                  return (
                    <TableRow
                      key={unit.id}
                      className="hover:bg-slate-50/80 transition-colors border-b border-slate-100 last:border-b-0"
                    >
                      <TableCell className="px-4 py-3 font-semibold text-slate-900 font-mono text-xs">
                        <div className="flex items-center gap-2">
                          <span className="p-1.5 bg-slate-100 rounded-md text-slate-700">
                            <Boxes className="size-3.5" />
                          </span>
                          <span>{unit.code}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-xs text-slate-700 font-medium">
                        {unit.unitTypeName || "—"}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-xs text-slate-600">
                        {unit.unitTypeSizeLabel ? (
                          <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-medium">
                            {unit.unitTypeSizeLabel}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-xs text-slate-600">
                        {unit.floor || unit.locationDescription ? (
                          <span>
                            {unit.floor ? `${F5.floor} ${unit.floor}` : ""}
                            {unit.floor && unit.locationDescription ? " · " : ""}
                            {unit.locationDescription || ""}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">—</span>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <Badge className={cn("text-[11px] font-bold px-2 py-0.5", badgeClass)}>
                          {F5.statuses[unit.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setDetailUnitId(unit.id)}
                            className="min-h-0 h-7 px-2 text-xs gap-1"
                            title={F5.detail}
                          >
                            <Eye className="size-3.5 text-slate-500" />
                            <span className="hidden sm:inline">{F5.detail}</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination Footer */}
      <ListPagination
        label={F5.inventory}
        page={currentPage}
        pageSize={PAGE_SIZE}
        total={totalItems}
        onPageChange={(p) => setOffset((p - 1) * PAGE_SIZE)}
        pending={query.isFetching}
        unitLabel="ô kho"
      />

      {/* Detail Modal */}
      {detailUnitId && (
        <UnitDetailsModal
          key={detailUnitId}
          id={detailUnitId}
          canEdit={canEdit}
          onClose={() => setDetailUnitId("")}
          onEdit={(unit) => {
            setDetailUnitId("");
            setEditingUnit(unit);
          }}
          onMaintain={(unit) => {
            setDetailUnitId("");
            setMaintainingUnit(unit);
          }}
        />
      )}

      {/* Create Modal */}
      {creating && (
        <UnitEditor
          facilityId={facilityId}
          onClose={() => setCreating(false)}
          onSaved={(unit) => {
            setCreating(false);
            setDetailUnitId(unit.id);
          }}
        />
      )}

      {/* Edit Modal */}
      {editingUnit && (
        <UnitEditor
          facilityId={facilityId}
          unit={editingUnit}
          onClose={() => setEditingUnit(null)}
          onSaved={() => {
            setEditingUnit(null);
            query.refetch();
          }}
        />
      )}

      {/* Maintenance Transition Modal */}
      {maintainingUnit && (
        <MaintenanceEditor
          unit={maintainingUnit}
          onClose={() => setMaintainingUnit(null)}
          onSaved={() => {
            setMaintainingUnit(null);
            query.refetch();
          }}
        />
      )}
    </div>
  );
}

function UnitDetailsModal({
  id,
  canEdit,
  onClose,
  onEdit,
  onMaintain,
}: {
  id: string;
  canEdit: boolean;
  onClose: () => void;
  onEdit: (unit: StorageUnitDetail) => void;
  onMaintain: (unit: StorageUnitDetail) => void;
}) {
  const query = useUnitDetail(id);
  const [historyOffset, setHistoryOffset] = useState(0);
  const history = useMaintenanceHistory(id, historyOffset);

  if (query.isPending) {
    return (
      <ManagementDialog title={F5.detail} onClose={onClose}>
        <LoadingState variant="detail" />
      </ManagementDialog>
    );
  }

  if (query.isError) {
    return (
      <ManagementDialog title={F5.detail} onClose={onClose}>
        <ErrorState message={managementError(query.error)} onRetry={() => query.refetch()} />
      </ManagementDialog>
    );
  }

  const unit = query.data;
  const canEnter = ["AVAILABLE", "INSPECTION", "RETURN_PENDING"].includes(unit.status);
  const isMaintenance = unit.status === "MAINTENANCE";

  return (
    <ManagementDialog title={`${F5.detail}: ${unit.code}`} onClose={onClose}>
      <div className="grid gap-5">
        {/* Unit Info Grid */}
        <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50/80 rounded-xl border border-slate-200/80 text-xs">
          <div>
            <span className="text-slate-500 font-medium block">{F5.code}</span>
            <span className="font-mono font-bold text-slate-900 text-sm mt-0.5 block">
              {unit.code}
            </span>
          </div>
          <div>
            <span className="text-slate-500 font-medium block">{F5.status}</span>
            <div className="mt-0.5">
              <Badge className={cn("text-xs font-bold", UNIT_STATUS_BADGE_CLASS[unit.status])}>
                {F5.statuses[unit.status]}
              </Badge>
            </div>
          </div>
          <div>
            <span className="text-slate-500 font-medium block">{F5.floor}</span>
            <span className="text-slate-800 font-semibold mt-0.5 block">{unit.floor || "—"}</span>
          </div>
          <div>
            <span className="text-slate-500 font-medium block">{F5.location}</span>
            <span className="text-slate-800 font-semibold mt-0.5 block">
              {unit.locationDescription || "—"}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200">
          {canEdit && (
            <Button
              type="button"
              variant="outline"
              onClick={() => onEdit(unit)}
              className="min-h-0 h-8 px-3 gap-1.5 text-xs"
            >
              <Pencil className="size-3.5" />
              <span>{F5.edit}</span>
            </Button>
          )}

          {(canEnter || isMaintenance) && (
            <Button
              type="button"
              variant={isMaintenance ? "primary" : "outline"}
              onClick={() => onMaintain(unit)}
              className="min-h-0 h-8 px-3 gap-1.5 text-xs"
            >
              <Wrench className="size-3.5" />
              <span>{isMaintenance ? F5.exitMaintenance : F5.enterMaintenance}</span>
            </Button>
          )}
        </div>

        {/* Maintenance History */}
        <div className="grid gap-2.5 pt-2 border-t border-slate-200">
          <h3 className="text-sm font-bold text-slate-900">{F5.maintenanceHistory}</h3>
          {history.isPending ? (
            <LoadingState variant="table" />
          ) : history.isError ? (
            <ErrorState
              message={managementError(history.error)}
              onRetry={() => history.refetch()}
            />
          ) : history.data.items.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-2">{F5.empty}</p>
          ) : (
            <div className="grid gap-2">
              {history.data.items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-bold text-slate-900">
                      {item.action === "ENTER_MAINTENANCE"
                        ? F5.enterMaintenance
                        : F5.exitMaintenance}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {formatDateTime(item.changedAt)}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mb-1">
                    Bởi: <strong className="text-slate-800">{item.changedByName}</strong>
                  </p>
                  {item.reason && (
                    <p className="text-slate-700 bg-slate-50 p-2 rounded border border-slate-100 whitespace-pre-wrap">
                      {item.reason}
                    </p>
                  )}
                </div>
              ))}

              {history.data.total > 5 && (
                <div className="pt-2">
                  <PageControls
                    label={F5.maintenanceHistory}
                    offset={historyOffset}
                    count={history.data.items.length}
                    total={history.data.total}
                    onChange={setHistoryOffset}
                    pending={history.isFetching}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </ManagementDialog>
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
