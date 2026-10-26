"use client";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Warehouse } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useAuthStore } from "@/features/auth/auth-store";
import { useFacilityTaskDetail } from "@/features/facility-management/hooks";
import { TaskDetails } from "@/features/facility-management/task-workspace";
import { RentalDocuments } from "@/features/rentals/rental-records";
import { api } from "@/lib/api";
import { STAFF_WORK as M } from "./staff-work.messages";

export function StaffTaskDetailScreen({ taskId }: { taskId: string }) {
  const router = useRouter();
  const query = useFacilityTaskDetail(taskId);
  const actor = useAuthStore((s) => s.session?.user.id);
  const unitId = query.data?.storageUnitId;
  const unit = useQuery({
    queryKey: ["flow5", actor, "staff-task-unit", taskId, unitId],
    queryFn: () => api.flow5.units.get(unitId ?? ""),
    enabled: Boolean(unitId && query.data?.assignedStaffId === actor),
  });
  return (
    <div className="space-y-5">
      <Link
        href="/staff/tasks"
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-emerald-900"
      >
        <ArrowLeft size={17} aria-hidden="true" />
        {M.back}
      </Link>
      {query.isPending ? (
        <LoadingState variant="detail" />
      ) : query.isError || query.data?.assignedStaffId !== actor ? (
        <ErrorState message={M.loadError} onRetry={() => query.refetch()} />
      ) : (
        <>
          {unitId && (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
              <Warehouse size={22} className="text-emerald-800" aria-hidden="true" />
              <div>
                <p className="text-xs font-medium text-slate-600">{M.unit}</p>
                <p className="mt-1 font-semibold text-emerald-950">
                  {unit.data?.code ?? (unit.isError ? M.unitUnavailable : "…")}
                </p>
              </div>
            </div>
          )}
          {query.data.type === "PRINT_DOCUMENT" && (
            <section className="space-y-3">
              <p className="text-sm text-slate-600">
                {query.data.bookingId ? M.printContext : M.noBooking}
              </p>
              {query.data.bookingId && (
                <RentalDocuments bookingId={query.data.bookingId} handover />
              )}
            </section>
          )}
          <TaskDetails id={taskId} manager={false} onClose={() => router.push("/staff/tasks")} />
        </>
      )}
    </div>
  );
}
