"use client";

import { useQuery } from "@tanstack/react-query";
import { BarChart3, Search, TrendingUp, Warehouse } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClassName } from "@/components/ui/button";
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
import { businessOperationsRoutes as routes } from "@/config/routes";
import { useAuthStore } from "@/features/auth/auth-store";
import { cn } from "@/lib/cn";
import { loadActiveFacilities } from "../operations.data";
import { OPERATIONS_MESSAGES as M } from "../operations.messages";

export function OperationsFacilitiesRealView() {
  const actor = useAuthStore((state) => state.session?.user);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const query = useQuery({
    queryKey: ["facilities", "active-list", actor?.id, actor?.role, actor?.assignedFacilityId],
    queryFn: loadActiveFacilities,
    staleTime: 60_000,
  });

  const { data: facilities, isPending, isError, refetch } = query;

  const filtered = useMemo(() => {
    if (!facilities) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return facilities;
    return facilities.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        item.address.toLowerCase().includes(q),
    );
  }, [facilities, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  if (isPending) return <LoadingState label={M.loading} variant="table" />;
  if (isError || !facilities) {
    return <ErrorState message={M.error} onRetry={() => void refetch()} />;
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSearchQuery(searchInput);
    setPage(1);
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden min-h-0 gap-3.5">
      {/* Search & Stats Bar */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 p-3.5 bg-white border border-slate-200/90 rounded-xl shadow-2xs">
        <form
          onSubmit={handleSearchSubmit}
          className="flex items-center gap-2 flex-1 min-w-[280px]"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Tìm theo tên, mã hoặc địa chỉ cơ sở..."
              className="pl-9 h-10 min-h-10 text-sm bg-slate-50/50 border-slate-200 focus:bg-white"
            />
          </div>
          <Button
            type="submit"
            variant="outline"
            className="h-10 px-3.5 text-xs font-semibold gap-1.5 shrink-0 border-slate-200 text-slate-700 hover:text-primary hover:border-primary"
          >
            <Search className="size-3.5" />
            <span>Tìm kiếm</span>
          </Button>
        </form>

        <div className="flex items-center gap-2.5">
          <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 px-3 py-1 text-xs font-semibold">
            Cơ sở hoạt động ({facilities.length})
          </Badge>
        </div>
      </div>

      {/* Table Container (Scrollable with sticky header) */}
      <div className="flex-1 overflow-y-auto min-h-0 border border-slate-200/90 rounded-xl bg-white shadow-xs">
        <Table className="w-full">
          <TableHeader className="sticky top-0 bg-slate-50/95 backdrop-blur-xs z-10 border-b border-slate-200">
            <TableRow>
              <TableHead className="w-32 px-4 py-3">Mã cơ sở</TableHead>
              <TableHead className="w-64 px-4 py-3">Tên cơ sở</TableHead>
              <TableHead className="px-4 py-3">Địa chỉ</TableHead>
              <TableHead className="w-36 px-4 py-3">Trạng thái</TableHead>
              <TableHead className="w-64 text-right px-4 py-3">Báo cáo điều hành</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-44 text-center text-slate-500 text-sm">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Warehouse className="size-8 text-slate-300 stroke-1" />
                    <p>{M.empty}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              pageItems.map((facility) => (
                <TableRow
                  key={facility.id}
                  className="hover:bg-slate-50/70 transition-colors border-b border-slate-100 last:border-b-0"
                >
                  <TableCell className="px-4 py-3 font-mono font-bold text-xs text-primary">
                    <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md border border-slate-200/80">
                      {facility.code}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-3 font-bold text-slate-900 text-sm">
                    <div className="flex items-center gap-2">
                      <Warehouse className="size-4 text-primary shrink-0" />
                      <span>{facility.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-xs text-slate-600">
                    {facility.address}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <Badge
                      className={
                        facility.isActive
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : "bg-slate-100 text-slate-600"
                      }
                    >
                      {facility.isActive ? M.active : M.inactive}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`${routes.revenue}?facilityId=${facility.id}`}
                        aria-label={`Xem doanh thu cơ sở ${facility.name}`}
                        className={cn(
                          buttonClassName("outline"),
                          "h-8 min-h-8 px-2.5 text-xs font-semibold inline-flex items-center gap-1.5 border-slate-200 text-slate-700 hover:text-primary hover:border-primary",
                        )}
                      >
                        <TrendingUp size={13} className="text-primary" aria-hidden="true" />
                        <span>Doanh thu</span>
                      </Link>

                      <Link
                        href={`${routes.utilization}?facilityId=${facility.id}`}
                        aria-label={`Xem sử dụng kho cơ sở ${facility.name}`}
                        className={cn(
                          buttonClassName("outline"),
                          "h-8 min-h-8 px-2.5 text-xs font-semibold inline-flex items-center gap-1.5 border-slate-200 text-slate-700 hover:text-primary hover:border-primary",
                        )}
                      >
                        <BarChart3 size={13} className="text-primary" aria-hidden="true" />
                        <span>Sử dụng kho</span>
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination with Jump input and ellipsis */}
      <ListPagination
        label={M.titles.facilities}
        page={safePage}
        pageSize={pageSize}
        total={filtered.length}
        onPageChange={setPage}
        unitLabel="cơ sở"
      />
    </div>
  );
}
