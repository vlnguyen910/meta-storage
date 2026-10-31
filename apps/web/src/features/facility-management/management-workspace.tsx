"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  type ApiFacility,
  type ApiFacilityAssignment,
  type CreateAssignmentBody,
  type CreateFacilityBody,
  type CreateUnitTypeInput,
  CreateUnitTypeSchema,
  createAssignmentBodySchema,
  createFacilityBodySchema,
  type FacilityUnitTypeDto,
} from "@metastorage/contracts";
import { formatReference } from "@metastorage/shared";
import { Layers, Pencil, Plus, Search, UserMinus, UserPlus, Warehouse } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { useAuthStore } from "@/features/auth/auth-store";
import { cn } from "@/lib/utils";
import {
  managementError,
  useAllFacilities,
  useAssignableAccounts,
  useAssignMember,
  useCreateFacility,
  useCreateType,
  useFacilityOptions,
  useManagedTypes,
  useMemberships,
  useRevokeMember,
  useUpdateFacility,
  useUpdateType,
} from "./hooks";
import { F5 } from "./management.messages";
import type { FacilityPanelProps, ManagementWorkspaceProps } from "./management.types";
import { ManagementDialog, ManagementField, textareaClass } from "./management-ui";
import { InventoryPanel } from "./unit-inventory";

const tabLabels = {
  facilities: F5.facilities,
  types: F5.types,
  offerings: F5.offerings,
  memberships: F5.memberships,
  units: F5.inventory,
};

const PAGE_SIZE = 8;

export function FacilityManagementWorkspace({ membershipsOnly = false }: ManagementWorkspaceProps) {
  const scope = useFacilityOptions(true);
  const [tab, setTab] = useState<keyof typeof tabLabels>(
    membershipsOnly ? "memberships" : "facilities",
  );
  const [creatingFacility, setCreatingFacility] = useState(false);

  if (isMockMode) return <p role="status">{F5.noMock}</p>;
  if (scope.query.isPending) return <LoadingState variant="table" />;
  if (scope.query.isError) {
    return <ErrorState message={F5.loadError} onRetry={() => scope.query.refetch()} />;
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden min-h-0 gap-3.5">
      {/* Header & Tabs cố định */}
      <div className="shrink-0 flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              {membershipsOnly ? F5.memberships : F5.administration}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Hệ thống quản lý dữ liệu danh mục cơ sở, ô kho và phân quyền vận hành
            </p>
          </div>
        </div>

        {!membershipsOnly && (
          <nav
            aria-label={F5.title}
            className="flex flex-wrap gap-1 p-1 bg-slate-100/90 rounded-xl w-fit border border-slate-200/80"
          >
            {(Object.keys(tabLabels) as Array<keyof typeof tabLabels>).map((value) => {
              const active = tab === value;
              return (
                <button
                  type="button"
                  key={value}
                  aria-pressed={active}
                  onClick={() => setTab(value)}
                  className={cn(
                    "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-150",
                    active
                      ? "bg-white text-primary shadow-xs font-extrabold"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/50",
                  )}
                >
                  {tabLabels[value]}
                </button>
              );
            })}
          </nav>
        )}
      </div>

      {/* Vùng nội dung Tab chính (Chiếm trọn không gian, không scroll ngoài) */}
      <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
        {tab === "facilities" && (
          <FacilityListTable
            onSelectFacility={(id) => {
              scope.select(id);
              setTab("offerings");
            }}
            selectedFacilityId={scope.facilityId}
            onOpenCreate={() => setCreatingFacility(true)}
          />
        )}

        {tab === "types" && <TypeCatalogTable />}

        {tab === "offerings" && (
          <FacilityOfferingsTable
            facilityId={scope.facilityId}
            facilityOptions={scope.query.data}
            onSelectFacility={scope.select}
          />
        )}

        {tab === "memberships" && (
          <FacilityMembershipsTable
            facilityId={scope.facilityId}
            facilityOptions={scope.query.data}
            onSelectFacility={scope.select}
          />
        )}

        {tab === "units" && (
          <div className="flex flex-col h-full w-full overflow-hidden min-h-0">
            <InventoryPanel
              key={scope.facilityId}
              facilityId={scope.facilityId}
              facilityOptions={scope.query.data}
              onSelectFacility={scope.select}
              canEdit={false}
            />
          </div>
        )}
      </div>

      {creatingFacility && (
        <FacilityEditor
          onClose={() => setCreatingFacility(false)}
          onSaved={(facility) => {
            scope.select(facility.id);
            setCreatingFacility(false);
          }}
        />
      )}
    </div>
  );
}

