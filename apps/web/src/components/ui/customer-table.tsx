"use client";

import { cn } from "@/lib/utils";
import type { CustomerTableProps } from "./customer-table.types";

export function CustomerTable({
  title,
  headings,
  children,
  className,
  minWidth = "min-w-[760px]",
}: Readonly<CustomerTableProps>) {
  return (
    <section
      aria-label={title}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users need to focus the horizontally scrollable table.
      tabIndex={0}
      className={cn(
        "flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden rounded-card border border-line bg-white shadow-card outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary",
        className,
      )}
    >
      <div className="flex-1 min-h-0 overflow-auto">
        <table
          className={cn(
            "w-full border-collapse text-left text-sm [&_td]:px-4 [&_td]:py-3.5 [&_tr]:border-b [&_tr]:border-slate-100 [&_tr:hover]:bg-slate-50/70 transition-colors",
            minWidth,
          )}
        >
          <caption className="sr-only">{title}</caption>
          <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-xs text-xs font-semibold text-slate-600 shadow-2xs">
            <tr>
              {headings.map((heading) => (
                <th scope="col" className="px-4 py-3 font-semibold" key={heading}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">{children}</tbody>
        </table>
      </div>
    </section>
  );
}
