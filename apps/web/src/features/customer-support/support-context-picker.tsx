"use client";

import type { SupportBookingContext, SupportContextQuery } from "@metastorage/contracts";
import { formatReference } from "@metastorage/shared";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShadcnButton as Button } from "@/components/ui/shadcn-button";
import { Spinner } from "@/components/ui/spinner";
import { ErrorState } from "@/components/ui/states";
import { customerApiError } from "@/features/bookings/customer-error";
import { formatDate } from "@/lib/format";
import { SUPPORT_MESSAGES as M } from "./support.messages";
import { useSupportContexts } from "./support-hooks";

export function supportContextText(item: SupportBookingContext) {
  const reference = formatReference(item.id, "BK");
  const title = `${item.storageUnitCode ?? reference} · ${item.facility.name}`;
  const period =
    item.startAt && item.endAt
      ? `${formatDate(item.startAt)} – ${formatDate(item.endAt)}`
      : formatDate(item.checkInDate);
  const status = M.contextStatuses[item.rentalStatus ?? item.status] ?? item.status;
  return { title, detail: `${item.unitType.name} · ${period} · ${status}`, reference };
}

export function SupportContextPicker({
  category,
  value,
  onChange,
  error,
}: {
  category: SupportContextQuery["category"];
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SupportBookingContext>();
  const query = useSupportContexts(category, search);
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const selectedItem =
    items.find((item) => item.id === value) ?? (selected?.id === value ? selected : undefined);
  // Keep the selected record readable while a different search/page is loaded.
  const options =
    selectedItem && !items.some((item) => item.id === value) ? [selectedItem, ...items] : items;
  const applySearch = (text: string) => {
    if (selectedItem) setSelected(selectedItem);
    setSearch(text.trim());
  };
  const payment = category === "PAYMENT";
  const label = payment ? M.paymentContextLabel : M.rentalLabel;
  const placeholder = payment ? M.paymentContextChoose : M.contextChoose;
  return (
    <div className="grid gap-2">
      <label htmlFor="support-context" className="text-xs font-bold text-slate-700 sm:text-sm">
        {label} <span className="text-rose-500">*</span>
      </label>
      <div className="flex gap-2">
        <input
          type="search"
          aria-label={M.contextSearchLabel}
          className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          placeholder={M.contextSearch}
          value={input}
          onChange={(event) => {
            setInput(event.target.value);
            if (!event.target.value) applySearch("");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              applySearch(input);
            }
          }}
        />
        <Button type="button" variant="outline" onClick={() => applySearch(input)}>
          {M.contextSearchAction}
        </Button>
      </div>
      <Select
        value={value || "none"}
        onValueChange={(id) => {
          setSelected(items.find((item) => item.id === id));
          onChange(id === "none" ? "" : id);
        }}
      >
        <SelectTrigger
          id="support-context"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "support-context-error" : undefined}
          className="h-auto min-h-12 rounded-xl border-slate-200 bg-white py-2 text-left text-sm font-medium text-slate-800 [&>span]:min-w-0 [&>span]:whitespace-normal"
        >
          <SelectValue placeholder={placeholder}>
            {selectedItem
              ? supportContextText(selectedItem).title
              : value
                ? formatReference(value, "BK")
                : placeholder}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-72 w-[var(--radix-select-trigger-width)] min-w-0">
          <SelectItem value="none">{placeholder}</SelectItem>
          {options.map((item) => {
            const text = supportContextText(item);
            return (
              <SelectItem
                key={item.id}
                value={item.id}
                textValue={`${text.title} ${text.detail} ${text.reference}`}
              >
                <span className="grid gap-1 whitespace-normal break-words" title={item.id}>
                  <span className="font-semibold">{text.title}</span>
                  <span className="text-xs text-slate-500">{text.detail}</span>
                  {item.storageUnitCode && (
                    <span className="text-xs text-slate-500">{text.reference}</span>
                  )}
                </span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      {selectedItem && (
        <p className="text-xs text-slate-500">{supportContextText(selectedItem).detail}</p>
      )}
      {query.isPending && (
        <div role="status" className="flex items-center gap-2 text-xs text-slate-500">
          <Spinner size="sm" variant="brand" />
          {M.contextLoading}
        </div>
      )}
      {query.isError && (
        <ErrorState message={customerApiError(query.error)} onRetry={() => query.refetch()} />
      )}
      {!query.isPending && !query.isError && items.length === 0 && (
        <p role="status" className="text-xs text-slate-500">
          {payment ? M.paymentContextEmpty : M.contextEmpty}
        </p>
      )}
      {query.hasNextPage && (
        <Button
          type="button"
          variant="outline"
          className="h-8 justify-self-start text-xs"
          disabled={query.isFetchingNextPage}
          onClick={() => query.fetchNextPage()}
        >
          {M.contextMore}
        </Button>
      )}
      {error && (
        <p id="support-context-error" role="alert" className="text-xs font-medium text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}
