"use client";

import { Building2 } from "lucide-react";
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
            {current?.facilityName || current?.facilityCode || current?.facilityId}
          </span>
        )}
      </div>

      {isMultiFacility && (
        <div className="flex items-center gap-2">
          <select
            value={currentFacilityId}
            onChange={(e) => onSwitchFacility(e.target.value)}
            aria-label={FACILITY_CONTEXT_MESSAGES.switchFacilityPrompt}
            className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-bold text-ink outline-hidden transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            {activeAssignments.map((assignment) => (
              <option key={assignment.facilityId} value={assignment.facilityId}>
                {assignment.facilityName || assignment.facilityCode || assignment.facilityId}
                {assignment.facilityCode ? ` (${assignment.facilityCode})` : ""}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
