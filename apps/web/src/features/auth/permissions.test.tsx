import { type Session, UserRole } from "@metastorage/contracts";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { Permission } from "@/config/access-control";
import { authStore } from "./auth-store";
import { Can } from "./permissions";

const customerSession: Session = {
  user: {
    assignedFacilityId: null,
    id: "customer-1",
    name: "Test Customer",
    email: "customer@test.vn",
    role: UserRole.STORAGE_CUSTOMER,
    status: "ACTIVE",
    phone: null,
    emailVerified: true,
    image: null,
    passwordHash: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  },
  accessToken: "access:test",
  refreshToken: "refresh:test",
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
};

describe("Can", () => {
  beforeEach(() => authStore.getState().setSession(customerSession));

  it("renders an allowed action", () => {
    render(<Can permission={Permission.CREATE_RESERVATION}>Đặt kho</Can>);
    expect(screen.getByText("Đặt kho")).toBeInTheDocument();
  });

  it("hides a forbidden action", () => {
    render(<Can permission={Permission.MANAGE_USERS}>Quản lý người dùng</Can>);
    expect(screen.queryByText("Quản lý người dùng")).not.toBeInTheDocument();
  });
});
