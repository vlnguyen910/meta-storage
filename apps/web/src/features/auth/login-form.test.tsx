import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast";
import { LoginForm } from "./login-form";

const { login } = vi.hoisted(() => ({ login: vi.fn() }));
const mockReplace = vi.fn();

vi.mock("@/lib/api", () => ({ api: { auth: { login } } }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => new URLSearchParams(),
}));

function renderLoginForm() {
  return render(
    <ToastProvider>
      <LoginForm />
    </ToastProvider>,
  );
}

describe("LoginForm", () => {
  beforeEach(() => {
    login.mockReset();
    mockReplace.mockReset();
  });

  it("renders the Figma login form correctly", () => {
    renderLoginForm();

    expect(screen.getByRole("heading", { name: "Đăng nhập tài khoản storeX" })).toBeInTheDocument();
    expect(screen.getByLabelText("Địa chỉ Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Mật khẩu")).toBeInTheDocument();
    expect(screen.getByText("Ghi nhớ đăng nhập trên thiết bị này")).toBeInTheDocument();
    expect(screen.getByText("Quên mật khẩu?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đăng nhập" })).toBeInTheDocument();
  });

  it("toggles password visibility when clicking toggle button", async () => {
    renderLoginForm();

    const passwordInput = screen.getByLabelText("Mật khẩu");
    expect(passwordInput).toHaveAttribute("type", "password");

    const toggleButton = screen.getByRole("button", { name: /Hiện mật khẩu/i });
    fireEvent.click(toggleButton);

    expect(passwordInput).toHaveAttribute("type", "text");

    const hideButton = screen.getByRole("button", { name: /Ẩn mật khẩu/i });
    fireEvent.click(hideButton);

    expect(passwordInput).toHaveAttribute("type", "password");
  });

  it("submits the login form and redirects on success", async () => {
    const user = userEvent.setup();
    login.mockResolvedValue({
      user: {
        id: "user-1",
        name: "Test Customer",
        email: "customer@metastorage.test",
        role: "CUSTOMER",
      },
    });

    renderLoginForm();

    const emailInput = screen.getByLabelText("Địa chỉ Email");
    const passwordInput = screen.getByLabelText("Mật khẩu");
    const submitBtn = screen.getByRole("button", { name: "Đăng nhập" });

    await user.clear(emailInput);
    await user.type(emailInput, "customer@metastorage.test");
    await user.clear(passwordInput);
    await user.type(passwordInput, "Demo@123");
    await user.click(submitBtn);

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith({
        email: "customer@metastorage.test",
        password: "Demo@123",
      });
      expect(mockReplace).toHaveBeenCalledWith("/customer/dashboard");
    });
  });
});
