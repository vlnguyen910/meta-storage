import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GlobalLoadingProvider } from "@/components/providers/global-loading-provider";
import { AUTH_MESSAGES as m } from "./auth.messages";
import { VerifyEmailView } from "./verify-email-view";

const { resendVerificationEmail } = vi.hoisted(() => ({ resendVerificationEmail: vi.fn() }));
const params = new Map<string, string>();
vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: (key: string) => params.get(key) ?? null }),
}));
vi.mock("@/lib/api", () => ({ api: { auth: { resendVerificationEmail } } }));
describe("email verification recovery", () => {
  beforeEach(() => {
    params.clear();
    resendVerificationEmail.mockReset();
  });
  it("does not claim verification success or show a simulator without evidence", () => {
    render(
      <GlobalLoadingProvider>
        <VerifyEmailView />
      </GlobalLoadingProvider>,
    );
    expect(screen.getByRole("heading", { name: m.verificationCheck })).toBeInTheDocument();
    expect(screen.queryByText(m.successTitle)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Token valid/ })).not.toBeInTheDocument();
  });
  it("keeps token errors even if status=success is supplied", () => {
    params.set("error", "invalid_token");
    params.set("status", "success");
    render(
      <GlobalLoadingProvider>
        <VerifyEmailView />
      </GlobalLoadingProvider>,
    );
    expect(screen.getByRole("heading", { name: m.failureTitle })).toBeInTheDocument();
    expect(screen.queryByText(m.successTitle)).not.toBeInTheDocument();
  });
  it("resends verification with the entered email and trusted local callback", async () => {
    const user = userEvent.setup();
    resendVerificationEmail.mockResolvedValue(undefined);
    render(
      <GlobalLoadingProvider>
        <VerifyEmailView />
      </GlobalLoadingProvider>,
    );
    await user.type(screen.getByLabelText(m.emailLabel), "review@example.test");
    await user.click(screen.getByRole("button", { name: m.resendVerifyEmail }));
    expect(resendVerificationEmail).toHaveBeenCalledWith(
      "review@example.test",
      new URL("/verify-email", window.location.origin).toString(),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(m.verificationResent);
    expect(screen.getByRole("button", { name: /45s/ })).toBeDisabled();
  });
  it("shows a retryable error instead of success when resend fails", async () => {
    const user = userEvent.setup();
    resendVerificationEmail.mockRejectedValue(new Error("offline"));
    params.set("error", "expired");
    params.set("email", "review@example.test");
    render(
      <GlobalLoadingProvider>
        <VerifyEmailView />
      </GlobalLoadingProvider>,
    );
    expect(screen.getByRole("heading", { name: m.expiredTitle })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: m.resendVerifyEmail }));
    expect(await screen.findByRole("alert")).toHaveTextContent(m.verificationRequestFailed);
    expect(screen.getByRole("button", { name: m.resendVerifyEmail })).toBeEnabled();
  });
});
