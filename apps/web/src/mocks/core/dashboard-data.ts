import { type DashboardSummary, StorageUnitStatus, UserRole } from "@metastorage/contracts";
import { businessOperationsDashboard } from "../seeds/dashboards/business-operations.dashboard";
import { facilityManagerDashboard } from "../seeds/dashboards/facility-manager.dashboard";
import { facilityStaffDashboard } from "../seeds/dashboards/facility-staff.dashboard";
import { systemAdministratorDashboard } from "../seeds/dashboards/system-administrator.dashboard";
import type { MockDatabase, MockUser } from "../types";

export function dashboardFor(
  user: MockUser,
  database: MockDatabase,
  facilityId?: string,
): DashboardSummary {
  const targetFacilityId =
    facilityId && user.assignedFacilityIds.includes(facilityId)
      ? facilityId
      : user.assignedFacilityIds[0];

  const assignedFacility = database.facilities.find((facility) =>
    targetFacilityId
      ? facility.id === targetFacilityId
      : user.assignedFacilityIds.includes(facility.id),
  );

  if (user.role === UserRole.FACILITY_STAFF) {
    return facilityStaffDashboard(assignedFacility?.name);
  }

  if (user.role === UserRole.FACILITY_MANAGER) {
    const scopedUnits = targetFacilityId
      ? database.units.filter((unit) => unit.facilityId === targetFacilityId)
      : database.units.filter((unit) => user.assignedFacilityIds.includes(unit.facilityId));
    const availableUnits = scopedUnits.filter(
      (unit) => unit.status === StorageUnitStatus.AVAILABLE,
    ).length;
    return facilityManagerDashboard(assignedFacility?.name, availableUnits, scopedUnits.length);
  }

  if (user.role === UserRole.BUSINESS_OPERATIONS_MANAGER) {
    const availableUnits = database.units.filter(
      (unit) => unit.status === StorageUnitStatus.AVAILABLE,
    ).length;
    return businessOperationsDashboard(database, availableUnits);
  }

  return systemAdministratorDashboard();
}
