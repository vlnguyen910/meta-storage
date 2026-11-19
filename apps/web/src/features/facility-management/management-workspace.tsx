"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  type ApiFacility,
  type ApiFacilityAssignment,
  type CreateAssignmentBody,
  type CreateFacilityBody,
  type CreateFacilityUnitType,
  CreateFacilityUnitTypeSchema,
  createAssignmentBodySchema,
  createFacilityBodySchema,
  type FacilityUnitTypeDto,
} from "@metastorage/contracts";
import { formatReference } from "@metastorage/shared";
import { Layers, Pencil, Plus, Search, UserMinus, UserPlus, Warehouse } from "lucide-react";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { Input, VndInput } from "@/components/ui/form-controls";
import { ListPagination } from "@/components/ui/list-pagination";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { isMockMode } from "@/config/api-mode";
import { useAuthStore } from "@/features/auth/auth-store";
import { formatCurrency } from "@/lib/format";
import { CoverImageField } from "./cover-image-field";
import {
  managementError,
  useAllFacilities,
  useAssignableAccounts,
  useAssignMember,
  useCreateFacility,
  useCreateOffering,
  useFacilityOfferings,
  useFacilityOptions,
  useManagedTypes,
  useMemberships,
  useRevokeMember,
  useUpdateFacility,
  useUpdateOffering,
} from "./hooks";
import { F5 } from "./management.messages";
import type { FacilityPanelProps, ManagementWorkspaceProps } from "./management.types";
import { ManagementDialog, ManagementField, textareaClass } from "./management-ui";

const PAGE_SIZE = 6;

