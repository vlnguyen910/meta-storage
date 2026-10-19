"use client";

import { useQuery } from "@tanstack/react-query";
import { BarChart3, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { buttonClassName } from "@/components/ui/button";
import { FieldShell, Input } from "@/components/ui/form-controls";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { businessOperationsRoutes as routes } from "@/config/routes";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { OPERATIONS_MESSAGES as M } from "../operations.messages";
import { OperationsTable } from "../operations-parts";

export function OperationsFacilitiesRealView() {
  const [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: ["facilities", "active-list"],
    queryFn: () => api.facilities.listActive({ limit: 100 }),
    staleTime: 60_000,
  });

  const { data: facilities, isPending, isError, refetch } = query;

  if (isPending) return <LoadingState label={M.loading} />;
  if (isError || !facilities) {
    return <ErrorState message={M.error} onRetry={() => void refetch()} />;
  }

  const filtered = facilities.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.code.toLowerCase().includes(search.toLowerCase()) ||
      item.address.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="grid gap-6">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-outline-variant bg-surface-container-lowest p-5 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)]">
        <div className="max-w-md flex-1 min-w-64">
          <FieldShell label={M.search}>
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên, mã hoặc địa chỉ cơ sở..."
            />
          </FieldShell>
        </div>
        <div className="text-right">
          <span className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200">
            Cơ sở đang hoạt động ({facilities.length})
          </span>
          <p className="m-0 mt-1 text-[11px] text-slate-500 max-w-xs">
            Danh sách gồm các cơ sở đang mở cửa kinh doanh. Quản trị phân ô & nhân sự thuộc Flow 5.
          </p>
        </div>
      </section>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500 rounded-card border border-outline-variant bg-surface-container-lowest">
          {M.empty}
        </p>
      ) : (
        <OperationsTable
          label={M.titles.facilities}
          headings={["Mã cơ sở", "Tên cơ sở", "Địa chỉ", "Trạng thái", "Báo cáo điều hành"]}
        >
          {filtered.map((facility) => (
            <tr key={facility.id} className="hover:bg-slate-50/50">
              <td className="px-5 py-4 font-mono font-bold text-xs text-primary whitespace-nowrap">
                {facility.code}
              </td>
              <th scope="row" className="px-5 py-4 font-semibold text-ink whitespace-nowrap">
                {facility.name}
              </th>
              <td className="px-5 py-4 text-xs text-slate-600">{facility.address}</td>
              <td className="px-5 py-4 whitespace-nowrap">
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                    facility.isActive
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : "bg-slate-100 text-slate-600",
                  )}
                >
                  {facility.isActive ? M.active : M.inactive}
                </span>
              </td>
              <td className="px-5 py-4 whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <Link
                    href={`${routes.revenue}?facilityId=${facility.id}`}
                    aria-label={`Xem doanh thu cơ sở ${facility.name}`}
                    className={cn(
                      buttonClassName("outline"),
                      "h-8 px-2.5 text-xs font-medium inline-flex items-center gap-1.5",
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
                      "h-8 px-2.5 text-xs font-medium inline-flex items-center gap-1.5",
                    )}
                  >
                    <BarChart3 size={13} className="text-primary" aria-hidden="true" />
                    <span>Sử dụng kho</span>
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </OperationsTable>
      )}
    </div>
  );
}
