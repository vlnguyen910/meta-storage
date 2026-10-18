"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FieldShell, Input } from "@/components/ui/form-controls";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { OPERATIONS_MESSAGES as M } from "../operations.messages";
import { OperationsTable } from "../operations-parts";

export function OperationsFacilitiesRealView() {
  const [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: ["facilities", "active"],
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
      <section className="rounded-card border border-outline-variant bg-surface-container-lowest p-5 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)]">
        <FieldShell label={M.search}>
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên, mã hoặc địa chỉ cơ sở..."
          />
        </FieldShell>
      </section>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500 rounded-card border border-outline-variant bg-surface-container-lowest">
          {M.empty}
        </p>
      ) : (
        <OperationsTable
          label={M.titles.facilities}
          headings={["Mã cơ sở", "Tên cơ sở", "Địa chỉ", "Trạng thái"]}
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
            </tr>
          ))}
        </OperationsTable>
      )}
    </div>
  );
}
