"use client";

import { Clock, Layers, RefreshCw, Search, Warehouse, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { cn } from "@/lib/utils";
import { useOperationsPricing } from "../hooks/use-operations-pricing";
import { OPERATIONS_MESSAGES as M } from "../operations.messages";
import { formatDateTimeVn, formatMoney } from "../operations.utils";

export function OperationsPricingView() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 5;

  const { configQuery } = useOperationsPricing();
  const { data } = configQuery;

  if (configQuery.isPending) return <LoadingState label={M.loading} variant="table" />;
  if (!data) return <ErrorState message={M.error} onRetry={() => configQuery.refetch()} />;

  const prices = data.prices.filter((price) =>
    `${price.name} ${price.code}`
      .toLocaleLowerCase("vi")
      .includes(search.trim().toLocaleLowerCase("vi")),
  );

  const totalPages = Math.max(1, Math.ceil(prices.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const displayedPrices = prices.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <div className="flex flex-col h-full min-h-0 gap-3">
      {/* Top Configuration Card with Shadcn */}
      <Card className="shrink-0 border-slate-200/90 shadow-2xs">
        <CardHeader className="p-4 pb-3 flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="grid size-8 place-items-center rounded-lg bg-[#e8f3ef] text-[#165f4d] shrink-0">
                <Layers className="size-4" />
              </div>
              <CardTitle className="text-base font-bold text-slate-900 tracking-tight">
                {M.pricingConfigTitle}
              </CardTitle>
            </div>
            <CardDescription className="mt-1 text-xs text-slate-500 max-w-2xl">
              {M.priceReadOnlyHint}
            </CardDescription>
            <p className="mt-1 text-[11px] font-medium text-slate-400 flex items-center gap-1">
              <Clock className="size-3 text-slate-400" />
              {M.updatedAtLabel}: {formatDateTimeVn(data.updatedAt)}
            </p>
          </div>
          <Button
            variant="outline"
            disabled={configQuery.isFetching}
            onClick={() => configQuery.refetch()}
            className="h-9 px-3.5 text-xs font-semibold gap-2 border-slate-200 text-slate-700 hover:border-[#165f4d] hover:text-[#165f4d] hover:bg-[#e8f3ef]/40 transition-colors cursor-pointer"
          >
            <RefreshCw className={cn("size-3.5", configQuery.isFetching && "animate-spin")} />
            {M.refreshPricing}
          </Button>
        </CardHeader>
      </Card>

      {/* Error notification if background refresh fails */}
      {configQuery.isError && (
        <p
          role="alert"
          className="shrink-0 text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-2.5 font-medium"
        >
          {M.priceReloadError}
        </p>
      )}

      {/* Toolbar: Search input + Results summary */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <input
            type="search"
            aria-label={M.searchPrices}
            placeholder={M.searchPrices}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            className="w-full h-9 pl-9 pr-8 text-xs rounded-lg border border-slate-200 bg-white placeholder:text-slate-400 text-slate-900 focus:outline-none focus:border-[#165f4d] focus:ring-1 focus:ring-[#165f4d] transition-all shadow-2xs"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setPage(1);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500">
            Tổng: <strong className="text-slate-800 font-bold">{prices.length}</strong> loại kho
          </span>
        </div>
      </div>

      {/* Table Container - flex-1 scrollable */}
      <div className="flex-1 min-h-0 rounded-xl border border-slate-200 bg-white shadow-2xs overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-xs">
            <TableRow className="border-b border-slate-200 hover:bg-transparent">
              <TableHead className="py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-slate-600 w-[35%]">
                {M.priceTypeName}
              </TableHead>
              <TableHead className="py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-slate-600 w-[20%]">
                {M.priceTypeCode}
              </TableHead>
              <TableHead className="py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-slate-600 w-[25%]">
                {M.monthlyPrice}
              </TableHead>
              <TableHead className="py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-slate-600 w-[20%] text-right">
                {M.priceStatus}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayedPrices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-48 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center gap-1.5 py-6">
                    <Warehouse className="size-8 text-slate-300" />
                    <p className="text-sm font-medium text-slate-600">{M.noPriceMatch}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              displayedPrices.map((price) => (
                <TableRow
                  key={price.unitTypeId}
                  className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors"
                >
                  <TableCell className="py-3 px-4 font-semibold text-slate-900 text-sm">
                    <div className="flex items-center gap-2.5">
                      <div className="grid size-7 place-items-center rounded-lg bg-[#e8f3ef] text-[#165f4d] shrink-0">
                        <Warehouse className="size-3.5" />
                      </div>
                      <span>{price.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3 px-4">
                    <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/80 inline-block">
                      {price.code}
                    </span>
                  </TableCell>
                  <TableCell className="py-3 px-4 font-bold text-slate-900 text-sm tabular-nums">
                    {formatMoney(price.monthlyPrice)}
                  </TableCell>
                  <TableCell className="py-3 px-4 text-right">
                    <Badge
                      variant={price.isActive ? "default" : "secondary"}
                      className={cn(
                        "text-xs font-semibold px-2.5 py-0.5 rounded-full shadow-none",
                        price.isActive
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200/90 hover:bg-emerald-50"
                          : "bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-100",
                      )}
                    >
                      {price.isActive ? M.active : M.inactive}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Bar with Page Jump */}
      <ListPagination
        label={M.titles.pricing}
        page={safePage}
        pageSize={pageSize}
        total={prices.length}
        unitLabel="loại kho"
        onPageChange={setPage}
      />
    </div>
  );
}
