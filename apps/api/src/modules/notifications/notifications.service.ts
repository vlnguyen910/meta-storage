import { randomUUID } from "node:crypto";
import type { StaffTaskAssignedNotification } from "@metastorage/contracts";
import type { Database } from "@metastorage/database";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../auth/auth";
import { FacilityAssignmentsRepository } from "../facilities/facility-assignments.repository";
import { NOTIFICATION_MESSAGES } from "./notifications.messages";
import { NotificationsRepository } from "./notifications.repository";
import type { NotificationConnection } from "./notifications.types";

/** Ephemeral, single-instance delivery. Offline Staff still use assigned-to-me. */
export class NotificationsService {
  private readonly connections = new Map<string, Set<NotificationConnection>>();

  constructor(private readonly db: Database) {}

  connect(userId: string, connection: NotificationConnection) {
    const group = this.connections.get(userId) ?? new Set<NotificationConnection>();
    group.add(connection);
    this.connections.set(userId, group);
    connection.socket.on("error", () => connection.socket.terminate());
    connection.socket.on("close", () => {
      group.delete(connection);
      if (!group.size) this.connections.delete(userId);
    });
  }

  expire() {
    for (const group of this.connections.values()) {
      for (const c of group) {
        if (Date.now() >= c.expiresAt) c.socket.close(1008, NOTIFICATION_MESSAGES.sessionExpired);
      }
    }
  }

  close() {
    for (const group of this.connections.values()) {
      for (const c of group) c.socket.terminate();
    }
    this.connections.clear();
  }

  async assignedAppointment(appointmentId: string, staffId: string) {
    const group = this.connections.get(staffId);
    if (!group?.size) return;
    const event: StaffTaskAssignedNotification = {
      id: randomUUID(),
      type: "STAFF_TASK_ASSIGNED",
      recipientId: staffId,
      bookingId: null,
      appointmentId,
      occurredAt: new Date().toISOString(),
    };
    for (const c of group) {
      // A long-lived socket must not bypass logout, account deactivation or facility revocation.
      const session = await auth.api.getSession({ headers: fromNodeHeaders(c.headers) });
      if (
        !session ||
        session.user.id !== staffId ||
        session.user.status !== "ACTIVE" ||
        session.user.role !== "FACILITY_STAFF" ||
        Date.now() >= c.expiresAt
      ) {
        c.socket.close(1008, NOTIFICATION_MESSAGES.sessionExpired);
        continue;
      }
      const appointment = await new NotificationsRepository(this.db).currentAppointment(
        appointmentId,
      );
      if (!appointment || appointment.staffId !== staffId || appointment.status !== "CONFIRMED")
        return;
      const facility = await new FacilityAssignmentsRepository(this.db).findActiveAssignment(
        appointment.facilityId,
        staffId,
        "FACILITY_STAFF",
      );
      if (facility && c.socket.readyState === 1) c.socket.send(JSON.stringify(event));
    }
  }
}
