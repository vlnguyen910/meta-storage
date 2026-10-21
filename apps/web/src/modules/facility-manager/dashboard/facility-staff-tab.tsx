"use client";

import { ArrowRight, ClipboardList, Mail, Phone, Shield, User, UserCheck } from "lucide-react";
import Link from "next/link";
import { Card, PageHeader } from "@/components/ui/display";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { useFacilityStaff } from "@/features/check-in/hooks";
import { FACILITY_DASHBOARD_MESSAGES } from "./facility-dashboard.messages";
import type { FacilityStaffTabProps } from "./facility-staff-tab.types";

export function FacilityStaffTab({ facilityId, facilityName }: FacilityStaffTabProps) {
  const { data: staffList, isLoading, isError, refetch } = useFacilityStaff(facilityId);

  if (isLoading)
    return <LoadingState label={FACILITY_DASHBOARD_MESSAGES.loadingFacility} variant="table" />;
  if (isError)
    return (
      <ErrorState
        message={FACILITY_DASHBOARD_MESSAGES.errorLoadFacility}
        onRetry={() => refetch()}
      />
    );

  const staffMembers = staffList ?? [];
  const busyCount = staffMembers.filter((m) => (m.assignedTasksCount ?? 0) > 0).length;
  const availableCount = staffMembers.filter((m) => (m.assignedTasksCount ?? 0) === 0).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={facilityName ?? "Cơ sở"}
        title={FACILITY_DASHBOARD_MESSAGES.staffSectionTitle}
        description={FACILITY_DASHBOARD_MESSAGES.staffSectionSubtitle}
      />

      {staffMembers.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-medium uppercase text-muted">
                {FACILITY_DASHBOARD_MESSAGES.staffStatTotal}
              </p>
              <p className="mt-1 text-2xl font-bold text-ink">{staffMembers.length}</p>
            </div>
            <div className="grid size-10 place-items-center rounded-full bg-slate-100 text-slate-700">
              <User className="h-5 w-5" />
            </div>
          </Card>
          <Card className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-medium uppercase text-muted">
                {FACILITY_DASHBOARD_MESSAGES.staffStatBusy}
              </p>
              <p className="mt-1 text-2xl font-bold text-amber-600">{busyCount}</p>
            </div>
            <div className="grid size-10 place-items-center rounded-full bg-amber-50 text-amber-600">
              <ClipboardList className="h-5 w-5" />
            </div>
          </Card>
          <Card className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-medium uppercase text-muted">
                {FACILITY_DASHBOARD_MESSAGES.staffStatAvailable}
              </p>
              <p className="mt-1 text-2xl font-bold text-emerald-600">{availableCount}</p>
            </div>
            <div className="grid size-10 place-items-center rounded-full bg-emerald-50 text-emerald-600">
              <UserCheck className="h-5 w-5" />
            </div>
          </Card>
        </div>
      )}

      {staffMembers.length === 0 ? (
        <EmptyState
          title={FACILITY_DASHBOARD_MESSAGES.staffEmptyTitle}
          description={FACILITY_DASHBOARD_MESSAGES.staffEmptyDesc}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {staffMembers.map((member) => (
            <Card key={member.id} className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-full bg-primary-soft font-bold text-primary">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-ink">{member.name || "Nhân viên"}</h3>
                    <div className="flex items-center gap-1.5 text-xs text-muted">
                      <Mail className="h-3.5 w-3.5" />
                      <span>{member.email || "Chưa có email"}</span>
                    </div>
                  </div>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                    member.isActive
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {member.isActive
                    ? FACILITY_DASHBOARD_MESSAGES.staffActiveBadge
                    : FACILITY_DASHBOARD_MESSAGES.staffInactiveBadge}
                </span>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-xs text-muted">
                <span className="flex items-center gap-1 font-medium">
                  <Shield className="h-3.5 w-3.5 text-secondary" />
                  {FACILITY_DASHBOARD_MESSAGES.staffRoleStaff}
                </span>
                <span
                  className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${
                    (member.assignedTasksCount ?? 0) > 0
                      ? "bg-amber-50 text-amber-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {(member.assignedTasksCount ?? 0) > 0
                    ? `${member.assignedTasksCount} nhiệm vụ`
                    : "Sẵn sàng"}
                </span>
              </div>

              {member.phone && (
                <div className="mt-2 flex items-center gap-1 text-xs text-muted">
                  <Phone className="h-3 w-3" />
                  <span>{member.phone}</span>
                </div>
              )}

              <div className="mt-3 flex justify-end border-t border-dashed border-line pt-2">
                <Link
                  href="?view=check-in"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  {FACILITY_DASHBOARD_MESSAGES.staffViewBookingsAction}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
