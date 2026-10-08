import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_MESSAGES } from "./auth.messages";
import { ForgotPasswordForm } from "./forgot-password-form";

const { forgotPassword } = vi.hoisted(() => ({ forgotPassword: vi.fn() }));

vi.mock("@/lib/api", () => ({ api: { auth: { forgotPassword } } }));

describe("ForgotPasswordForm", () => {
  beforeEach(() => {
    forgotPassword.mockReset();
  });

  it("renders the initial request form correctly", () => {
    render(<ForgotPasswordForm />);

    expect(
      screen.getByRole("heading", { name: AUTH_MESSAGES.forgotPasswordTitle }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Địa chỉ Email đăng ký/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: AUTH_MESSAGES.forgotPasswordSubmitBtn }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: AUTH_MESSAGES.backToLogin })).toBeInTheDocument();
  });

  it("submits the form and displays the privacy-preserving sent state", async () => {
    const user = userEvent.setup();
    forgotPassword.mockResolvedValue({ message: "ok" });
    render(<ForgotPasswordForm />);

    const emailInput = screen.getByLabelText(/Địa chỉ Email đăng ký/i);
    await user.type(emailInput, "test@example.com");

    const submitBtn = screen.getByRole("button", {
      name: AUTH_MESSAGES.forgotPasswordSubmitBtn,
    });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(forgotPassword).toHaveBeenCalledWith("test@example.com");
    });

    expect(
      screen.getByRole("heading", { name: AUTH_MESSAGES.forgotPasswordSuccessTitle }),
    ).toBeInTheDocument();
    expect(screen.getByText(AUTH_MESSAGES.securityNoticeTitle)).toBeInTheDocument();
    expect(screen.getByText(AUTH_MESSAGES.didNotReceiveEmailTitle)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Thử lại sau/i })).toBeDisabled();
  });
});
