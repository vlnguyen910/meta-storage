"use client";

import { RefreshCw, Search } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useOperationsPricing } from "../hooks/use-operations-pricing";
import { OPERATIONS_MESSAGES as M } from "../operations.messages";
import { formatDateTimeVn, formatMoney } from "../operations.utils";

export function OperationsPricingView() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { configQuery } = useOperationsPricing();
  const { data } = configQuery;
  if (configQuery.isPending) return <LoadingState label={M.loading} variant="table" />;
  if (!data) return <ErrorState message={M.error} onRetry={() => configQuery.refetch()} />;
  const prices = data.prices.filter((price) =>
    `${price.name} ${price.code}`
      .toLocaleLowerCase("vi")
      .includes(search.trim().toLocaleLowerCase("vi")),
  );
  const safePage = Math.min(page, Math.max(1, Math.ceil(prices.length / 10)));
  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4">
        <div>
          <h2 className="font-bold">{M.pricingConfigTitle}</h2>
          <p className="mt-1 text-sm text-muted">{M.priceReadOnlyHint}</p>
          <p className="mt-1 text-xs text-muted">
            {M.updatedAtLabel}: {formatDateTimeVn(data.updatedAt)}
          </p>
        </div>
        <Button
          variant="outline"
          disabled={configQuery.isFetching}
          onClick={() => configQuery.refetch()}
        >
          <RefreshCw size={16} />
          {M.refreshPricing}
        </Button>
      </section>
      {configQuery.isError && (
        <p role="alert" className="text-sm text-danger">
          {M.priceReloadError}
        </p>
      )}
      <div className="relative max-w-md">
        <Input
          type="search"
          aria-label={M.searchPrices}
          placeholder={M.searchPrices}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className="pl-9"
        />
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        />
      </div>
      <div className="overflow-x-auto rounded-xl border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{M.priceTypeName}</TableHead>
              <TableHead>{M.priceTypeCode}</TableHead>
              <TableHead>{M.monthlyPrice}</TableHead>
              <TableHead>{M.priceStatus}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!prices.length ? (
              <TableRow>
                <TableCell colSpan={4}>{M.noPriceMatch}</TableCell>
              </TableRow>
            ) : (
              prices.slice((safePage - 1) * 10, safePage * 10).map((price) => (
                <TableRow key={price.unitTypeId}>
                  <TableCell>{price.name}</TableCell>
                  <TableCell>{price.code}</TableCell>
                  <TableCell>{formatMoney(price.monthlyPrice)}</TableCell>
                  <TableCell>
                    <Badge>{price.isActive ? M.active : M.inactive}</Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <ListPagination
        label={M.pricingConfigTitle}
        page={safePage}
        pageSize={10}
        total={prices.length}
        onPageChange={setPage}
      />
    </div>
  );
}
