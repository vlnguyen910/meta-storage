import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RegisterForm } from "./register-form";

const { registerCustomer } = vi.hoisted(() => ({ registerCustomer: vi.fn() }));

vi.mock("@/lib/api", () => ({ api: { auth: { registerCustomer } } }));

describe("RegisterForm", () => {
  beforeEach(() => registerCustomer.mockReset());

  it("submits the shared signup fields and shows mock account confirmation", async () => {
    const user = userEvent.setup();
    registerCustomer.mockResolvedValue({ message: "sent" });
    render(<RegisterForm />);

    await user.type(screen.getByLabelText("Họ và tên"), "Nguyễn An");
    await user.type(screen.getByLabelText("Email"), "AN@example.com");
    await user.type(screen.getByLabelText("Số điện thoại"), "0901234567");
    await user.type(screen.getByLabelText("Mật khẩu"), "Customer#123");
    await user.type(screen.getByLabelText("Nhập lại mật khẩu"), "Customer#123");
    await user.click(screen.getByRole("button", { name: "Tạo tài khoản" }));

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
    expect(screen.getByRole("heading", { name: "Đã tạo tài khoản mô phỏng" })).toBeInTheDocument();
  });

  it("validates password confirmation before calling the API", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText("Mật khẩu"), "Customer#123");
    await user.type(screen.getByLabelText("Nhập lại mật khẩu"), "Different#123");
    await user.click(screen.getByRole("button", { name: "Tạo tài khoản" }));

    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
    expect(registerCustomer).not.toHaveBeenCalled();
  });
});