export function FacilityManagementWorkspace({ membershipsOnly = false }: ManagementWorkspaceProps) {
  const scope = useFacilityOptions(true);
  const [creatingFacility, setCreatingFacility] = useState(false);

  if (isMockMode) return <p role="status">{F5.noMock}</p>;
  if (scope.query.isPending) return <LoadingState variant="table" />;
  if (scope.query.isError) {
    return <ErrorState message={F5.loadError} onRetry={() => scope.query.refetch()} />;
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden min-h-0 gap-3.5">
      {/* Header cố định */}
      <div className="shrink-0 flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              {membershipsOnly ? F5.memberships : F5.administration}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {membershipsOnly
                ? "Hệ thống quản lý phân quyền nhân sự vận hành theo cơ sở"
                : "Hệ thống quản lý dữ liệu danh mục cơ sở thuộc hệ thống"}
            </p>
          </div>
        </div>
      </div>

      {/* Vùng nội dung chính (Chiếm trọn không gian, không scroll ngoài) */}
      <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
        {membershipsOnly ? (
          <FacilityMembershipsTable
            facilityId={scope.facilityId}
            facilityOptions={scope.query.data}
            onSelectFacility={scope.select}
          />
        ) : (
          <FacilityListTable onOpenCreate={() => setCreatingFacility(true)} />
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
function FacilityListTable({ onOpenCreate }: { onOpenCreate: () => void }) {
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
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 min-w-0">
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
   TAB 3: LOẠI KHO TẠI CƠ SỞ (Offerings Table có Paging & Filter)
   ========================================================================= */
export function FacilityOfferingsTable({
  facilityId,
  facilityOptions,
  onSelectFacility,
}: {
  facilityId: string;
  facilityOptions?: Array<{ id: string; name: string; code: string }>;
  onSelectFacility?: (id: string) => void;
}) {
  const types = useFacilityOfferings(facilityId);
  const canEdit = useAuthStore((state) => state.session?.user.role === "FACILITY_MANAGER");
  const [editing, setEditing] = useState<FacilityUnitTypeDto | "new" | null>(null);
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
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
          {facilityOptions && onSelectFacility && (
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
          )}

          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 min-w-0">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                aria-label={F5.searchOffering}
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
              <span>{F5.search}</span>
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
        {canEdit && (
          <Button type="button" onClick={() => setEditing("new")} disabled={!facilityId}>
            {F5.addOffering}
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
              <TableHead className="w-40">{F5.pricePerMonth}</TableHead>
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
                  <TableCell>{formatCurrency(type.monthlyPrice)}</TableCell>
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
                    {canEdit ? (
                      <Button type="button" variant="outline" onClick={() => setEditing(type)}>
                        {F5.edit}
                      </Button>
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

      {editing && canEdit && (
        <OfferingEditor
          key={`${facilityId}-${editing === "new" ? "new" : editing.id}`}
          facilityId={facilityId}
          offering={editing === "new" ? undefined : editing}
          offerings={typesList}
          onClose={() => setEditing(null)}
        />
      )}
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
  const { showToast } = useToast();
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
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
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

          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 min-w-0">
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
              <span>{F5.search}</span>
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
                showToast(F5.saved, "success");
                form.reset({ userId: "", role: input.role });
                setAssignDialogOpen(false);
              } catch {
                /* Backend guard error */
              }
            })}
          >
            <ManagementField label={F5.role} error={form.formState.errors.role?.message}>
              <DropdownSelect
                value={form.watch("role")}
                onChange={(val) => {
                  form.setValue("role", val as "FACILITY_STAFF" | "FACILITY_MANAGER", {
                    shouldValidate: true,
                  });
                  form.setValue("userId", "");
                }}
                options={[
                  { value: "FACILITY_STAFF", label: F5.employee },
                  { value: "FACILITY_MANAGER", label: F5.manager },
                ]}
                ariaLabel={F5.role}
                className="w-full"
                triggerClassName="h-10 min-h-10 w-full bg-slate-50/50 border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
              />
            </ManagementField>

            <ManagementField
              label={isAdmin ? F5.user : F5.userId}
              error={form.formState.errors.userId?.message}
            >
              {isAdmin ? (
                <DropdownSelect
                  value={form.watch("userId")}
                  onChange={(val) => form.setValue("userId", val, { shouldValidate: true })}
                  placeholder={F5.choose}
                  ariaLabel={isAdmin ? F5.user : F5.userId}
                  options={
                    accounts.data
                      ?.filter((item) => item.status === "ACTIVE" && item.role === role)
                      .map((item) => ({
                        value: item.id,
                        label: `${item.name} · ${item.email}`,
                      })) ?? []
                  }
                  className="w-full"
                  triggerClassName="h-10 min-h-10 w-full bg-slate-50/50 border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                />
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
  const { showToast } = useToast();
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
      coverUrl: facility?.coverUrl ?? "",
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
            const res = facility
              ? await update.mutateAsync(input)
              : await create.mutateAsync(input);
            showToast(F5.saved, "success");
            onSaved(res);
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
          label={F5.coverImage}
          error={form.formState.errors.coverUrl ? F5.coverImageRequired : undefined}
        >
          <CoverImageField
            id="facility-cover-url"
            value={form.watch("coverUrl")}
            onChange={(coverUrl) =>
              form.setValue("coverUrl", coverUrl, { shouldDirty: true, shouldValidate: true })
            }
          />
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
        <div className="flex min-h-11 items-center gap-3">
          <Switch
            id="facility-active"
            checked={form.watch("isActive")}
            onCheckedChange={(checked) =>
              form.setValue("isActive", checked, { shouldValidate: true, shouldDirty: true })
            }
          />
          <label
            htmlFor="facility-active"
            className="text-sm font-semibold cursor-pointer select-none"
          >
            {F5.active}
          </label>
        </div>
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

function OfferingEditor({
  facilityId,
  offering,
  offerings,
  onClose,
}: {
  facilityId: string;
  offering?: FacilityUnitTypeDto;
  offerings: FacilityUnitTypeDto[];
  onClose: () => void;
}) {
  const catalog = useManagedTypes();
  const create = useCreateOffering(facilityId);
  const update = useUpdateOffering(facilityId, offering?.id ?? "");
  const mutation = offering ? update : create;
  const { showToast } = useToast();
  const [active, setActive] = useState(offering?.isActive ?? true);
  const form = useForm<CreateFacilityUnitType>({
    resolver: zodResolver(CreateFacilityUnitTypeSchema),
    defaultValues: {
      unitTypeId: offering?.catalogUnitTypeId ?? "",
      monthlyPrice: offering?.monthlyPrice,
    },
  });
  const selectedId = form.watch("unitTypeId");
  const selected = catalog.data?.find((type) => type.id === selectedId);
  const min = offering?.minMonthlyPrice ?? selected?.minMonthlyPrice;
  const max = offering?.maxMonthlyPrice ?? selected?.maxMonthlyPrice;
  const options = (catalog.data ?? []).filter(
    (type) => type.isActive && !offerings.some((item) => item.catalogUnitTypeId === type.id),
  );
  const save = form.handleSubmit(async (input) => {
    if (
      min === undefined ||
      max === undefined ||
      input.monthlyPrice < min ||
      input.monthlyPrice > max
    ) {
      form.setError("monthlyPrice", { message: F5.invalidLocalPrice });
      return;
    }
    try {
      if (offering)
        await update.mutateAsync({
          monthlyPrice: input.monthlyPrice,
          isActive: active,
          expectedVersion: offering.version,
        });
      else await create.mutateAsync(input);
      showToast(F5.saved, "success");
      onClose();
    } catch {
      /* Show the backend conflict without losing the entered price. */
    }
  });
  return (
    <ManagementDialog
      title={offering ? F5.editOffering : F5.addOffering}
      onClose={onClose}
      pending={mutation.isPending}
    >
      {catalog.isPending ? (
        <LoadingState variant="table" />
      ) : catalog.isError ? (
        <ErrorState message={F5.loadError} onRetry={() => catalog.refetch()} />
      ) : !offering && !options.length ? (
        <p role="status" className="text-sm text-muted">
          {catalog.data?.some((type) => type.isActive) ? F5.noAvailableTypes : F5.noCatalogTypes}
        </p>
      ) : (
        <form noValidate onSubmit={save} className="grid gap-4">
          <ManagementField
            label={F5.selectCatalog}
            error={form.formState.errors.unitTypeId?.message}
          >
            <DropdownSelect
              id="offering-unit-type"
              ariaLabel={F5.selectCatalog}
              placeholder={F5.choose}
              value={form.watch("unitTypeId") || ""}
              disabled={Boolean(offering)}
              options={
                offering
                  ? [
                      {
                        value: offering.catalogUnitTypeId ?? "",
                        label: `${offering.name} · ${offering.sizeLabel}`,
                      },
                    ]
                  : options.map((type) => ({
                      value: type.id,
                      label: `${type.name} · ${type.sizeLabel}`,
                    }))
              }
              onChange={(val) =>
                form.setValue("unitTypeId", val, { shouldValidate: true, shouldDirty: true })
              }
            />
          </ManagementField>
          <p className="text-sm text-muted">{F5.catalogHint}</p>
          {min !== undefined && max !== undefined && (
            <p className="text-sm font-medium text-ink">
              {F5.priceRange}: {formatCurrency(min)} – {formatCurrency(max)}
            </p>
          )}
          <ManagementField
            label={F5.localPrice}
            error={form.formState.errors.monthlyPrice ? F5.invalidLocalPrice : undefined}
          >
            <Controller
              control={form.control}
              name="monthlyPrice"
              render={({ field }) => (
                <VndInput
                  ref={field.ref}
                  name={field.name}
                  onBlur={field.onBlur}
                  value={field.value}
                  onValueChange={(value) => field.onChange(value ?? Number.NaN)}
                />
              )}
            />
          </ManagementField>
          {offering && (
            <div className="flex min-h-11 items-center gap-3">
              <Switch id="offering-active" checked={active} onCheckedChange={setActive} />
              <label
                htmlFor="offering-active"
                className="text-sm font-medium cursor-pointer select-none"
              >
                {F5.enabled}
              </label>
            </div>
          )}
          {mutation.isError && (
            <p role="alert" className="text-sm font-medium text-danger">
              {managementError(mutation.error)}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
              {F5.cancel}
            </Button>
            <Button type="submit" disabled={mutation.isPending} loading={mutation.isPending}>
              {F5.save}
            </Button>
          </div>
        </form>
      )}
    </ManagementDialog>
  );
}

function MembershipRevoke({
  facilityId,
  assignment,
  onClose,
}: FacilityPanelProps & { assignment: ApiFacilityAssignment; onClose: () => void }) {
  const { showToast } = useToast();
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
                showToast(F5.saved, "success");
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
