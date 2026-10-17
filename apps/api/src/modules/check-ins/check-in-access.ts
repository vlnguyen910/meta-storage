import { ForbiddenError } from "../../common/errors/app-error";
import { CHECK_IN_ACCESS_MESSAGES as M } from "./check-in-access.messages";

export type FlowActor = { id: string; role?: string | null };
export function assertAssignedStaff(actor: FlowActor, assignedStaffId: string | null | undefined) {
  if (actor.role !== "FACILITY_STAFF") throw new ForbiddenError(M.staffOnly);
  if (!assignedStaffId || assignedStaffId !== actor.id) throw new ForbiddenError(M.unassigned);
}
export function assertFlowReadAccess(actor: FlowActor, assignedStaffId: string | null | undefined) {
  if (actor.role === "FACILITY_MANAGER") return;
  assertAssignedStaff(actor, assignedStaffId);
}