/* =========================================================================
   TAB 1: DANH SÁCH CƠ SỞ (Facility Table có Paging & Filter)
   ========================================================================= */
function FacilityListTable({
  onSelectFacility,
  onOpenCreate,
}: {
  onSelectFacility: (id: string) => void;
  selectedFacilityId?: string;
  onOpenCreate: () => void;
}) {
  const query = useAllFacilities();
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [editingFacility, setEditingFacility] = useState<ApiFacility | null>(null);

  const items = query.data ?? [];

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      const matchQuery =
        !q ||
        item.code.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.address.toLowerCase().includes(q);
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
      <div className="shrink-0 flex flex-wrap items-center gap-3 p-3 bg-white border border-slate-200/90 rounded-xl shadow-xs">
        <form
          onSubmit={handleSearchSubmit}
          className="flex items-center gap-2 flex-1 min-w-[280px]"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={F5.searchFacility}
              className="pl-9 h-10 min-h-10 text-sm bg-slate-50/50 border-slate-200 focus:bg-white"
            />
          </div>
          <Button
            type="submit"
            variant="outline"
            className="h-10 px-3 text-xs font-semibold gap-1.5 shrink-0 border-slate-200"
          >
            <Search className="size-3.5" />
            <span>Tìm kiếm</span>
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

        <Button
          type="button"
          variant="primary"
          onClick={onOpenCreate}
          className="h-10 px-3.5 text-xs font-semibold gap-1.5 shadow-xs shrink-0"
        >
          <Plus className="size-3.5" />
          <span>{F5.newFacility}</span>
        </Button>
      </div>

      {/* Table container (Scrollable with sticky header) */}
      <div className="flex-1 overflow-y-auto min-h-0 border border-slate-200/90 rounded-xl bg-white shadow-xs">
        <Table>
          <TableHeader className="sticky top-0 bg-slate-50/95 backdrop-blur-xs z-10 border-b border-slate-200">
            <TableRow>
              <TableHead className="w-28">{F5.code}</TableHead>
              <TableHead className="w-56">{F5.name}</TableHead>
              <TableHead>{F5.address}</TableHead>
              <TableHead className="hidden lg:table-cell max-w-xs">{F5.descriptionLabel}</TableHead>
              <TableHead className="w-32">{F5.status}</TableHead>
              <TableHead className="w-48 text-right">{F5.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-slate-500">
                  {F5.empty}
                </TableCell>
              </TableRow>
            ) : (
              pagedItems.map((facility) => (
                <TableRow key={facility.id} className="hover:bg-slate-50/70 transition-colors">
                  <TableCell className="font-mono font-bold text-xs">
                    <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md border border-slate-200/80">
                      {facility.code}
                    </span>
                  </TableCell>
                  <TableCell className="font-bold text-slate-900">
                    <div className="flex items-center gap-2">
                      <Warehouse className="size-4 text-primary shrink-0" />
                      <span>{facility.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs sm:text-sm text-slate-600">
                    {facility.address}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-xs text-slate-500 truncate max-w-xs">
                    {facility.description || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        facility.isActive
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-100 text-slate-500 border-slate-200"
                      }
                    >
                      {facility.isActive ? F5.active : F5.inactive}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setEditingFacility(facility)}
                        className="h-8 min-h-8 px-2.5 text-xs gap-1 border-slate-200 text-slate-700 hover:text-primary"
                      >
                        <Pencil className="size-3.5" />
                        <span>{F5.edit}</span>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => onSelectFacility(facility.id)}
                        className="h-8 min-h-8 px-2.5 text-xs border-slate-200 text-slate-700 hover:text-primary"
                      >
                        <span>Quản lý</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination footer */}
      <PaginationFooter
        total={totalItems}
        page={currentPage}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        unitLabel="cơ sở"
      />

      {editingFacility && (
        <FacilityEditor
          facility={editingFacility}
          onClose={() => setEditingFacility(null)}
          onSaved={() => {
            setEditingFacility(null);
            void query.refetch();
          }}
        />
      )}
    </div>
  );
}

