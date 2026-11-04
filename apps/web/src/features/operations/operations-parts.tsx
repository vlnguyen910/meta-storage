"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCaption,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OPERATIONS_MESSAGES as M } from "./operations.messages";
import type {
  OperationsDialogProps,
  OperationsMetricProps,
  OperationsTableProps,
} from "./operations.types";

export function OperationsTable({ label, headings, children }: Readonly<OperationsTableProps>) {
  return (
    <section
      aria-label={label}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users need to focus this horizontally scrollable region.
      tabIndex={0}
      className="max-w-full overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs focus-visible:outline-2 focus-visible:outline-primary"
    >
      <Table>
        <TableCaption className="sr-only">{label}</TableCaption>
        <TableHeader className="border-b border-slate-200 bg-slate-50 text-slate-600">
          <TableRow className="hover:bg-transparent">
            {headings.map((heading) => (
              <TableHead
                key={heading}
                scope="col"
                className="whitespace-nowrap px-5 py-4 font-semibold text-slate-600"
              >
                {heading}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-slate-100">{children}</TableBody>
      </Table>
    </section>
  );
}

export function OperationsMetric({ label, value, detail }: Readonly<OperationsMetricProps>) {
  return (
    <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
      <h2 className="text-sm font-semibold text-slate-600">{label}</h2>
      <p className="my-3 break-words text-2xl font-bold tabular-nums text-slate-900">{value}</p>
      {detail && <p className="m-0 text-xs text-slate-600">{detail}</p>}
    </section>
  );
}

export function OperationsDialog({ title, children, onClose }: Readonly<OperationsDialogProps>) {
  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto p-6 bg-white text-slate-900">
        <DialogHeader className="mb-2">
          <DialogTitle className="text-xl font-bold">{title}</DialogTitle>
          <p className="text-sm text-slate-600">{M.review}</p>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
