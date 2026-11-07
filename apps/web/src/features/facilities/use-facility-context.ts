"use client";

import { useCallback, useEffect, useState } from "react";
import { useMyFacilityAssignments } from "../check-in/hooks";
import type { FacilityContextState } from "./facility-context.types";

const FACILITY_STORAGE_KEY = "metastorage.fm.activeFacilityId";

export function useFacilityContext(): FacilityContextState {
  const { data: assignments, isLoading, isError, refetch } = useMyFacilityAssignments();
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      try {
        return sessionStorage.getItem(FACILITY_STORAGE_KEY) ?? "";
      } catch {
        return "";
      }
    }
    return "";
  });

  const activeAssignments = assignments?.filter((item) => item.isActive) ?? [];
  const isSingleFacility = activeAssignments.length === 1;
  const isMultiFacility = activeAssignments.length > 1;

  // Resolve current facility
  const matchedAssignment = activeAssignments.find((a) => a.facilityId === selectedFacilityId);
  const currentFacility = matchedAssignment ?? activeAssignments[0];
  const currentFacilityId = currentFacility?.facilityId ?? "";

  // Synchronize storage when resolved or changed
  useEffect(() => {
    if (currentFacilityId && typeof window !== "undefined") {
      try {
        sessionStorage.setItem(FACILITY_STORAGE_KEY, currentFacilityId);
      } catch {
        // Ignore storage write errors in private browsing/sandboxes
      }
    }
  }, [currentFacilityId]);

  const switchFacility = useCallback(
    (facilityId: string) => {
      const target = activeAssignments.find((a) => a.facilityId === facilityId);
      if (target) {
        setSelectedFacilityId(target.facilityId);
        if (typeof window !== "undefined") {
          try {
            sessionStorage.setItem(FACILITY_STORAGE_KEY, target.facilityId);
          } catch {
            // Ignore storage write errors
          }
        }
      }
    },
    [activeAssignments],
  );

  return {
    assignments: assignments ?? [],
    activeAssignments,
    currentFacility,
    currentFacilityId,
    isSingleFacility,
    isMultiFacility,
    isLoading,
    isError,
    refetch,
    switchFacility,
  };
}