/* =========================================================================
   TAB 2: DANH MỤC LOẠI KHO (Type Catalog Table có Paging & Filter)
   ========================================================================= */
export function TypeCatalogTable({ facilityId }: { facilityId?: string } = {}) {
  const canEdit = useAuthStore((state) => state.session?.user.role === "FACILITY_MANAGER");
  const query = useManagedTypes(facilityId);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<FacilityUnitTypeDto | "new" | null>(null);
  const [toggling, setToggling] = useState<FacilityUnitTypeDto | null>(null);

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
        <form
          onSubmit={handleSearchSubmit}
          className="flex items-center gap-2 flex-1 min-w-[280px]"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
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
            <span>Tìm kiếm</span>
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
          <TableHeader className="sticky top-0 bg-slate-50/95 backdrop-blur-xs z-10 border-b border-slate-200">
            <TableRow>
              <TableHead className="w-28">{F5.code}</TableHead>
              <TableHead className="w-64">{F5.name}</TableHead>
              <TableHead className="w-32">{F5.sizeLabel}</TableHead>
              <TableHead>{F5.dimensions}</TableHead>
              <TableHead className="w-32">{F5.status}</TableHead>
              <TableHead className="w-48 text-right">{F5.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-slate-500">
                  {F5.empty}
                </TableCell>
              </TableRow>
            ) : (
              pagedItems.map((item) => (
                <TableRow key={item.id} className="hover:bg-slate-50/70 transition-colors">
                  <TableCell className="font-mono font-bold text-xs">
                    <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md border border-slate-200/80">
                      {item.code}
                    </span>
                  </TableCell>
                  <TableCell className="font-bold text-slate-900">
                    <div className="flex items-center gap-2">
                      <Layers className="size-4 text-primary shrink-0" />
                      <span>{item.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className="bg-purple-50 text-purple-700 border-purple-200">
                      {item.sizeLabel}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-600 font-medium text-xs sm:text-sm">
                    {item.lengthM} × {item.widthM} × {item.heightM} m
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        item.isActive
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-100 text-slate-500 border-slate-200"
                      }
                    >
                      {item.isActive ? F5.active : F5.inactive}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {canEdit ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setEditing(item)}
                          className="h-8 min-h-8 px-2.5 text-xs gap-1 border-slate-200 text-slate-700 hover:text-primary"
                        >
                          <Pencil className="size-3.5" />
                          <span>{F5.edit}</span>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setToggling(item)}
                          className={cn(
                            "h-8 min-h-8 px-2.5 text-xs border-slate-200",
                            item.isActive
                              ? "text-amber-700 hover:bg-amber-50"
                              : "text-emerald-700 hover:bg-emerald-50",
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
      <PaginationFooter
        total={totalItems}
        page={currentPage}
        totalPages={totalPages}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />

      {canEdit && editing && (
        <TypeEditor
          type={editing === "new" ? undefined : editing}
          facilityId={facilityId}
          onClose={() => setEditing(null)}
        />
      )}
      {canEdit && toggling && (
        <TypeStatusEditor type={toggling} onClose={() => setToggling(null)} />
      )}
    </div>
  );
}

/* =========================================================================
   TAB 3: LOẠI KHO TẠI CƠ SỞ (Offerings Table có Paging & Filter)
   ========================================================================= */
function FacilityOfferingsTable({
  facilityId,
  facilityOptions,
  onSelectFacility,
}: {
  facilityId: string;
  facilityOptions: Array<{ id: string; name: string; code: string }>;
  onSelectFacility: (id: string) => void;
}) {
  const types = useManagedTypes(facilityId);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [offeringFilter, setOfferingFilter] = useState("ALL");
  const [page, setPage] = useState(1);

  const typesList = types.data ?? [];

  const combinedItems = useMemo(() => {
    return typesList.map((type) => {
      const active = type.isActive;
      return { type, active };
    });
  }, [typesList]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return combinedItems.filter(({ type, active }) => {
      const matchQuery =
        !q ||
        type.code.toLowerCase().includes(q) ||
        type.name.toLowerCase().includes(q) ||
        type.sizeLabel.toLowerCase().includes(q);
      const matchFilter =
        offeringFilter === "ALL" ||
        (offeringFilter === "ENABLED" && active) ||
        (offeringFilter === "DISABLED" && !active);
      return matchQuery && matchFilter;
    });
  }, [combinedItems, searchQuery, offeringFilter]);

  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, page), totalPages);

  const pagedItems = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  if (types.isPending) return <LoadingState variant="table" />;
  if (types.isError) {
    return (
      <ErrorState
        message={F5.loadError}
        onRetry={() => {
          void types.refetch();
        }}
      />
    );
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSearchQuery(searchInput);
    setPage(1);
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden min-h-0 gap-3">
      {/* Scope facility selector & Filter bar */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 p-3 bg-white border border-slate-200/90 rounded-xl shadow-xs">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          <div className="w-full sm:w-64">
            <DropdownSelect
              value={facilityId}
              onChange={(val) => onSelectFacility(val)}
              className="w-full"
              triggerClassName="h-10 min-h-10 w-full text-sm bg-slate-50/50 border-slate-200 font-semibold text-slate-800"
              options={facilityOptions.map((opt) => ({
                value: opt.id,
                label: `${opt.code} · ${opt.name}`,
              }))}
              maxVisibleItems={6}
            />
          </div>

          <form
            onSubmit={handleSearchSubmit}
            className="flex items-center gap-2 flex-1 min-w-[220px]"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={F5.searchOffering}
                className="pl-9 h-10 min-h-10 text-sm bg-slate-50/50 border-slate-200 focus:bg-white"
              />
            </div>
            <Button
              type="submit"
              variant="outline"
              className="h-10 px-3 text-xs font-semibold gap-1.5 shrink-0 border-slate-200"
            >
              <Search className="size-3.5" />
              <span>Tìm kiếm</span>
            </Button>
          </form>

          <div className="w-full sm:w-44 shrink-0">
            <DropdownSelect
              value={offeringFilter}
              onChange={(val) => {
                setOfferingFilter(val);
                setPage(1);
              }}
              className="w-full"
              triggerClassName="h-10 min-h-10 w-full text-sm bg-slate-50/50 border-slate-200 focus:bg-white"
              options={[
                { value: "ALL", label: F5.allOfferings },
                { value: "ENABLED", label: F5.enabled },
                { value: "DISABLED", label: F5.disabled },
              ]}
              maxVisibleItems={6}
            />
          </div>
        </div>
      </div>

      {/* Table container */}
      <div className="flex-1 overflow-y-auto min-h-0 border border-slate-200/90 rounded-xl bg-white shadow-xs">
        <Table>
          <TableHeader className="sticky top-0 bg-slate-50/95 backdrop-blur-xs z-10 border-b border-slate-200">
            <TableRow>
              <TableHead className="w-28">{F5.code}</TableHead>
              <TableHead className="w-64">{F5.name}</TableHead>
              <TableHead className="w-32">{F5.sizeLabel}</TableHead>
              <TableHead className="w-40">{F5.baseStatus}</TableHead>
              <TableHead className="w-44">{F5.offeringStatus}</TableHead>
              <TableHead className="w-36 text-right">{F5.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-slate-500">
                  {F5.empty}
                </TableCell>
              </TableRow>
            ) : (
              pagedItems.map(({ type, active }) => (
                <TableRow key={type.id} className="hover:bg-slate-50/70 transition-colors">
                  <TableCell className="font-mono font-bold text-xs">
                    <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md border border-slate-200/80">
                      {type.code}
                    </span>
                  </TableCell>
                  <TableCell className="font-bold text-slate-900">
                    <div className="flex items-center gap-2">
                      <Layers className="size-4 text-primary shrink-0" />
                      <span>{type.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className="bg-purple-50 text-purple-700 border-purple-200">
                      {type.sizeLabel}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        type.isActive
                          ? "bg-slate-100 text-slate-700 border-slate-200"
                          : "bg-slate-100 text-slate-400 border-slate-200"
                      }
                    >
                      {type.isActive ? F5.active : F5.inactive}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        active
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 font-bold"
                          : "bg-slate-100 text-slate-500 border-slate-200"
                      }
                    >
                      {active ? F5.enabled : F5.disabled}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-xs text-muted">{F5.readOnly}</span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination footer */}
      <PaginationFooter
        total={totalItems}
        page={currentPage}
        totalPages={totalPages}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />
    </div>
  );
}

/* =========================================================================
   TAB 4: PHÂN CÔNG NHÂN SỰ (Memberships Table có Paging & Filter)
   ========================================================================= */
function FacilityMembershipsTable({
  facilityId,
  facilityOptions,
  onSelectFacility,
}: {
  facilityId: string;
  facilityOptions: Array<{ id: string; name: string; code: string }>;
  onSelectFacility: (id: string) => void;
}) {
  const query = useMemberships(facilityId);
  const isAdmin = useAuthStore((state) => state.session?.user.role === "SYSTEM_ADMIN");
  const accounts = useAssignableAccounts(isAdmin);
  const assign = useAssignMember(facilityId);
  const [revoking, setRevoking] = useState<ApiFacilityAssignment | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);

  const form = useForm<CreateAssignmentBody>({
    resolver: zodResolver(createAssignmentBodySchema),
    defaultValues: { userId: "", role: "FACILITY_STAFF" },
  });
  const role = form.watch("role");

  const items = query.data ?? [];

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      const name = (item.userName ?? item.userId).toLowerCase();
      const email = (item.userEmail ?? "").toLowerCase();
      const matchQuery =
        !q || name.includes(q) || email.includes(q) || item.userId.toLowerCase().includes(q);
      const matchRole = roleFilter === "ALL" || item.role === roleFilter;
      const matchStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && item.isActive) ||
        (statusFilter === "INACTIVE" && !item.isActive);
      return matchQuery && matchRole && matchStatus;
    });
  }, [items, searchQuery, roleFilter, statusFilter]);

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
      {/* Scope facility selector & Filter bar */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 p-3 bg-white border border-slate-200/90 rounded-xl shadow-xs">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          <div className="w-full sm:w-64">
            <DropdownSelect
              value={facilityId}
              onChange={(val) => onSelectFacility(val)}
              className="w-full"
              triggerClassName="h-10 min-h-10 w-full text-sm bg-slate-50/50 border-slate-200 font-semibold text-slate-800"
              options={facilityOptions.map((opt) => ({
                value: opt.id,
                label: `${opt.code} · ${opt.name}`,
              }))}
              maxVisibleItems={6}
            />
          </div>

          <form
            onSubmit={handleSearchSubmit}
            className="flex items-center gap-2 flex-1 min-w-[220px]"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={F5.searchMember}
                className="pl-9 h-10 min-h-10 text-sm bg-slate-50/50 border-slate-200 focus:bg-white"
              />
            </div>
            <Button
              type="submit"
              variant="outline"
              className="h-10 px-3 text-xs font-semibold gap-1.5 shrink-0 border-slate-200"
            >
              <Search className="size-3.5" />
              <span>Tìm kiếm</span>
            </Button>
          </form>

          <div className="w-full sm:w-44 shrink-0">
            <DropdownSelect
              value={roleFilter}
              onChange={(val) => {
                setRoleFilter(val);
                setPage(1);
              }}
              className="w-full"
              triggerClassName="h-10 min-h-10 w-full text-sm bg-slate-50/50 border-slate-200 focus:bg-white"
              options={[
                { value: "ALL", label: F5.allRoles },
                { value: "FACILITY_MANAGER", label: F5.manager },
                { value: "FACILITY_STAFF", label: F5.employee },
              ]}
              maxVisibleItems={6}
            />
          </div>

          <div className="w-full sm:w-40 shrink-0">
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
        </div>

        <Button
          type="button"
          variant="primary"
          onClick={() => setAssignDialogOpen(true)}
          className="h-10 px-4 text-xs font-semibold gap-2 shadow-xs shrink-0"
        >
          <UserPlus className="size-4" />
          <span>{F5.addStaff}</span>
        </Button>
      </div>

      {/* Table container */}
      <div className="flex-1 overflow-y-auto min-h-0 border border-slate-200/90 rounded-xl bg-white shadow-xs">
        <Table>
          <TableHeader className="sticky top-0 bg-slate-50/95 backdrop-blur-xs z-10 border-b border-slate-200">
            <TableRow>
              <TableHead>{F5.user}</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="w-44">{F5.role}</TableHead>
              <TableHead className="w-32">{F5.status}</TableHead>
              <TableHead className="w-40 text-right">{F5.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-slate-500">
                  {F5.empty}
                </TableCell>
              </TableRow>
            ) : (
              pagedItems.map((item) => {
                const isManager = item.role === "FACILITY_MANAGER";
                return (
                  <TableRow key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8 bg-slate-100 border border-slate-200">
                          <AvatarFallback className="text-xs font-bold text-slate-700">
                            {(item.userName ?? item.userId).slice(0, 1).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <strong className="block text-sm text-slate-900">
                            {item.userName ?? formatReference(item.userId, "NV")}
                          </strong>
                          <small className="text-xs text-slate-400 font-mono">
                            {item.userId.slice(0, 8)}
                          </small>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-600 text-xs sm:text-sm font-medium">
                      {item.userEmail || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          isManager
                            ? "bg-purple-50 text-purple-700 border-purple-200 font-bold"
                            : "bg-blue-50 text-blue-700 border-blue-200"
                        }
                      >
                        {isManager ? F5.manager : F5.employee}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          item.isActive
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-500 border-slate-200"
                        }
                      >
                        {item.isActive ? F5.active : F5.inactive}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {item.isActive ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setRevoking(item)}
                          className="h-8 min-h-8 px-2.5 text-xs text-danger hover:bg-red-50 border-slate-200 gap-1.5"
                        >
                          <UserMinus className="size-3.5" />
                          <span>{F5.revoke}</span>
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Đã kết thúc</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination footer */}
      <PaginationFooter
        total={totalItems}
        page={currentPage}
        totalPages={totalPages}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />

      {/* Dialog gán nhân sự mới */}
      {assignDialogOpen && (
        <ManagementDialog
          title={F5.assignPerson}
          onClose={() => setAssignDialogOpen(false)}
          pending={assign.isPending}
        >
          <form
            noValidate
            className="grid gap-4"
            onSubmit={form.handleSubmit(async (input) => {
              try {
                await assign.mutateAsync(input);
                form.reset({ userId: "", role: input.role });
                setAssignDialogOpen(false);
              } catch {
                /* Backend guard error */
              }
            })}
          >
            <ManagementField label={F5.role} error={form.formState.errors.role?.message}>
              <Select {...form.register("role", { onChange: () => form.setValue("userId", "") })}>
                <option value="FACILITY_STAFF">{F5.employee}</option>
                <option value="FACILITY_MANAGER">{F5.manager}</option>
              </Select>
            </ManagementField>

            <ManagementField
              label={isAdmin ? F5.user : F5.userId}
              error={form.formState.errors.userId?.message}
            >
              {isAdmin ? (
                <Select {...form.register("userId")}>
                  <option value="">{F5.choose}</option>
                  {accounts.data
                    ?.filter((item) => item.status === "ACTIVE" && item.role === role)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} · {item.email}
                      </option>
                    ))}
                </Select>
              ) : (
                <Input
                  {...form.register("userId")}
                  placeholder="Nhập UUID tài khoản nhân viên..."
                />
              )}
            </ManagementField>

            {!isAdmin && <p className="text-xs text-slate-500">{F5.bomUserHint}</p>}

            {assign.isError && (
              <p role="alert" className="text-xs font-semibold text-danger">
                {managementError(assign.error)}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 mt-2">
              <Button type="button" variant="outline" onClick={() => setAssignDialogOpen(false)}>
                {F5.cancel}
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={assign.isPending || (isAdmin && (accounts.isPending || accounts.isError))}
                loading={assign.isPending}
              >
                {F5.save}
              </Button>
            </div>
          </form>
        </ManagementDialog>
      )}

      {revoking && (
        <MembershipRevoke
          facilityId={facilityId}
          assignment={revoking}
          onClose={() => setRevoking(null)}
        />
      )}
    </div>
  );
}

/* =========================================================================
   COMPONENTS: DIALOGS & EDITORS
   ========================================================================= */
function FacilityEditor({
  facility,
  onClose,
  onSaved,
}: {
  facility?: ApiFacility;
  onClose: () => void;
  onSaved: (facility: ApiFacility) => void;
}) {
  const create = useCreateFacility();
  const update = useUpdateFacility(facility?.id ?? "");
  const mutation = facility ? update : create;
  const form = useForm<
    Omit<CreateFacilityBody, "isActive"> & { isActive?: boolean },
    unknown,
    CreateFacilityBody
  >({
    resolver: zodResolver(createFacilityBodySchema),
    defaultValues: {
      code: facility?.code ?? "",
      name: facility?.name ?? "",
      address: facility?.address ?? "",
      description: facility?.description ?? "",
      isActive: facility?.isActive ?? true,
    },
  });

  return (
    <ManagementDialog
      title={facility ? F5.editFacility : F5.newFacility}
      onClose={onClose}
      pending={mutation.isPending}
    >
      <form
        noValidate
        className="grid gap-4"
        onSubmit={form.handleSubmit(async (input) => {
          try {
            onSaved(facility ? await update.mutateAsync(input) : await create.mutateAsync(input));
          } catch {
            /* Backend validation errors */
          }
        })}
      >
        <ManagementField label={F5.code} error={form.formState.errors.code?.message}>
          <Input {...form.register("code")} placeholder="Ví dụ: HCM-10" />
        </ManagementField>
        <ManagementField label={F5.name} error={form.formState.errors.name?.message}>
          <Input {...form.register("name")} placeholder="Tên cơ sở kho..." />
        </ManagementField>
        <ManagementField label={F5.address} error={form.formState.errors.address?.message}>
          <Input {...form.register("address")} placeholder="Địa chỉ chi tiết..." />
        </ManagementField>
        <ManagementField
          label={F5.descriptionLabel}
          error={form.formState.errors.description?.message}
        >
          <textarea
            className={textareaClass}
            {...form.register("description")}
            placeholder="Mô tả đặc điểm, vị trí..."
          />
        </ManagementField>
        <label className="flex min-h-11 items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="size-4 rounded text-primary"
            {...form.register("isActive")}
          />
          <span className="text-sm font-semibold">{F5.active}</span>
        </label>
        {mutation.isError && (
          <p role="alert" className="text-xs font-semibold text-danger">
            {managementError(mutation.error)}
          </p>
        )}
        <div className="flex items-center justify-end gap-2 mt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {F5.cancel}
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={mutation.isPending}
            loading={mutation.isPending}
          >
            {F5.save}
          </Button>
        </div>
      </form>
    </ManagementDialog>
  );
}

function TypeEditor({
  type,
  facilityId,
  onClose,
}: {
  type?: FacilityUnitTypeDto;
  facilityId?: string;
  onClose: () => void;
}) {
  const create = useCreateType();
  const update = useUpdateType(type?.id ?? "");
  const mutation = type ? update : create;
  const form = useForm<CreateUnitTypeInput>({
    resolver: zodResolver(CreateUnitTypeSchema),
    defaultValues: {
      facilityId: type?.facilityId ?? facilityId ?? "",

      code: type?.code ?? "",
      name: type?.name ?? "",
      sizeLabel: type?.sizeLabel ?? "",
      lengthM: type?.lengthM,
      widthM: type?.widthM,
      heightM: type?.heightM,
      monthlyPrice: type?.monthlyPrice,
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
              const { facilityId: _facility, ...metadata } = input;
              await update.mutateAsync({ ...metadata, expectedVersion: type.version });
            } else {
              await create.mutateAsync(input);
            }
            onClose();
          } catch {
            /* Backend validation errors */
          }
        })}
      >
        <ManagementField label={F5.code} error={form.formState.errors.code?.message}>
          <Input {...form.register("code")} placeholder="Ví dụ: UT-10M" />
        </ManagementField>
        <ManagementField label={F5.name} error={form.formState.errors.name?.message}>
          <Input {...form.register("name")} placeholder="Ví dụ: Kho tiêu chuẩn (10 m²)" />
        </ManagementField>
        <ManagementField label={F5.sizeLabel} error={form.formState.errors.sizeLabel?.message}>
          <Input {...form.register("sizeLabel")} placeholder="Ví dụ: 10 m²" />
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
              />
            </ManagementField>
          ))}
        </div>
        <ManagementField
          label={F5.initialPrice}
          error={form.formState.errors.monthlyPrice?.message}
        >
          <Input
            type="number"
            min="0"
            step="1"
            placeholder="VND / tháng"
            {...form.register("monthlyPrice", { valueAsNumber: true })}
          />
        </ManagementField>
        {mutation.isError && (
          <p role="alert" className="text-xs font-semibold text-danger">
            {managementError(mutation.error)}
          </p>
        )}
        <div className="flex items-center justify-end gap-2 mt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {F5.cancel}
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={mutation.isPending}
            loading={mutation.isPending}
          >
            {F5.save}
          </Button>
        </div>
      </form>
    </ManagementDialog>
  );
}

