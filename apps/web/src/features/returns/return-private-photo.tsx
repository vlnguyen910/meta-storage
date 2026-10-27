"use client";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { F3 } from "./integration.messages";
import { useFlow3Identity } from "./use-flow3-identity";

export function ReturnPrivatePhoto({
  requestId,
  photoId,
  inspectionId,
  filename,
}: {
  requestId: string;
  photoId: string;
  inspectionId?: string;
  filename: string;
}) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const identity = useFlow3Identity();
  const query = useQuery({
    queryKey: ["returns", "private-photo", identity, requestId, inspectionId, photoId],
    queryFn: ({ signal }) =>
      inspectionId
        ? api.returnActions.photo(requestId, inspectionId, photoId, signal)
        : api.returnActions.evidence(requestId, photoId, signal),
    enabled: open,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  return (
    <div className="space-y-2 min-w-0">
      <Button variant="outline" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {open ? F3.close : F3.photo}
      </Button>
      <span className="block break-all text-xs text-slate-600">{filename}</span>
      {open && (
        <>
          {query.isPending && <p role="status">{F3.loading}</p>}
          {query.data && !failed && (
            <Image
              unoptimized
              src={query.data.url}
              alt={filename}
              width={480}
              height={320}
              onError={() => setFailed(true)}
              className="max-h-80 w-full rounded border border-slate-200 object-contain"
            />
          )}
          {(query.isError || failed) && (
            <div>
              <p role="alert">{F3.photoExpired}</p>
              <Button
                variant="outline"
                onClick={() => {
                  setFailed(false);
                  void query.refetch();
                }}
              >
                {F3.retry}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
