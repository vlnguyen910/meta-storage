import { type ClientSession, UserRole } from "@metastorage/contracts";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_MESSAGES } from "@/features/auth/auth.messages";
import { useAuthStore } from "@/features/auth/auth-store";
import ForbiddenPage from "./page";

const mockBack = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: mockBack }),
}));

describe("ForbiddenPage", () => {
  beforeEach(() => {
    mockBack.mockReset();
    useAuthStore.setState({ session: null });
  });

  it("renders forbidden page for unauthenticated user", () => {
    render(<ForbiddenPage />);

    expect(screen.getByRole("heading", { name: AUTH_MESSAGES.forbiddenTitle })).toBeInTheDocument();
    expect(screen.getByText(AUTH_MESSAGES.forbiddenBadge)).toBeInTheDocument();
    expect(screen.getByText(AUTH_MESSAGES.securityPolicyTitle)).toBeInTheDocument();
  });

  it("renders user badge and correct dashboard link for authenticated customer", () => {
    useAuthStore.setState({
      session: {
        user: {
          id: "u-1",
          name: "Nguyễn Văn Minh",
          email: "minh@example.com",
          role: UserRole.STORAGE_CUSTOMER,
        },
      } as unknown as ClientSession,
    });

    render(<ForbiddenPage />);

    expect(screen.getByText("Nguyễn Văn Minh")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: new RegExp(AUTH_MESSAGES.backToDashboard, "i") }),
    ).toHaveAttribute("href", "/customer/dashboard");
  });
});
