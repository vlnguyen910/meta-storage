"use client";

import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { formatDateTime } from "@/lib/format";
import { FACILITY_OVERVIEW_MESSAGES as M } from "./facility-overview.messages";
import type { FacilityOverviewProps } from "./facility-overview.types";
import { FLOW } from "./flow.messages";
import { FlowButton, FlowHeading, Panel, Pill, titleClass } from "./flow-ui";
import { useDispatch } from "./use-dispatch";

export function FacilityOverview({
  facilityId,
  facilityName,
  staff = false,
}: FacilityOverviewProps) {
  const state = useDispatch(facilityId, staff);
  const root = staff ? "/staff" : "/facility-manager";
  if (state.query.isLoading) return <LoadingState label={FLOW.loading} />;
  if (state.query.isError)
    return <ErrorState message={FLOW.listError} onRetry={() => state.query.refetch()} />;
  const cards = [
    [FLOW.total, state.bookings.length],
    [FLOW.needsUnit, state.count("NEEDS_UNIT")],
    [
      FLOW.needsStaff,
      state.bookings.filter((booking) => booking.status === "CONFIRMED" && !booking.assignedStaff)
        .length,
    ],
    [FLOW.waiting, state.count("READY")],
    [FLOW.inspecting, state.count("INSPECTING")],
    [FLOW.readyHandover, state.count("READY_HANDOVER")],
    [FLOW.pendingAccess, state.count("CHECKED_IN")],
  ] as const;
  const recent = [...state.bookings]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 5);
  return (
    <>
      <FlowHeading
        title={FLOW.overview}
        description={`${facilityName ?? FLOW.noFacility} · ${staff ? M.staffDescription : M.description}`}
        actions={
          <FlowButton
            variant="secondary"
            onClick={() => state.query.refetch()}
            loading={state.query.isFetching}
            icon={<RefreshCw size={18} />}
          >
            {FLOW.refresh}
          </FlowButton>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value]) => (
          <Panel key={label}>
            <p className="text-sm text-[#404945]">{label}</p>
            <p className={`${titleClass} mt-3 text-4xl`}>{value}</p>
          </Panel>
        ))}
      </div>
      <Panel>
        <h2 className={`${titleClass} text-xl`}>{M.recent}</h2>
        {recent.length === 0 ? (
          <p className="mt-4">{M.noBookings}</p>
        ) : (
          <ul className="mt-4 divide-y divide-[#bfc9c4]">
            {recent.map((booking) => (
              <li
                key={booking.id}
                className="flex flex-wrap items-center justify-between gap-3 py-4"
              >
                <div>
                  <Link
                    className="font-semibold text-[#003b2f] underline"
                    href={`${root}/check-in?bookingCode=${encodeURIComponent(booking.bookingCode)}`}
                  >
                    {booking.bookingCode}
                  </Link>
                  <p className="mt-1">{booking.contactName}</p>
                  <p className="mt-1 text-xs text-[#404945]">
                    {M.createdAt}: {formatDateTime(booking.createdAt)}
                  </p>
                </div>
                <Pill tone="neutral">{FLOW.statusLabels[booking.status] ?? booking.status}</Pill>
              </li>
            ))}
          </ul>
        )}
        <Link
          className="mt-4 inline-block font-semibold text-[#003b2f] underline"
          href={`${root}/dashboard`}
        >
          {M.open}
        </Link>
      </Panel>
    </>
  );
}
