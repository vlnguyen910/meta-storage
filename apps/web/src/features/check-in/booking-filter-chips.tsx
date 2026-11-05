"use client";

import { Check, ChevronDown, ListFilter } from "lucide-react";
import { DropdownMenu as Menu } from "radix-ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { MANAGER_BOOKING_ROW as M } from "./manager-booking-row.messages";

const quickFilters = ["ALL", "NEEDS_STAFF", "PAYMENT_PENDING"];
const attention = new Set([
  "NEEDS_UNIT",
  "NEEDS_STAFF",
  "PAYMENT_PENDING",
  "READY",
  "SLOT_MISSING",
  "READY_HANDOVER",
]);
const chipClass =
  "inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const selectedClass =
  "border-primary bg-primary font-semibold text-white shadow-xs hover:bg-primary hover:text-white";
const unselectedClass =
  "border-slate-200 bg-slate-50 text-slate-800 hover:border-primary/40 hover:bg-primary-soft hover:text-primary-dark";

function FilterCount({ value, active }: { value: number; active: boolean }) {
  return (
    <span
      className={cn(
        "min-w-5 rounded-md px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums",
        active ? "bg-white/20 text-white" : "bg-slate-200/70 text-slate-700",
      )}
    >
      {value}
    </span>
  );
}

export function BookingFilterChips({
  ids,
  selected,
  count,
  onChange,
  labels,
}: {
  ids: string[];
  selected: string;
  count: (id: string) => number;
  onChange: (id: string) => void;
  labels: Record<string, string>;
}) {
  const remaining = ids.filter((id) => !quickFilters.includes(id));
  const otherActive = remaining.includes(selected);
  const groups = [
    { label: M.needsAction, items: remaining.filter((id) => attention.has(id)) },
    { label: M.byStatus, items: remaining.filter((id) => !attention.has(id)) },
  ].filter((group) => group.items.length > 0);

  return (
    <div
      className="flex flex-wrap items-center gap-2 border-t border-line pt-3"
      role="toolbar"
      aria-label={M.filters}
    >
      {quickFilters
        .filter((id) => ids.includes(id))
        .map((id) => {
          const active = selected === id;
          const itemCount = count(id);
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(id)}
              className={cn(
                chipClass,
                active ? selectedClass : unselectedClass,
                !active &&
                  itemCount === 0 &&
                  "border-line bg-surface text-slate-700 opacity-80 hover:opacity-100",
              )}
            >
              {labels[id]}
              <FilterCount value={itemCount} active={active} />
            </button>
          );
        })}
      {remaining.length > 0 && (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={otherActive ? `${M.moreFilters}: ${labels[selected]}` : M.moreFilters}
              className={cn(chipClass, otherActive ? selectedClass : unselectedClass)}
            >
              <ListFilter size={14} aria-hidden="true" />
              {otherActive ? labels[selected] : M.moreFilters}
              {otherActive && <FilterCount value={count(selected)} active />}
              <ChevronDown size={14} aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sideOffset={8}
            className="max-h-[min(65vh,var(--radix-dropdown-menu-content-available-height))] w-72 max-w-[calc(100vw-2rem)] overflow-y-auto bg-surface p-1.5"
          >
            <Menu.RadioGroup value={selected} onValueChange={onChange}>
              {groups.map((group, index) => (
                <Menu.Group key={group.label}>
                  {index > 0 && <Menu.Separator className="my-1.5 h-px bg-line" />}
                  <Menu.Label className="px-3 py-2 text-xs font-semibold text-slate-600">
                    {group.label}
                  </Menu.Label>
                  {group.items.map((id) => {
                    const active = selected === id;
                    const itemCount = count(id);
                    return (
                      <Menu.RadioItem
                        key={id}
                        value={id}
                        className={cn(
                          "flex min-h-9 cursor-pointer select-none items-center gap-2 rounded-md px-3 py-2 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
                          active
                            ? "bg-primary text-white data-[highlighted]:bg-primary"
                            : "text-slate-800 data-[highlighted]:bg-primary-soft data-[highlighted]:text-primary-dark",
                          !active &&
                            itemCount === 0 &&
                            "text-slate-700 opacity-80 data-[highlighted]:opacity-100",
                        )}
                      >
                        <span className="flex-1">{labels[id]}</span>
                        <FilterCount value={itemCount} active={active} />
                        <span className="grid size-4 place-items-center">
                          <Menu.ItemIndicator>
                            <Check size={14} aria-hidden="true" />
                          </Menu.ItemIndicator>
                        </span>
                      </Menu.RadioItem>
                    );
                  })}
                </Menu.Group>
              ))}
            </Menu.RadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