function TypeStatusEditor({ type, onClose }: { type: FacilityUnitTypeDto; onClose: () => void }) {
  const mutation = useUpdateType(type.id);
  return (
    <ManagementDialog
      title={F5.confirmType(type.name)}
      onClose={onClose}
      pending={mutation.isPending}
    >
      <div className="grid gap-4">
        <p className="text-sm text-slate-600">
          Bạn có chắc chắn muốn {type.isActive ? "ngừng cung cấp" : "kích hoạt lại"} loại kho này
          trong hệ thống?
        </p>
        {mutation.isError && (
          <p role="alert" className="text-xs font-semibold text-danger">
            {managementError(mutation.error)}
          </p>
        )}
        <div className="flex items-center justify-end gap-2 mt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {F5.cancel}
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={mutation.isPending}
            loading={mutation.isPending}
            onClick={async () => {
              try {
                await mutation.mutateAsync({
                  isActive: !type.isActive,
                  expectedVersion: type.version,
                });
                onClose();
              } catch {
                /* Backend error */
              }
            }}
          >
            {type.isActive ? F5.deactivate : F5.activate}
          </Button>
        </div>
      </div>
    </ManagementDialog>
  );
}

function MembershipRevoke({
  facilityId,
  assignment,
  onClose,
}: FacilityPanelProps & { assignment: ApiFacilityAssignment; onClose: () => void }) {
  const mutation = useRevokeMember(facilityId);
  return (
    <ManagementDialog
      pending={mutation.isPending}
      title={F5.confirmRevoke(assignment.userName ?? formatReference(assignment.userId, "NV"))}
      onClose={onClose}
    >
      <div className="grid gap-4">
        <p className="text-sm text-slate-600">{F5.revokeHint}</p>
        {mutation.isError && (
          <p role="alert" className="text-xs font-semibold text-danger">
            {managementError(mutation.error)}
          </p>
        )}
        <div className="flex items-center justify-end gap-2 mt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {F5.cancel}
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={mutation.isPending}
            loading={mutation.isPending}
            onClick={async () => {
              try {
                await mutation.mutateAsync(assignment.userId);
                onClose();
              } catch {
                /* Conflict error */
              }
            }}
          >
            {F5.revoke}
          </Button>
        </div>
      </div>
    </ManagementDialog>
  );
}

/* =========================================================================
   COMPONENTS: REUSABLE PAGINATION FOOTER
   ========================================================================= */
function PaginationFooter({
  total,
  page,
  pageSize,
  onPageChange,
  unitLabel = "bản ghi",
}: {
  total: number;
  page: number;
  totalPages?: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  unitLabel?: string;
}) {
  return (
    <ListPagination
      label={F5.title}
      page={page}
      pageSize={pageSize}
      total={total}
      onPageChange={onPageChange}
      unitLabel={unitLabel}
    />
  );
}
