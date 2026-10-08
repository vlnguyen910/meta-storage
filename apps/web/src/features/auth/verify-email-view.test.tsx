import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_MESSAGES } from "./auth.messages";
import { VerifyEmailView } from "./verify-email-view";

const mockSearchParams = new Map<string, string>();

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams.get(key) || null,
  }),
}));

describe("VerifyEmailView", () => {
  beforeEach(() => {
    mockSearchParams.clear();
  });

  it("renders success state by default when no error param is present", () => {
    render(<VerifyEmailView />);

    expect(screen.getByRole("heading", { name: AUTH_MESSAGES.successTitle })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: new RegExp(AUTH_MESSAGES.continueToLogin, "i") }),
    ).toBeInTheDocument();
  });

  it("renders failure state when error parameter is present", () => {
    mockSearchParams.set("error", "invalid_token");
    render(<VerifyEmailView />);

    expect(screen.getByRole("heading", { name: AUTH_MESSAGES.failureTitle })).toBeInTheDocument();
    expect(screen.getByText(AUTH_MESSAGES.failureBadge)).toBeInTheDocument();
  });

  it("renders expired state when error is expired", () => {
    mockSearchParams.set("error", "expired");
    render(<VerifyEmailView />);

    expect(screen.getByRole("heading", { name: AUTH_MESSAGES.expiredTitle })).toBeInTheDocument();
    expect(screen.getByText(AUTH_MESSAGES.expiredBadge)).toBeInTheDocument();
  });

  it("switches to pending state when tab is clicked", async () => {
    const user = userEvent.setup();
    render(<VerifyEmailView />);

    const pendingTab = screen.getByRole("button", { name: /1\. Chờ duyệt/i });
    await user.click(pendingTab);

    expect(screen.getByRole("heading", { name: AUTH_MESSAGES.pendingTitle })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(AUTH_MESSAGES.resendVerifyEmail, "i"))).toBeInTheDocument();
  });
});
