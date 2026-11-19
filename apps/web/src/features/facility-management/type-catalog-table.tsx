"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  type CreateUnitTypeCatalog,
  CreateUnitTypeCatalogSchema,
  type UnitTypeCatalogDto,
} from "@metastorage/contracts";
import { Layers, Pencil, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { Input } from "@/components/ui/form-controls";
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
import { useToast } from "@/components/ui/toast";
import { useAuthStore } from "@/features/auth/auth-store";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CoverImageField } from "./cover-image-field";
import { managementError, useCreateType, useManagedTypes, useUpdateType } from "./hooks";
import { F5 } from "./management.messages";
import { ManagementDialog, ManagementField } from "./management-ui";

const PAGE_SIZE = 6;

export function TypeCatalogTable({
  paginationLabel = F5.types,
}: {
  paginationLabel?: string;
} = {}) {
  const canEdit = useAuthStore(
    (state) => state.session?.user.role === "BUSINESS_OPERATION_MANAGER",
  );
  const query = useManagedTypes();
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<UnitTypeCatalogDto | "new" | null>(null);
  const [toggling, setToggling] = useState<UnitTypeCatalogDto | null>(null);

  const items = query.data ?? [];

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      const matchQuery =
        !q ||
        item.code.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.sizeLabel.toLowerCase().includes(q);
      const matchStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && item.isActive) ||
        (statusFilter === "INACTIVE" && !item.isActive);
      return matchQuery && matchStatus;
    });
  }, [items, searchQuery, statusFilter]);

  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, page), totalPages);

  const pagedItems = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  if (query.isPending) return <LoadingState variant="table" />;
  if (query.isError) {
    return <ErrorState message={F5.loadError} onRetry={() => query.refetch()} />;
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSearchQuery(searchInput);
    setPage(1);
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden min-h-0 gap-3">
      {/* Filter / Search bar */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 p-3 bg-white border border-slate-200/90 rounded-xl shadow-xs">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 min-w-0">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label={F5.searchType}
              placeholder={F5.searchType}
              className="pl-9 h-10 min-h-10 text-sm bg-slate-50/50 border-slate-200 focus:bg-white"
            />
          </div>
          <Button
            type="submit"
            variant="outline"
            className="h-10 px-3 text-xs font-semibold gap-1.5 shrink-0 border-slate-200"
          >
            <Search className="size-3.5" />
            <span>{F5.search}</span>
          </Button>
        </form>

        <div className="w-full sm:w-48 shrink-0">
          <DropdownSelect
            value={statusFilter}
            onChange={(val) => {
              setStatusFilter(val);
              setPage(1);
            }}
            className="w-full"
            triggerClassName="h-10 min-h-10 w-full text-sm bg-slate-50/50 border-slate-200 focus:bg-white"
            options={[
              { value: "ALL", label: F5.allStatuses },
              { value: "ACTIVE", label: F5.active },
              { value: "INACTIVE", label: F5.inactive },
            ]}
            maxVisibleItems={6}
          />
        </div>

        {canEdit && (
          <Button
            type="button"
            variant="primary"
            onClick={() => setEditing("new")}
            className="h-10 px-4 text-xs font-semibold gap-2 shadow-xs shrink-0"
          >
            <Plus className="size-4" />
            <span>{F5.newType}</span>
          </Button>
        )}
      </div>

      {/* Table container */}
      <div className="flex-1 overflow-y-auto min-h-0 border border-slate-200/90 rounded-xl bg-white shadow-xs">
        <Table>
          <TableHeader className="sticky top-0 bg-slate-50/95 backdrop-blur-xs z-10 border-b border-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider">
            <TableRow>
              <TableHead className="w-28 px-3.5 py-2.5">{F5.code}</TableHead>
              <TableHead className="w-56 px-3.5 py-2.5">{F5.name}</TableHead>
              <TableHead className="w-28 px-3.5 py-2.5">{F5.sizeLabel}</TableHead>
              <TableHead className="w-40 px-3.5 py-2.5">{F5.dimensions}</TableHead>
              <TableHead className="w-36 px-3.5 py-2.5">{F5.priceRange}</TableHead>
              <TableHead className="w-32 px-3.5 py-2.5">{F5.status}</TableHead>
              <TableHead className="w-56 text-right px-3.5 py-2.5">{F5.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-slate-500 text-xs">
                  {F5.empty}
                </TableCell>
              </TableRow>
            ) : (
              pagedItems.map((item) => (
                <TableRow
                  key={item.id}
                  className="hover:bg-slate-50/70 transition-colors border-b border-slate-100 last:border-b-0"
                >
                  <TableCell className="px-3.5 py-2 font-mono font-bold text-xs">
                    <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200/80">
                      {item.code}
                    </span>
                  </TableCell>
                  <TableCell className="px-3.5 py-2 font-bold text-slate-900 text-xs">
                    <div className="flex items-center gap-2">
                      <Layers className="size-3.5 text-primary shrink-0" />
                      <span>{item.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-3.5 py-2">
                    <Badge className="bg-purple-50 text-purple-700 border-purple-200 text-xs font-semibold">
                      {item.sizeLabel}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-3.5 py-2 text-slate-600 font-medium text-xs">
                    {item.lengthM} × {item.widthM} × {item.heightM} m
                  </TableCell>
                  <TableCell className="px-3.5 py-2">
                    <div className="flex items-baseline gap-1">
                      <span className="font-mono font-bold text-xs text-slate-900">
                        {formatCurrency(item.minMonthlyPrice)} –{" "}
                        {formatCurrency(item.maxMonthlyPrice)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="px-3.5 py-2">
                    <Badge
                      className={cn(
                        "text-xs font-semibold px-2 py-0.5",
                        item.isActive
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-100 text-slate-500 border-slate-200",
                      )}
                    >
                      {item.isActive ? F5.active : F5.inactive}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-3.5 py-2 text-right">
                    {canEdit ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setEditing(item)}
                          className="h-8 min-h-8 px-2.5 text-xs gap-1 border-slate-200 text-slate-700 hover:text-primary hover:border-primary"
                        >
                          <Pencil className="size-3.5" />
                          <span>{F5.edit}</span>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setToggling(item)}
                          className={cn(
                            "h-8 px-2.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer",
                            item.isActive
                              ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-700 hover:text-white hover:border-red-600"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white hover:border-emerald-600",
                          )}
                        >
                          {item.isActive ? F5.deactivate : F5.activate}
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted">{F5.readOnly}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination footer */}
      <ListPagination
        label={paginationLabel}
        page={currentPage}
        pageSize={PAGE_SIZE}
        total={totalItems}
        onPageChange={setPage}
        unitLabel="bản ghi"
      />

      {canEdit && editing && (
        <TypeEditor
          type={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
      {canEdit && toggling && (
        <TypeStatusEditor type={toggling} onClose={() => setToggling(null)} />
      )}
    </div>
  );
}

function TypeEditor({ type, onClose }: { type?: UnitTypeCatalogDto; onClose: () => void }) {
  const { showToast } = useToast();
  const create = useCreateType();
  const update = useUpdateType(type?.id ?? "");
  const mutation = type ? update : create;
  const form = useForm<CreateUnitTypeCatalog>({
    resolver: zodResolver(
      CreateUnitTypeCatalogSchema.refine(
        (value) => value.maxMonthlyPrice >= value.minMonthlyPrice,
        { path: ["maxMonthlyPrice"], message: F5.invalidBounds },
      ),
    ),
    defaultValues: {
      code: type?.code ?? "",
      name: type?.name ?? "",
      coverUrl: type?.coverUrl ?? "",
      sizeLabel: type?.sizeLabel ?? "",
      lengthM: type?.lengthM,
      widthM: type?.widthM,
      heightM: type?.heightM,
      minMonthlyPrice: type?.minMonthlyPrice,
      maxMonthlyPrice: type?.maxMonthlyPrice,
    },
  });

  return (
    <ManagementDialog
      title={type ? F5.editType : F5.newType}
      onClose={onClose}
      pending={mutation.isPending}
    >
      <form
        noValidate
        className="grid gap-4"
        onSubmit={form.handleSubmit(async (input) => {
          try {
            if (type) {
              await update.mutateAsync({ ...input, expectedVersion: type.version });
            } else {
              await create.mutateAsync(input);
            }
            showToast(F5.saved, "success");
            onClose();
          } catch {
            /* Backend validation errors */
          }
        })}
      >
        <ManagementField label={F5.code} error={form.formState.errors.code?.message}>
          <Input
            {...form.register("code")}
            placeholder="Ví dụ: UT-10M"
            className="h-10 min-h-10 w-full rounded-lg border-slate-200 bg-slate-50/50 px-3 text-xs text-slate-900 placeholder:text-slate-400 transition-colors focus:border-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </ManagementField>
        <ManagementField label={F5.name} error={form.formState.errors.name?.message}>
          <Input
            {...form.register("name")}
            placeholder="Ví dụ: Kho tiêu chuẩn (10 m²)"
            className="h-10 min-h-10 w-full rounded-lg border-slate-200 bg-slate-50/50 px-3 text-xs text-slate-900 placeholder:text-slate-400 transition-colors focus:border-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </ManagementField>
        <ManagementField
          label={F5.coverImage}
          error={form.formState.errors.coverUrl ? F5.coverImageRequired : undefined}
        >
          <CoverImageField
            id="unit-type-cover-url"
            value={form.watch("coverUrl")}
            onChange={(coverUrl) =>
              form.setValue("coverUrl", coverUrl, { shouldDirty: true, shouldValidate: true })
            }
          />
        </ManagementField>
        <ManagementField label={F5.sizeLabel} error={form.formState.errors.sizeLabel?.message}>
          <Input
            {...form.register("sizeLabel")}
            placeholder="Ví dụ: 10 m²"
            className="h-10 min-h-10 w-full rounded-lg border-slate-200 bg-slate-50/50 px-3 text-xs text-slate-900 placeholder:text-slate-400 transition-colors focus:border-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </ManagementField>
        <div className="grid gap-3 sm:grid-cols-3">
          {(["lengthM", "widthM", "heightM"] as const).map((field, index) => (
            <ManagementField
              key={field}
              label={[F5.length, F5.width, F5.height][index] ?? F5.length}
              error={form.formState.errors[field]?.message}
            >
              <Input
                type="number"
                step="any"
                min="0"
                {...form.register(field, { valueAsNumber: true })}
                className="h-10 min-h-10 w-full rounded-lg border-slate-200 bg-slate-50/50 px-3 text-xs text-slate-900 placeholder:text-slate-400 transition-colors focus:border-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </ManagementField>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {(["minMonthlyPrice", "maxMonthlyPrice"] as const).map((field) => (
            <ManagementField
              key={field}
              label={field === "minMonthlyPrice" ? F5.minPrice : F5.maxPrice}
              error={
                form.formState.errors[field]
                  ? form.formState.errors[field]?.message === F5.invalidBounds
                    ? F5.invalidBounds
                    : F5.invalidCatalogPrice
                  : undefined
              }
            >
              <Input
                type="number"
                min="1"
                max="2147483647"
                step="1"
                {...form.register(field, { valueAsNumber: true })}
              />
            </ManagementField>
          ))}
        </div>
        {mutation.isError && (
          <p role="alert" className="text-xs font-semibold text-danger">
            {managementError(mutation.error)}
          </p>
        )}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="h-9 px-4 text-xs font-semibold"
          >
            {F5.cancel}
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={mutation.isPending}
            loading={mutation.isPending}
            className="h-9 px-4 text-xs font-semibold"
          >
            {F5.save}
          </Button>
        </div>
      </form>
    </ManagementDialog>
  );
}

function TypeStatusEditor({ type, onClose }: { type: UnitTypeCatalogDto; onClose: () => void }) {
  const { showToast } = useToast();
  const mutation = useUpdateType(type.id);
  const isDeactivating = type.isActive;
  return (
    <ManagementDialog
      title={isDeactivating ? F5.deactivateTitle : F5.activateTitle}
      onClose={onClose}
      pending={mutation.isPending}
    >
      <div className="grid gap-3 py-1">
        <p className="text-xs text-slate-600 leading-relaxed">
          {F5.typeStatusHint(type.name, type.isActive)}
        </p>
        {mutation.isError && (
          <p role="alert" className="text-xs font-semibold text-danger">
            {managementError(mutation.error)}
          </p>
        )}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="h-9 px-4 text-xs font-semibold"
          >
            {F5.cancel}
          </Button>
          <Button
            type="button"
            variant={isDeactivating ? "danger" : "primary"}
            disabled={mutation.isPending}
            loading={mutation.isPending}
            onClick={async () => {
              try {
                await mutation.mutateAsync({
                  isActive: !type.isActive,
                  expectedVersion: type.version,
                });
                showToast(F5.saved, "success");
                onClose();
              } catch {
                /* Backend error */
              }
            }}
            className={cn(
              "h-9 px-4 text-xs font-semibold",
              isDeactivating && "bg-red-600 hover:bg-red-700 text-white",
            )}
          >
            {isDeactivating ? F5.deactivateConfirm : F5.activate}
          </Button>
        </div>
      </div>
    </ManagementDialog>
  );
}
