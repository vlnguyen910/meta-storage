"use client";

import { List, Search } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { Input } from "@/components/ui/form-controls";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { facilitiesMessages as m } from "./facilities.messages";
import { FacilityCard } from "./facility-card";
import { useFacilities } from "./hooks";
import { PublicFacilityCard } from "./public-facility-card";

export function FacilityList({ protectedMode = false }: { protectedMode?: boolean }) {
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [sort, setSort] = useState<"name" | "price">("name");
  const [page, setPage] = useState(1);
  const query = useFacilities({ search, city, sort, page, pageSize: 6 });

  return (
    <>
      <div className="mb-6 grid grid-cols-[1.6fr_1fr_1fr] gap-3 rounded-lg border border-[#e2e8f0] bg-white p-4 shadow-[0_2px_8px_rgb(15_23_42/3%)] max-[800px]:grid-cols-1">
        <div className="relative flex items-center">
          <Search className="absolute left-3.5 text-muted" size={19} />
          <Input
            className="rounded-md border-[#e2e8f0] bg-[#fbfbfa] pl-10 text-sm"
            aria-label={m.searchLabel}
            placeholder={m.searchPlaceholder}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <DropdownSelect
          className="w-full"
          triggerClassName="h-full min-h-[46px] w-full rounded-md border-[#e2e8f0] bg-[#fbfbfa] text-sm"
          ariaLabel={m.cityLabel}
          value={city}
          onChange={(newCity) => {
            setCity(newCity);
            setPage(1);
          }}
          options={[
            { value: "", label: m.allCities },
            ...m.cities.map((value) => ({ value, label: value })),
          ]}
          maxVisibleItems={6}
        />
        <DropdownSelect
          className="w-full"
          triggerClassName="h-full min-h-[46px] w-full rounded-md border-[#e2e8f0] bg-[#fbfbfa] text-sm"
          ariaLabel={m.sortLabel}
          value={sort}
          onChange={(newSort) => {
            setSort(newSort as typeof sort);
            setPage(1);
          }}
          options={[
            { value: "name", label: m.sorts.name },
            { value: "price", label: m.sorts.price },
          ]}
          maxVisibleItems={6}
        />
      </div>
      {!protectedMode && query.data ? (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-sm">
          <p aria-live="polite" className="font-medium text-[#334155]">
            {m.results(query.data.total)}
          </p>
          <span className="inline-flex items-center gap-2 rounded border border-[#e2e8f0] bg-[#e8f5f1] px-3 py-2 text-xs text-[#125345]">
            <List size={15} />
            {m.list}
          </span>
        </div>
      ) : null}
      {query.isLoading ? <LoadingState label={m.loading} variant="table" /> : null}
      {query.isError ? <ErrorState message={m.error} onRetry={() => query.refetch()} /> : null}
      {query.data?.items.length === 0 ? (
        <EmptyState title={m.empty} description={m.emptyDescription} />
      ) : null}
      {query.data?.items.length ? (
        <div
          className={
            protectedMode
              ? "grid grid-cols-3 gap-5 max-[1024px]:grid-cols-2 max-[560px]:grid-cols-1"
              : "grid gap-5"
          }
        >
          {query.data.items.map((facility) =>
            protectedMode ? (
              <FacilityCard key={facility.id} facility={facility} protectedMode />
            ) : (
              <PublicFacilityCard key={facility.id} facility={facility} />
            ),
          )}
        </div>
      ) : null}
      {query.data && query.data.totalPages > 1 ? (
        <div className="mt-7 flex items-center justify-center gap-4">
          <Button
            variant="outline"
            disabled={page === 1}
            onClick={() => setPage((value) => value - 1)}
          >
            {m.previous}
          </Button>
          <span>{m.pagination(page, query.data.totalPages)}</span>
          <Button
            variant="outline"
            disabled={page === query.data.totalPages}
            onClick={() => setPage((value) => value + 1)}
          >
            {m.next}
          </Button>
        </div>
      ) : null}
    </>
  );
}
