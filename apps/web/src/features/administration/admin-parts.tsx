"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AdminDialogProps } from "./admin.types";

export const adminCard =
  "min-w-0 bg-surface-container-lowest border border-outline-variant rounded-card p-5 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)]";

export function AdminDialog({ title, children, onClose }: Readonly<AdminDialogProps>) {
  return (
    <Dialog open onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-card border-line p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-line px-6 py-4 text-left">
          <DialogTitle className="font-['Space_Grotesk'] text-xl font-bold text-ink">
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="px-6 pb-6">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
