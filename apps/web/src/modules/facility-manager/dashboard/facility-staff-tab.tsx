"use client";

import { Mail, Phone, Shield, User } from "lucide-react";
import { Card, PageHeader } from "@/components/ui/display";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { useFacilityStaff } from "@/features/check-in/hooks";
import { FACILITY_DASHBOARD_MESSAGES } from "./facility-dashboard.messages";
import type { FacilityStaffTabProps } from "./facility-staff-tab.types";

export function FacilityStaffTab({ facilityId, facilityName }: FacilityStaffTabProps) {
  const { data: staffList, isLoading, isError, refetch } = useFacilityStaff(facilityId);

  if (isLoading) return <LoadingState label={FACILITY_DASHBOARD_MESSAGES.loadingFacility} />;
  if (isError)
    return (
      <ErrorState
        message={FACILITY_DASHBOARD_MESSAGES.errorLoadFacility}
        onRetry={() => refetch()}
      />
    );

  const staffMembers = staffList ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={facilityName ?? "Cơ sở"}
        title={FACILITY_DASHBOARD_MESSAGES.staffSectionTitle}
        description={FACILITY_DASHBOARD_MESSAGES.staffSectionSubtitle}
      />

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
                  <div className="grid size-10 place-items-center rounded-full bg-primary-soft text-primary font-bold">
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
                {member.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    <span>{member.phone}</span>
                  </span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
