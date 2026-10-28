"use client";

import { FacilityTaskStatus } from "@metastorage/contracts";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useAuthStore } from "@/features/auth/auth-store";
import {
  managementError,
  useFacilityTaskDetail,
  useUpdateTask,
} from "@/features/facility-management/hooks";
import { formatDateTime } from "@/lib/format";
import { STAFF_WORK as M } from "./staff-work.messages";

export function StaffTaskDetailScreen({ taskId }: { taskId: string }) {
  const router = useRouter();
  const query = useFacilityTaskDetail(taskId);
  const actor = useAuthStore((s) => s.session?.user.id);
  const update = useUpdateTask(taskId);
  if (query.isPending) return <LoadingState variant="detail" />;
  if (query.isError || query.data.assignedStaffId !== actor)
    return <ErrorState message={M.loadError} onRetry={() => query.refetch()} />;
  const task = query.data;
  return (
    <div className="space-y-5">
      <Link
        href="/staff/tasks"
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold"
      >
        <ArrowLeft size={17} />
        {M.back}
      </Link>
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-sm text-slate-600">
          {task.type.replaceAll("_", " ")} · {task.referenceType.replaceAll("_", " ")}
        </p>
        <h1 className="text-2xl font-bold">{task.description || task.referenceId}</h1>
        <p>
          {task.status} · {formatDateTime(task.assignedAt)}
        </p>
        {task.status === "ASSIGNED" && (
          <Button
            disabled={update.isPending}
            onClick={() => update.mutate({ status: FacilityTaskStatus.IN_PROGRESS })}
          >
            {M.openTask}
          </Button>
        )}
        {task.status === "IN_PROGRESS" && (
          <Button
            disabled={update.isPending}
            onClick={() => update.mutate({ status: FacilityTaskStatus.COMPLETED })}
          >
            {M.complete}
          </Button>
        )}
        {update.isError && <p role="alert">{managementError(update.error)}</p>}
        {update.isSuccess && <p role="status">{M.complete}</p>}
        <Button variant="outline" onClick={() => router.push("/staff/tasks")}>
          {M.back}
        </Button>
      </section>
    </div>
  );
}
