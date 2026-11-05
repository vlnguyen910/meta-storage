"use client";
import { formatReference } from "@metastorage/shared";
import { Building2 } from "lucide-react";
import { Select } from "@/components/ui/form-controls";
import { FACILITY_CONTEXT_MESSAGES } from "./facility-context.messages";
import type { FacilitySwitcherProps } from "./facility-switcher.types";

export function FacilitySwitcher({
  activeAssignments,
  currentFacilityId,
  onSwitchFacility,
  className,
}: FacilitySwitcherProps) {
  if (activeAssignments.length === 0) return null;

  const isMultiFacility = activeAssignments.length > 1;
  const current =
    activeAssignments.find((a) => a.facilityId === currentFacilityId) ?? activeAssignments[0];

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3 text-xs shadow-xs ${
        className ?? ""
      }`}
    >
      <div className="flex items-center gap-2 font-semibold text-ink">
        <Building2 className="h-4 w-4 text-primary" />
        <span>
          {isMultiFacility
            ? FACILITY_CONTEXT_MESSAGES.activeFacilityLabel
            : FACILITY_CONTEXT_MESSAGES.singleFacilityLabel}
        </span>
        {!isMultiFacility && (
          <span className="rounded-md bg-primary-soft px-2.5 py-1 font-bold text-primary">
            {current?.facilityName ||
              current?.facilityCode ||
              formatReference(current?.facilityId, "CS")}
          </span>
        )}
      </div>

      {isMultiFacility && (
        <div className="flex items-center gap-2">
          <Select
            value={currentFacilityId}
            onChange={(e) => onSwitchFacility(e.target.value)}
            aria-label={FACILITY_CONTEXT_MESSAGES.switchFacilityPrompt}
            className="min-h-8.5 h-8.5 rounded-lg border-line bg-white pl-2.5 pr-8 text-xs font-bold text-ink"
          >
            {activeAssignments.map((assignment) => (
              <option key={assignment.facilityId} value={assignment.facilityId}>
                {assignment.facilityName ||
                  assignment.facilityCode ||
                  formatReference(assignment.facilityId, "CS")}
                {assignment.facilityCode ? ` (${assignment.facilityCode})` : ""}
              </option>
            ))}
          </Select>
        </div>
      )}
    </div>
  );
}
