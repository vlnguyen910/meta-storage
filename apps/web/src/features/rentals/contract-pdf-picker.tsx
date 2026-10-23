"use client";
import { CONTRACT_PDF_MAX_BYTES } from "@metastorage/contracts";
import { FileUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { F3 } from "@/features/returns/integration.messages";
import { CONTRACT_UI as C } from "./contract.messages";

export function ContractPdfPicker({
  file,
  onSelect,
  disabled,
}: {
  file: File | null;
  onSelect: (file: File | null) => void;
  disabled: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState("");
  const [inlineSupported, setInlineSupported] = useState(false);
  const valid = Boolean(
    file && file.size > 0 && file.size <= CONTRACT_PDF_MAX_BYTES && file.type === "application/pdf",
  );
  useEffect(() => {
    if (!file || !valid) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setInlineSupported(navigator.pdfViewerEnabled === true);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file, valid]);
  return (
    <div className="space-y-3">
      <p className="font-semibold text-sm">{F3.file}</p>
      <input
        ref={input}
        type="file"
        hidden
        accept="application/pdf"
        aria-label={C.select}
        className="sr-only"
        tabIndex={-1}
        disabled={disabled}
        onChange={(event) => {
          onSelect(event.target.files?.[0] ?? null);
          event.target.value = "";
        }}
      />
      <button
        type="button"
        aria-label={file ? C.replace : C.select}
        disabled={disabled}
        onClick={() => input.current?.click()}
        className="flex min-h-28 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded border-2 border-dashed border-[#8da99d] bg-emerald-50/40 p-5 text-center text-primary transition-colors hover:border-primary hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60"
      >
        <FileUp aria-hidden="true" size={26} />
        <strong>{file ? C.replace : C.select}</strong>
        <span className="max-w-xl text-sm text-slate-700">{C.selectHelp}</span>
      </button>
      {file && (
        <div className="space-y-3 rounded border border-[#BFCAC4] bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <strong className="break-all">{file.name}</strong>
              <p className="text-sm text-slate-600">
                {file.size < 1048576
                  ? `${Math.ceil(file.size / 1024).toLocaleString("vi-VN")} KB`
                  : `${(file.size / 1048576).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} MB`}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={() => onSelect(null)}
            >
              {C.remove}
            </Button>
          </div>
          {!valid ? (
            <p role="alert" className="text-red-700">
              {F3.badPdf}
            </p>
          ) : (
            <>
              <h3 className="font-semibold">{C.localPreview}</h3>
              {preview && inlineSupported && (
                <iframe
                  src={preview}
                  title={C.localPreview}
                  className="h-72 w-full rounded border border-slate-300 bg-white"
                />
              )}
              <p className="text-sm text-slate-600">
                {inlineSupported ? C.previewHelp : C.previewUnsupported}
              </p>
              {preview && (
                <a
                  href={preview}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center font-semibold text-primary underline"
                >
                  {C.openLocal}
                </a>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
