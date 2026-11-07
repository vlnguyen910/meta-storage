"use client";

import { Headphones } from "lucide-react";
import { useRef } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { SUPPORT_MESSAGES as M } from "./support.messages";
import { CustomerSupportDetail } from "./support-screens";

export function CustomerSupportDialog({
  ticketId,
  onClose,
}: {
  ticketId: string;
  onClose: () => void;
}) {
  const opener = useRef<HTMLElement | null>(null);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        aria-describedby={undefined}
        className="left-0 top-0 flex h-dvh max-h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 p-0 sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[calc(100dvh-3rem)] sm:w-[900px] sm:max-w-[calc(100vw-3rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border"
        onOpenAutoFocus={() => {
          opener.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;
        }}
        onCloseAutoFocus={(event) => {
          if (opener.current?.isConnected) {
            event.preventDefault();
            opener.current.focus({ preventScroll: true });
          }
        }}
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-slate-100 bg-white px-4 py-4 pr-16 sm:px-6 sm:pr-16">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-primary">
            <Headphones aria-hidden="true" size={19} />
          </span>
          <DialogTitle className="text-base sm:text-lg">{M.detailEyebrow}</DialogTitle>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain bg-slate-50/60 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6">
          <CustomerSupportDetail ticketId={ticketId} inDialog />
        </div>
      </DialogContent>
    </Dialog>
  );
}
