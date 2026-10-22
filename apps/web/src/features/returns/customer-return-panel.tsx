"use client";

import Link from "next/link";
import { Card } from "@/components/ui/display";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { customerRoutes } from "@/config/routes";
import { useRentalReturns } from "./hooks";
import { ReturnStatusBadge } from "./return-status-badge";
import { RETURNS_MESSAGES as M } from "./returns.messages";

export function CustomerReturnPanel({
  rentalId,
  rentalStatus,
}: {
  rentalId: string;
  rentalStatus: string;
}) {
  const query = useRentalReturns(rentalId);
  if (query.isLoading) return <LoadingState variant="content" />;
  if (query.isError) return <ErrorState message={M.loadError} onRetry={() => query.refetch()} />;
  const requests = query.data ?? [];
  const openRequest = requests.find((request) =>
    ["PENDING", "CONFIRMED", "INSPECTING", "FAILED"].includes(request.status),
  );
  const canRequest = ["ACTIVE", "RETURN_PENDING", "OVERDUE"].includes(rentalStatus) && !openRequest;
  return (
    <Card className="mt-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="m-0 text-xl font-bold">{M.sectionTitle}</h2>
          <p className="mb-0 mt-1 text-muted">{M.sectionDescription}</p>
        </div>
        {canRequest && (
          <Link
            className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 font-semibold text-white"
            href={customerRoutes.newReturn(rentalId)}
          >
            {M.newRequest}
          </Link>
        )}
      </div>
      {requests.length === 0 ? (
        <p className="mb-0 mt-4 text-muted">{M.noRequest}</p>
      ) : (
        <ul className="mt-4 grid list-none gap-3 p-0">
          {requests.map((request) => (
            <li key={request.id}>
              <Link
                href={customerRoutes.returnRequest(request.id)}
                className="flex min-h-14 flex-wrap items-center justify-between gap-3 rounded-md border border-line p-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <span>
                  <strong>
                    {new Date(request.startsAt).toLocaleString("vi-VN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: request.timezone,
                    })}
                  </strong>
                  <small className="block text-muted">{request.reason}</small>
                </span>
                <ReturnStatusBadge status={request.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
