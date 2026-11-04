"use client";

import { AlertTriangle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FLOW } from "./flow.messages";
import { FlowButton } from "./flow-ui";
import type { ReassignmentDialogProps } from "./reassignment-dialog.types";

export function ReassignmentDialog({
  change,
  pending,
  error,
  onCancel,
  onConfirm,
}: ReassignmentDialogProps) {
  return (
    <Dialog open={true} onOpenChange={(open) => !open && !pending && onCancel()}>
      <DialogContent className="max-w-xl max-h-[90dvh] overflow-y-auto p-6 bg-white text-[#131b2e]">
        <DialogHeader className="flex flex-row items-start gap-3 space-y-0 text-left">
          <span className="shrink-0 rounded-lg bg-[#ffdcc3] p-2 text-[#6e3900]">
            <AlertTriangle size={24} aria-hidden="true" />
          </span>
          <div>
            <DialogTitle className="text-xl font-bold tracking-tight">
              {FLOW.reassignTitle}
            </DialogTitle>
            <p className="mt-1 text-sm text-[#404945]">
              {change.bookingCode} · {change.customerName}
            </p>
          </div>
        </DialogHeader>
        <div className="my-5 grid items-center gap-3 rounded-lg bg-[#f2f3ff] p-4 sm:grid-cols-[1fr_auto_1fr]">
          <div>
            <p className="text-xs text-[#404945]">{FLOW.reassignFrom}</p>
            <p className="mt-1 break-all text-base font-semibold">
              {change.previousUnitCode ?? FLOW.unassigned}
            </p>
          </div>
          <ArrowRight size={20} aria-hidden="true" className="text-[#306858] max-sm:rotate-90" />
          <div>
            <p className="text-xs text-[#404945]">{FLOW.reassignTo}</p>
            <p className="mt-1 break-all text-base font-semibold text-[#003b2f]">
              {change.unitCode}
            </p>
          </div>
        </div>
        <p id="reassignment-description" className="text-sm leading-6 text-[#404945]">
          {FLOW.reassignDescription}
        </p>
        {change.reason && (
          <div className="mt-4">
            <p className="text-xs text-[#404945]">{FLOW.notesAssign}</p>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm">{change.reason}</p>
          </div>
        )}
        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-[#ffdad6] p-3 text-sm text-[#93000a]">
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-[#bfc9c4] pt-4">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={onCancel}
            className="min-h-11"
          >
            {FLOW.reassignCancel}
          </Button>
          <FlowButton onClick={onConfirm} loading={pending} icon={<ArrowRight size={18} />}>
            {FLOW.reassignConfirm}
          </FlowButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
