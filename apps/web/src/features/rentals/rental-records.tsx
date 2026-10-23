"use client";

import type { GuestRentalPaymentItemDto, RentalDocumentDto } from "@metastorage/contracts";
import { CONTRACT_PDF_MAX_BYTES, ContractUploadSchema } from "@metastorage/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Clock, CreditCard, FileCheck, FileText, Receipt } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, buttonClassName } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/display";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { F3 } from "@/features/returns/integration.messages";
import {
  f3Panel,
  integrationError,
  money,
  readFileBase64,
} from "@/features/returns/integration-utils";
import { useFlow3Identity } from "@/features/returns/use-flow3-identity";
import { api } from "@/lib/api";
import { CONTRACT_UI as C } from "./contract.messages";
import { ContractPdfPicker } from "./contract-pdf-picker";
import { useRentalDocuments } from "./use-rental-documents";

export function RentalPayments({ rentalId }: { rentalId: string }) {
  const identity = useFlow3Identity();
  const query = useQuery({
    queryKey: ["rental-payments", identity, rentalId],
    queryFn: ({ signal }) => api.rentalPayments(rentalId, signal),
  });
  return (
    <section className={f3Panel}>
      <div className="mb-4 flex items-center gap-2.5">
        <div className="grid size-9 place-items-center rounded-lg bg-emerald-50 text-primary">
          <CreditCard size={18} />
        </div>
        <h2 className="text-lg font-bold text-ink">{F3.payments}</h2>
      </div>
      {query.isPending ? (
        <LoadingState variant="table" />
      ) : query.isError ? (
        <ErrorState message={integrationError(query.error)} onRetry={() => query.refetch()} />
      ) : (
        <PaymentRecords items={query.data} />
      )}
    </section>
  );
}

export function BookingContractAccess({ bookingId }: { bookingId: string }) {
  return <RentalDocuments bookingId={bookingId} handover />;
}

export function PaymentRecords({ items }: { items: GuestRentalPaymentItemDto[] }) {
  if (!items.length) return <p className="text-sm text-muted">{F3.noPayments}</p>;
  return (
    <ul className="list-none space-y-3 p-0">
      {items.map((item) => (
        <li
          key={item.id}
          className="space-y-2.5 rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Receipt size={16} className="text-primary" />
              <strong className="font-mono text-sm text-ink">{item.paymentCode}</strong>
            </div>
            <StatusBadge value={item.status} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
            <p className="m-0 text-sm">
              <span className="text-muted">{F3.paid}: </span>
              <strong className="text-base font-bold text-primary">
                {money(item.totalAmount)}
              </strong>
            </p>
            <p className="m-0 flex items-center gap-1.5 text-xs text-muted">
              <Clock size={13} className="text-slate-400" />
              {new Date(item.paidAt ?? item.createdAt).toLocaleString("vi-VN")}
            </p>
          </div>
          {item.refundedAt && item.refundAmount && (
            <p className="m-0 text-sm text-amber-800">
              {F3.refunded}: <strong>{money(item.refundAmount)}</strong> ·{" "}
              {new Date(item.refundedAt).toLocaleString("vi-VN")}
            </p>
          )}
          {item.returnRefunds.map((r) => (
            <p key={r.id} className="m-0 text-xs text-emerald-800">
              {F3.returnedRefund}: <strong>{money(r.amount)}</strong> · {r.reference} ·{" "}
              {new Date(r.confirmedAt).toLocaleString("vi-VN")}
            </p>
          ))}
        </li>
      ))}
    </ul>
  );
}

