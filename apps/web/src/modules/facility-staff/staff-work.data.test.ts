import type { FacilitySupportTicket, FacilityTaskDetail } from "@metastorage/contracts";
import { describe, expect, it } from "vitest";
import { facilityWork, supportWork } from "./staff-work.data";
import { STAFF_WORK as M } from "./staff-work.messages";

describe("staff-work.data", () => {
  const baseTask: FacilityTaskDetail = {
    id: "task-001",
    facilityId: "fac-001",
    type: "HANDLE_SUPPORT",
    referenceType: "SUPPORT_TICKET",
    referenceId: "4bcadc0a-372a-423f-8ce7-f8f1948cd9e8",
    assignedStaffId: "staff-001",
    assignedStaffName: "Trần Quốc Huy",
    assignedBy: "mgr-001",
    assignerName: "Lê Thu Hà",
    status: "ASSIGNED",
    description: "Hỗ trợ khách hàng đổi mã kho",
    startedAt: null,
    completedAt: null,
    assignedAt: "2026-11-19T08:00:00Z",
    createdAt: "2026-11-19T08:00:00Z",
    updatedAt: "2026-11-19T08:00:00Z",
  };

  const sampleTicket: FacilitySupportTicket = {
    id: "4bcadc0a-372a-423f-8ce7-f8f1948cd9e8",
    facilityId: "fac-001",
    bookingId: "bk-001",
    reservationId: "res-001",
    rentalId: "rent-001",
    storageUnitId: "unit-001",
    paymentId: null,
    category: "UNIT",
    subject: "Yêu cầu kiểm tra khóa ô kho",
    description: "Khách hàng báo ổ khóa bị kẹt không mở được.",
    status: "OPEN",
    priority: "NORMAL",
    version: 1,
    actionDueAt: "2026-11-19T17:00:00Z",
    closedAt: null,
    closureKind: null,
    closeReason: null,
    customer: {
      name: "Nguyễn Văn A",
      email: "vana@example.com",
      phone: "0901234567",
    },
    unitCode: "HCM-01-UT-1M-002",
    bookingCode: "BK-1234-5678",
    createdAt: "2026-11-19T08:00:00Z",
    updatedAt: "2026-11-19T08:00:00Z",
  };

  it("maps support task with linked ticket into kind SUPPORT with customer phone and unit info", () => {
    const item = supportWork(baseTask, sampleTicket);

    expect(item.id).toBe("task:task-001");
    expect(item.kind).toBe("SUPPORT");
    expect(item.group).toBe("pending");
    expect(item.title).toBe("Nguyễn Văn A · Yêu cầu kiểm tra khóa ô kho");
    expect(item.phone).toBe("0901234567");
    expect(item.typeLabel).toBe(M.supportTasksTitle);
    expect(item.statusLabel).toBe(M.assigned);
    expect(item.reference).toContain("HCM-01-UT-1M-002");
    expect(item.reference).toContain("YC-");
    expect(item.href).toBe("/staff/tasks/task-001");
    expect(item.action).toBe(M.openTask);
  });

  it("delegates facilityWork to supportWork when task type is HANDLE_SUPPORT", () => {
    const item = facilityWork(baseTask);

    expect(item.kind).toBe("SUPPORT");
    expect(item.typeLabel).toBe(M.supportTasksTitle);
    expect(item.title).toBe("Hỗ trợ khách hàng đổi mã kho");
    expect(item.reference).toContain("YC-");
  });

  it("marks support task as done when completed or closed", () => {
    const completedTask: FacilityTaskDetail = {
      ...baseTask,
      status: "COMPLETED",
    };
    const item = supportWork(completedTask, sampleTicket);
    expect(item.group).toBe("done");
    expect(item.action).toBe(M.view);
  });
});
