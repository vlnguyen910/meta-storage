import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isMockMode } from "@/config/api-mode";
import { MOCK_MESSAGES } from "@/mocks/mock.messages";
import { AUTH_MESSAGES } from "./auth.messages";
import { RegisterForm } from "./register-form";

const { registerCustomer } = vi.hoisted(() => ({ registerCustomer: vi.fn() }));

vi.mock("@/lib/api", () => ({ api: { auth: { registerCustomer } } }));

describe("RegisterForm", () => {
  beforeEach(() => registerCustomer.mockReset());

  it("submits the shared signup fields and shows the email confirmation state", async () => {
    const user = userEvent.setup();
    registerCustomer.mockResolvedValue({ message: "sent" });
    render(<RegisterForm />);

    await user.type(screen.getByLabelText(/Họ và tên/i), "Nguyễn An");
    await user.type(screen.getByLabelText(/Địa chỉ Email/i), "AN@example.com");
    await user.type(screen.getByLabelText(/Số điện thoại/i), "0901234567");
    await user.type(screen.getByLabelText(/^Mật khẩu/i), "Customer#123");
    await user.type(screen.getByLabelText(/Xác nhận lại mật khẩu/i), "Customer#123");

    // Real-time password match indicator should be displayed
    expect(screen.getByText(AUTH_MESSAGES.passwordsMatch)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: AUTH_MESSAGES.registerButton }));

    await waitFor(() =>
      expect(registerCustomer).toHaveBeenCalledWith({
        name: "Nguyễn An",
        email: "an@example.com",
        phone: "0901234567",
        password: "Customer#123",
        confirmPassword: "Customer#123",
        callbackTarget: "web",
      }),
    );
    expect(
      screen.getByRole("heading", { name: isMockMode ? MOCK_MESSAGES.registeredTitle : AUTH_MESSAGES.checkEmailTitle }),
    ).toBeInTheDocument();
  });

  it("validates password confirmation before calling the API and shows mismatch indicator", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText(/^Mật khẩu/i), "Customer#123");
    await user.type(screen.getByLabelText(/Xác nhận lại mật khẩu/i), "Different#123");

    // Mismatch indicator should appear
    expect(screen.getByText(AUTH_MESSAGES.passwordsDoNotMatch)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: AUTH_MESSAGES.registerButton }));

    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
    expect(registerCustomer).not.toHaveBeenCalled();
  });

  it("toggles password visibility when eye icon is clicked", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    const passwordInput = screen.getByLabelText(/^Mật khẩu/i);
    expect(passwordInput).toHaveAttribute("type", "password");

    const showButtons = screen.getAllByRole("button", { name: AUTH_MESSAGES.showPassword });
    const toggleButton = showButtons[0];
    expect(toggleButton).toBeDefined();
    if (toggleButton) {
      await user.click(toggleButton);
    }
    expect(passwordInput).toHaveAttribute("type", "text");

    const hideButtons = screen.getAllByRole("button", { name: AUTH_MESSAGES.hidePassword });
    const hideButton = hideButtons[0];
    expect(hideButton).toBeDefined();
    if (hideButton) {
      await user.click(hideButton);
    }
    expect(passwordInput).toHaveAttribute("type", "password");
  });

  it("displays server error message on registration failure", async () => {
    const user = userEvent.setup();
    const error = Object.assign(new Error("Email already registered"), {
      response: { data: { message: "Email already registered" } },
    });
    registerCustomer.mockRejectedValueOnce(error);
    render(<RegisterForm />);

    await user.type(screen.getByLabelText(/Họ và tên/i), "Nguyễn An");
    await user.type(screen.getByLabelText(/Địa chỉ Email/i), "exist@example.com");
    await user.type(screen.getByLabelText(/Số điện thoại/i), "0901234567");
    await user.type(screen.getByLabelText(/^Mật khẩu/i), "Customer#123");
    await user.type(screen.getByLabelText(/Xác nhận lại mật khẩu/i), "Customer#123");

    await user.click(screen.getByRole("button", { name: AUTH_MESSAGES.registerButton }));

    expect(await screen.findByText("Email already registered")).toBeInTheDocument();
  });
});