export function PrivatePdf({
  load,
  filename,
}: {
  load: (signal: AbortSignal) => Promise<Blob>;
  filename: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const identity = useFlow3Identity();
  useEffect(() => {
    if (identity) {
      controller.current?.abort();
      dialog.current?.close();
      setUrl(null);
      setBusy(false);
    }
    return () => controller.current?.abort();
  }, [identity]);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  async function open() {
    setBusy(true);
    setError("");
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    try {
      const blob = await load(abort.signal);
      if (abort.signal.aborted) return;
      setUrl(URL.createObjectURL(new Blob([blob], { type: "application/pdf" })));
      dialog.current?.showModal();
    } catch (err) {
      if (!abort.signal.aborted) setError(integrationError(err));
    } finally {
      if (!abort.signal.aborted) setBusy(false);
    }
  }
  return (
    <div className="space-y-2">
      <button
        type="button"
        ref={trigger}
        className={buttonClassName("outline")}
        disabled={busy}
        onClick={() => void open()}
      >
        {busy ? F3.loading : F3.viewPdf}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <dialog
        ref={dialog}
        onClose={() => {
          setUrl(null);
          trigger.current?.focus();
        }}
        aria-label={F3.pdfTitle}
        className="m-auto w-[min(960px,95vw)] max-h-[95dvh] rounded border border-slate-300 bg-white p-4 backdrop:bg-slate-950/50"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <strong className="break-all">{filename}</strong>
          <Button variant="outline" onClick={() => dialog.current?.close()}>
            {F3.close}
          </Button>
        </div>
        {url && (
          <>
            <iframe src={url} title={F3.pdfTitle} className="w-full h-[65dvh] border" />
            <p className="text-sm my-2">{F3.pdfHelp}</p>
            <a
              className="inline-flex min-h-11 items-center font-semibold text-primary underline"
              href={url}
              download={filename}
            >
              {F3.downloadPdf}
            </a>
          </>
        )}
      </dialog>
    </div>
  );
}

export function RentalDocuments({
  bookingId,
  rentalId,
  manager = false,
  handover = false,
}: {
  bookingId: string;
  rentalId?: string;
  manager?: boolean;
  handover?: boolean;
}) {
  const identity = useFlow3Identity();
  const client = useQueryClient();
  const key = ["rental-documents", identity, bookingId, rentalId];
  const query = useRentalDocuments(bookingId, rentalId);
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [confirmation, setConfirmation] = useState<RentalDocumentDto | null>(null);
  const pendingUpload = useRef<{ file: File; key: string } | null>(null);
  const upload = useMutation({
    meta: { globalLoading: true },
    mutationFn: async () => {
      if (
        !file ||
        file.size === 0 ||
        file.size > CONTRACT_PDF_MAX_BYTES ||
        file.type !== "application/pdf"
      )
        throw new Error("invalid-pdf");
      if (pendingUpload.current?.file !== file)
        pendingUpload.current = { file, key: crypto.randomUUID() };
      const parsed = ContractUploadSchema.parse({
        filename: file.name,
        mimeType: "application/pdf",
        dataBase64: await readFileBase64(file),
        idempotencyKey: pendingUpload.current.key,
      });
      return api.rentalDocuments.upload(bookingId, parsed);
    },
    onSuccess: () => {
      setFile(null);
      pendingUpload.current = null;
      setMessage(F3.saved);
    },
    onSettled: () => client.invalidateQueries({ queryKey: key }),
  });
  const issue = useMutation({
    meta: { globalLoading: true },
    mutationFn: (id: string) =>
      api.rentalDocuments.issue(bookingId, id, {
        expectedCurrentIssuedId: query.data?.find((d) => d.currentIssued)?.id ?? null,
      }),
    onSuccess: () => {
      setConfirmation(null);
      setMessage(F3.saved);
    },
    onSettled: () => client.invalidateQueries({ queryKey: key }),
  });
  useEffect(() => {
    if (bookingId && identity) {
      setFile(null);
      setConfirmation(null);
      setMessage("");
      pendingUpload.current = null;
    }
  }, [bookingId, identity]);
  const issued = query.data?.some((doc) => doc.status === "ISSUED" && doc.currentIssued);
  const hasUpload = query.data?.some((doc) => doc.status === "UPLOADED");
  const failure = upload.isError ? upload.error : issue.error;
  return (
    <section className={f3Panel}>
      <div className="mb-4 flex items-center gap-2.5">
        <div className="grid size-9 place-items-center rounded-lg bg-emerald-50 text-primary">
          <FileText size={18} />
        </div>
        <h2 className="text-lg font-bold text-ink">{F3.contracts}</h2>
      </div>
      {(manager || handover) && query.isSuccess && (
        <div
          role="status"
          className={`rounded border p-4 text-sm ${issued ? "border-emerald-300 bg-emerald-50 text-emerald-950" : "border-amber-300 bg-amber-50 text-amber-950"}`}
        >
          <strong>{issued ? C.ready : C.missing}</strong>
          {!issued && (
            <p className="mt-2">
              {manager ? (hasUpload ? C.pendingIssue : C.missingUpload) : C.staffMissing}
            </p>
          )}
        </div>
      )}
      {query.isPending ? (
        <LoadingState variant="table" />
      ) : query.isError ? (
        <ErrorState message={integrationError(query.error)} onRetry={() => query.refetch()} />
      ) : (
        <ul className="list-none space-y-3 p-0">
          {!query.data.length && !manager && !handover && (
            <li className="text-sm text-slate-600">{F3.noContracts}</li>
          )}
          {query.data.map((doc) => (
            <li
              key={doc.id}
              className="space-y-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileCheck size={16} className="text-primary" />
                  <strong className="text-sm text-ink">
                    {F3.version(doc.version)} · {doc.filename}
                  </strong>
                </div>
                <span className="rounded-full border border-emerald-200/70 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                  {doc.status === "ISSUED" ? F3.issued : F3.uploaded}
                  {doc.currentIssued ? ` · ${F3.current}` : ""}
                  {doc.usedForHandover ? ` · ${F3.used}` : ""}
                </span>
              </div>
              <PrivatePdf
                filename={doc.filename}
                load={(signal) => api.rentalDocuments.pdf(bookingId, doc.id, signal)}
              />
              {manager && doc.status === "UPLOADED" && (
                <Button
                  variant="outline"
                  disabled={issue.isPending}
                  onClick={() => setConfirmation(doc)}
                >
                  {F3.issue}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {manager && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setMessage("");
            issue.reset();
            void upload.mutate();
          }}
          className="space-y-3 border-t border-slate-200 pt-4"
        >
          <ContractPdfPicker
            file={file}
            disabled={upload.isPending || issue.isPending}
            onSelect={(next) => {
              setMessage("");
              upload.reset();
              issue.reset();
              setFile(next);
            }}
          />
          <Button
            disabled={
              !file ||
              file.size === 0 ||
              file.size > CONTRACT_PDF_MAX_BYTES ||
              file.type !== "application/pdf" ||
              upload.isPending ||
              issue.isPending ||
              query.isPending ||
              query.isError
            }
            loading={upload.isPending}
          >
            {F3.upload}
          </Button>
        </form>
      )}
      {confirmation && (
        <section role="alert" className="rounded border border-amber-300 bg-amber-50 p-4 space-y-3">
          <p>{F3.issueConfirm}</p>
          <strong>{confirmation.filename}</strong>
          <div className="flex gap-3">
            <Button
              loading={issue.isPending}
              disabled={issue.isPending}
              onClick={() => issue.mutate(confirmation.id)}
            >
              {F3.issue}
            </Button>
            <Button
              variant="outline"
              disabled={issue.isPending}
              onClick={() => setConfirmation(null)}
            >
              {F3.close}
            </Button>
          </div>
        </section>
      )}
      {(upload.isError || issue.isError) && (
        <p role="alert" className="text-red-700">
          {isAxiosError(failure) && failure.response?.status === 503
            ? C.storageFailure
            : integrationError(failure)}
        </p>
      )}
      {message && (
        <p role="status" className="text-emerald-800">
          {message}
        </p>
      )}
    </section>
  );
}
