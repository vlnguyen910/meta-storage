import { randomUUID } from "node:crypto";
import type {
  CustomerAppointmentUpdatedNotification,
  FacilityWorkUpdatedNotification,
  StaffTaskAssignedNotification,
  StaffWorkUpdatedNotification,
} from "@metastorage/contracts";
import type { Database } from "@metastorage/database";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../auth/auth";
import { FacilityAssignmentsRepository } from "../facilities/facility-assignments.repository";
import { NOTIFICATION_MESSAGES } from "./notifications.messages";
import { NotificationsRepository } from "./notifications.repository";
import type { NotificationConnection } from "./notifications.types";

/** Ephemeral, single-instance delivery. Clients refetch after reconnecting. */
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

  private async sendUpdate(
    event: StaffWorkUpdatedNotification | CustomerAppointmentUpdatedNotification,
  ) {
    const role = event.type === "STAFF_WORK_UPDATED" ? "FACILITY_STAFF" : "CUSTOMER";
    for (const c of this.connections.get(event.recipientId) ?? []) {
      if (c.role !== role) continue;
      try {
        const session = await auth.api.getSession({ headers: fromNodeHeaders(c.headers) });
        if (
          !session ||
          session.user.id !== event.recipientId ||
          session.user.status !== "ACTIVE" ||
          session.user.role !== role ||
          Date.now() >= c.expiresAt
        ) {
          c.socket.close(1008, NOTIFICATION_MESSAGES.sessionExpired);
          continue;
        }
        if (
          event.type === "STAFF_WORK_UPDATED" &&
          !(await new FacilityAssignmentsRepository(this.db).findActiveAssignment(
            event.facilityId,
            event.recipientId,
            "FACILITY_STAFF",
          ))
        )
          continue;
        if (c.socket.readyState === 1) c.socket.send(JSON.stringify(event));
      } catch {
        console.error("Work update delivery failed");
      }
    }
  }

  /** Previous assignees receive only an invalidation, so their lists remove transferred work. */
  async appointmentChanged(appointmentId: string, previousStaffId?: string | null) {
    try {
      const appointment = await new NotificationsRepository(this.db).currentAppointment(
        appointmentId,
      );
      if (!appointment) return;
      await this.managerWorkChanged(appointment.facilityId);
      const fields = { id: randomUUID(), occurredAt: new Date().toISOString(), appointmentId };
      await this.sendUpdate({
        ...fields,
        type: "CUSTOMER_APPOINTMENT_UPDATED",
        recipientId: appointment.customerId,
      });
      for (const staffId of new Set([appointment.staffId, previousStaffId])) {
        if (staffId)
          await this.sendUpdate({
            ...fields,
            type: "STAFF_WORK_UPDATED",
            recipientId: staffId,
            facilityId: appointment.facilityId,
          });
      }
    } catch {
      console.error("Appointment update delivery failed");
    }
  }

  async taskChanged(taskId: string, previousStaffId?: string | null, completesAppointment = false) {
    try {
      const task = await new NotificationsRepository(this.db).currentTask(taskId);
      if (!task) return;
      if (completesAppointment && task.referenceType === "APPOINTMENT") {
        await this.appointmentChanged(task.referenceId, previousStaffId);
        return;
      }
      await this.managerWorkChanged(task.facilityId);
      for (const staffId of new Set([task.assignedStaffId, previousStaffId])) {
        if (staffId)
          await this.sendUpdate({
            id: randomUUID(),
            type: "STAFF_WORK_UPDATED",
            recipientId: staffId,
            facilityId: task.facilityId,
            taskId,
            occurredAt: new Date().toISOString(),
          });
      }
    } catch {
      console.error("Task update delivery failed");
    }
  }

  async reservationAppointmentsChanged(reservationId: string) {
    try {
      for (const appointment of await new NotificationsRepository(
        this.db,
      ).appointmentsForReservation(reservationId))
        await this.appointmentChanged(appointment.id);
    } catch {
      console.error("Reservation appointment update delivery failed");
    }
  }

  /** Call only after the owning transaction commits. Delivery must not fail the mutation. */
  async managerWorkChanged(facilityId: string) {
    const event: FacilityWorkUpdatedNotification = {
      id: randomUUID(),
      type: "FACILITY_WORK_UPDATED",
      facilityId,
      occurredAt: new Date().toISOString(),
    };
    const assignments = new FacilityAssignmentsRepository(this.db);
    for (const [userId, group] of this.connections) {
      for (const c of group) {
        if (c.role !== "FACILITY_MANAGER") continue;
        try {
          const session = await auth.api.getSession({ headers: fromNodeHeaders(c.headers) });
          if (
            !session ||
            session.user.id !== userId ||
            session.user.status !== "ACTIVE" ||
            session.user.role !== "FACILITY_MANAGER" ||
            Date.now() >= c.expiresAt
          ) {
            c.socket.close(1008, NOTIFICATION_MESSAGES.sessionExpired);
            continue;
          }
          const assignment = await assignments.findActiveAssignment(
            facilityId,
            userId,
            "FACILITY_MANAGER",
          );
          if (assignment && c.socket.readyState === 1) c.socket.send(JSON.stringify(event));
        } catch {
          console.error("Manager work update delivery failed");
        }
      }
    }
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
