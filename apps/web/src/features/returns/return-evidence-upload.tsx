"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { F3 } from "./integration.messages";
import { integrationError, readFileBase64 } from "./integration-utils";
import { useReturnWrite } from "./use-return-write";

export function ReturnEvidenceUpload({
  requestId,
  version,
  purpose,
  selected,
  onSelect,
}: {
  requestId: string;
  version: number;
  purpose: "REFUND" | "TIME_CORRECTION";
  selected: string[];
  onSelect: (ids: string[]) => void;
}) {
  const [error, setError] = useState("");
  const upload = useReturnWrite(requestId, async (file: File) => {
    if (!file.type.match(/^image\/(jpeg|png|webp)$/) || file.size >= 3 * 1024 * 1024)
      throw new Error("photo-type-size");
    const result = await api.returnActions.uploadEvidence(requestId, {
      expectedVersion: version,
      purpose,
      filename: file.name,
      mimeType: file.type as "image/jpeg" | "image/png" | "image/webp",
      dataBase64: await readFileBase64(file),
    });
    onSelect([...selected, result.id]);
    return result;
  });
  return (
    <div className="space-y-2">
      <label className="grid gap-2 font-semibold text-sm">
        {F3.evidence}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={upload.isPending || selected.length >= 5}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            setError("");
            if (!file) return;
            if (!file.type.match(/^image\/(jpeg|png|webp)$/) || file.size >= 3 * 1024 * 1024) {
              setError(F3.badPhoto);
              return;
            }
            upload.mutate(file);
          }}
        />
      </label>
      <p className="text-xs text-slate-600">
        {F3.evidenceHelp} ({selected.length}/5)
      </p>
      {upload.isPending && <p role="status">{F3.loading}</p>}
      {(error || upload.isError) && (
        <p role="alert" className="text-red-700">
          {error || integrationError(upload.error)}
        </p>
      )}
    </div>
  );
}
