"use client";

import type { RentalDocumentDto, RentalPaymentItem } from "@metastorage/contracts";
import { CONTRACT_PDF_MAX_BYTES, ContractUploadSchema } from "@metastorage/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Clock, CreditCard, FileCheck, FileText, Receipt } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/display";
import { ListPagination } from "@/components/ui/list-pagination";
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
    <Card className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-100/70 text-[#165f4d]">
            <CreditCard className="size-5" />
          </div>
          <div>
            <h3 className="m-0 text-lg font-bold text-slate-900">{F3.payments}</h3>
            <p className="m-0 mt-0.5 text-xs text-slate-500">
              Chi tiết các khoản thanh toán tiền thuê, cọc và hoàn tiền của đơn thuê này.
            </p>
          </div>
        </div>

        {query.data && query.data.length > 0 && (
          <span className="rounded-full bg-slate-100 px-3 py-1 font-mono text-xs font-semibold text-slate-600">
            {query.data.length} giao dịch
          </span>
        )}
      </div>

      <div className="pt-4">
        {query.isPending ? (
          <LoadingState variant="table" />
        ) : query.isError ? (
          <ErrorState message={integrationError(query.error)} onRetry={() => query.refetch()} />
        ) : (
          <PaymentRecords items={query.data} />
        )}
      </div>
    </Card>
  );
}

export function BookingContractAccess({ bookingId }: { bookingId: string }) {
  return <RentalDocuments bookingId={bookingId} handover />;
}

export function PaymentRecords({ items }: { items: RentalPaymentItem[] }) {
  const [page, setPage] = useState(1);
  const pageSize = 6;
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const visibleItems = items.slice((safePage - 1) * pageSize, safePage * pageSize);
  if (!items.length) {
    return (
      <div className="py-8 text-center text-sm text-slate-400">
        <Receipt className="mx-auto size-8 text-slate-300 mb-2" />
        <p className="m-0 font-medium">{F3.noPayments}</p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <ul className="m-0 list-none space-y-3 p-0">
        {visibleItems.map((item) => (
          <li
            key={item.id}
            className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-4 transition-all hover:border-slate-200/80 hover:bg-slate-50"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="grid size-8 shrink-0 place-items-center rounded-lg border border-slate-200/70 bg-white text-primary shadow-2xs">
                  <Receipt size={16} />
                </div>
                <div>
                  <span className="block font-mono text-xs font-bold text-slate-800">
                    {item.paymentCode}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                    <Clock size={12} className="text-slate-400" />
                    <span>{new Date(item.paidAt ?? item.createdAt).toLocaleString("vi-VN")}</span>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {F3.paid}
                  </span>
                  <strong className="text-base font-extrabold text-[#165f4d]">
                    {money(item.totalAmount)}
                  </strong>
                </div>
                <StatusBadge value={item.status} />
              </div>
            </div>

            {item.refundedAt && item.refundAmount && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-1.5 text-xs text-amber-900">
                <span className="font-semibold">
                  {F3.refunded}: <strong>{money(item.refundAmount)}</strong>
                  {item.refundReason ? ` · ${item.refundReason}` : ""}
                </span>
                <span className="text-[11px] text-amber-700">
                  {new Date(item.refundedAt).toLocaleString("vi-VN")}
                </span>
              </div>
            )}
          </li>
        ))}
      </ul>
      {items.length > pageSize && (
        <div className="pt-2">
          <ListPagination
            label={F3.payments}
            page={safePage}
            pageSize={pageSize}
            total={items.length}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
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
      const uploaded = await api.rentalDocuments.upload(bookingId, parsed);
      if (uploaded.status === "UPLOADED") {
        try {
          return await api.rentalDocuments.issue(bookingId, uploaded.id, {
            expectedCurrentIssuedId: query.data?.find((d) => d.currentIssued)?.id ?? null,
          });
        } catch {
          return uploaded;
        }
      }
      return uploaded;
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
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                    doc.status === "ISSUED"
                      ? "border-emerald-200/70 bg-emerald-50 text-emerald-800"
                      : "border-amber-200/70 bg-amber-50 text-amber-800"
                  }`}
                >
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
