import { type SessionUser, UserRole } from "@metastorage/contracts";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import LoginCompletePage from "@/app/login/complete/page";
import { ProtectedArea } from "@/components/layout/protected-area";
import { GlobalLoadingProvider } from "@/components/providers/global-loading-provider";
import { ToastProvider } from "@/components/ui/toast";
import { AUTH_MESSAGES } from "./auth.messages";
import { useAuthStore } from "./auth-store";
import { GoogleSignInButton } from "./google-sign-in-button";
import { LoginForm } from "./login-form";

const mockReplace = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => "/test-path",
}));

const mockSignInSocial = vi.fn();
const mockLinkSocial = vi.fn();
const mockMe = vi.fn();
const mockLogin = vi.fn();
const mockLogout = vi.fn();

vi.mock("@/lib/api", () => ({
  api: {
    auth: {
      signInSocial: (...args: unknown[]) => mockSignInSocial(...args),
      linkSocial: (...args: unknown[]) => mockLinkSocial(...args),
      me: (...args: unknown[]) => mockMe(...args),
      login: (...args: unknown[]) => mockLogin(...args),
      logout: (...args: unknown[]) => mockLogout(...args),
    },
  },
}));

function renderWithProviders(ui: React.ReactNode) {
  return render(
    <GlobalLoadingProvider>
      <ToastProvider>{ui}</ToastProvider>
    </GlobalLoadingProvider>,
  );
}

const createMockUser = (overrides: Partial<SessionUser> = {}): SessionUser => ({
  id: "test-user-id",
  name: "Test User",
  email: "test@example.com",
  emailVerified: true,
  image: null,
  phone: null,
  passwordHash: null,
  role: UserRole.STORAGE_CUSTOMER,
  status: "ACTIVE",
  assignedFacilityId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("Google Authentication and Explicit Linking", () => {
  const originalLocation = window.location;
  const assignMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    useAuthStore.setState({ session: null, hydrated: true, authReady: true });

    Object.defineProperty(window, "location", {
      writable: true,
      value: {
        ...originalLocation,
        origin: "http://localhost:3000",
        assign: assignMock,
        pathname: "/login",
      },
    });
  });

  afterAll(() => {
    Object.defineProperty(window, "location", {
      writable: true,
      value: originalLocation,
    });
  });

  describe("GoogleSignInButton", () => {
    it("calls signInSocial with proper provider, callbackURL, errorCallbackURL and redirects", async () => {
      mockSearchParams = new URLSearchParams({ returnTo: "/customer/storage" });
      mockSignInSocial.mockResolvedValue({
        url: "https://accounts.google.com/o/oauth2/v2/auth?mocked=true",
      });

      renderWithProviders(<GoogleSignInButton />);

      const button = screen.getByRole("button", { name: AUTH_MESSAGES.googleLogin });
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockSignInSocial).toHaveBeenCalledWith({
          provider: "google",
          callbackURL: "http://localhost:3000/login/complete?returnTo=%2Fcustomer%2Fstorage",
          errorCallbackURL: "http://localhost:3000/login?returnTo=%2Fcustomer%2Fstorage",
          disableRedirect: true,
        });
        expect(assignMock).toHaveBeenCalledWith(
          "https://accounts.google.com/o/oauth2/v2/auth?mocked=true",
        );
      });
    });
  });

  describe("LoginCompletePage Callback Handling", () => {
    it("handles successful login callback: calls /me, updates session, and navigates to destination", async () => {
      mockSearchParams = new URLSearchParams({ returnTo: "/customer/dashboard" });
      mockMe.mockResolvedValue(
        createMockUser({
          id: "cust-1",
          name: "Google Customer",
          email: "cust@gmail.com",
          role: UserRole.STORAGE_CUSTOMER,
          status: "ACTIVE",
        }),
      );

      renderWithProviders(<LoginCompletePage />);

      await waitFor(() => {
        expect(mockMe).toHaveBeenCalled();
        expect(useAuthStore.getState().session?.user.email).toBe("cust@gmail.com");
        expect(mockReplace).toHaveBeenCalledWith("/customer/dashboard");
      });
    });

    it("handles OAuth callback failure: displays error and redirects to /login without getting stuck", async () => {
      mockSearchParams = new URLSearchParams({ error: "access_denied" });

      renderWithProviders(<LoginCompletePage />);

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith("/login?error=access_denied");
      });
    });

    it("handles linking callback failure: reports mismatch and returns to user area", async () => {
      useAuthStore.setState({
        session: {
          user: createMockUser({
            id: "mgr-1",
            name: "Facility Manager",
            email: "mgr@storex.test",
            role: UserRole.FACILITY_MANAGER,
            status: "ACTIVE",
            assignedFacilityId: "fac-1",
          }),
        },
      });

      mockSearchParams = new URLSearchParams({
        action: "link",
        error: "email_does_not_match",
      });

      renderWithProviders(<LoginCompletePage />);

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith("/facility-manager/dashboard");
      });
    });

    it("handles successful linking callback: calls /me, shows toast, and preserves session", async () => {
      mockSearchParams = new URLSearchParams({ action: "link" });
      mockMe.mockResolvedValue(
        createMockUser({
          id: "mgr-1",
          name: "Facility Manager",
          email: "mgr@storex.test",
          role: UserRole.FACILITY_MANAGER,
          status: "ACTIVE",
        }),
      );

      renderWithProviders(<LoginCompletePage />);

      await waitFor(() => {
        expect(mockMe).toHaveBeenCalled();
        expect(mockReplace).toHaveBeenCalledWith("/facility-manager/dashboard");
      });
    });
  });

  describe("Unlinked Account Error Flow (account_not_linked)", () => {
    it("displays instructions to log in using existing password method", () => {
      mockSearchParams = new URLSearchParams({ error: "account_not_linked" });

      renderWithProviders(<LoginForm />);

      expect(screen.getByText(AUTH_MESSAGES.accountNotLinkedTitle)).toBeInTheDocument();
      expect(screen.getByText(AUTH_MESSAGES.accountNotLinked)).toBeInTheDocument();
    });

    it("presents an explicit link modal after successful password login and allows user to link", async () => {
      const user = userEvent.setup();
      mockSearchParams = new URLSearchParams({ error: "account_not_linked" });
      mockLogin.mockResolvedValue({
        user: createMockUser({
          id: "existing-user",
          name: "Existing Account",
          email: "existing@gmail.com",
          role: UserRole.STORAGE_CUSTOMER,
        }),
      });
      mockLinkSocial.mockResolvedValue({
        url: "https://accounts.google.com/o/oauth2/v2/auth?link=true",
      });

      renderWithProviders(<LoginForm />);

      const emailInput = screen.getByLabelText("Địa chỉ Email");
      const passwordInput = screen.getByLabelText("Mật khẩu");
      const submitBtn = screen.getByRole("button", { name: "Đăng nhập" });

      await user.clear(emailInput);
      await user.type(emailInput, "existing@gmail.com");
      await user.clear(passwordInput);
      await user.type(passwordInput, "Password123!");
      await user.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(AUTH_MESSAGES.googleLinkTitle)).toBeInTheDocument();
        expect(screen.getByText(AUTH_MESSAGES.googleLinkPromptAfterLogin)).toBeInTheDocument();
      });

      const linkBtn = screen.getByRole("button", { name: AUTH_MESSAGES.linkGoogleAction });
      await user.click(linkBtn);

      await waitFor(() => {
        expect(mockLinkSocial).toHaveBeenCalledWith({
          provider: "google",
          callbackURL:
            "http://localhost:3000/login/complete?action=link&returnTo=%2Fcustomer%2Fdashboard",
          errorCallbackURL:
            "http://localhost:3000/login/complete?action=link&returnTo=%2Fcustomer%2Fdashboard",
          disableRedirect: true,
        });
        expect(assignMock).toHaveBeenCalledWith(
          "https://accounts.google.com/o/oauth2/v2/auth?link=true",
        );
      });
    });

    it("allows user to skip linking modal after password login and proceed to destination", async () => {
      const user = userEvent.setup();
      mockSearchParams = new URLSearchParams({ error: "account_not_linked" });
      mockLogin.mockResolvedValue({
        user: createMockUser({
          id: "existing-user",
          name: "Existing Account",
          email: "existing@gmail.com",
          role: UserRole.STORAGE_CUSTOMER,
        }),
      });

      renderWithProviders(<LoginForm />);

      const emailInput = screen.getByLabelText("Địa chỉ Email");
      const passwordInput = screen.getByLabelText("Mật khẩu");
      const submitBtn = screen.getByRole("button", { name: "Đăng nhập" });

      await user.clear(emailInput);
      await user.type(emailInput, "existing@gmail.com");
      await user.clear(passwordInput);
      await user.type(passwordInput, "Password123!");
      await user.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(AUTH_MESSAGES.googleLinkTitle)).toBeInTheDocument();
      });

      const laterBtn = screen.getByRole("button", { name: AUTH_MESSAGES.linkGoogleLater });
      await user.click(laterBtn);

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith("/customer/dashboard");
      });
    });
  });

  describe("Protected Area and Session Guarding", () => {
    it("does not render children or redirect prematurely when authReady is false", () => {
      useAuthStore.setState({ session: null, hydrated: true, authReady: false });

      renderWithProviders(
        <ProtectedArea allowedRole={UserRole.STORAGE_CUSTOMER} withAppShell={false}>
          <div>Protected Content</div>
        </ProtectedArea>,
      );

      expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it("renders protected content when session is authenticated and role matches", () => {
      useAuthStore.setState({
        session: {
          user: createMockUser({
            id: "cust-1",
            name: "Customer",
            email: "cust@example.test",
            role: UserRole.STORAGE_CUSTOMER,
            status: "ACTIVE",
          }),
        },
        hydrated: true,
        authReady: true,
      });

      renderWithProviders(
        <ProtectedArea allowedRole={UserRole.STORAGE_CUSTOMER} withAppShell={false}>
          <div>Protected Content</div>
        </ProtectedArea>,
      );

      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });

    it("redirects to login when authReady is true but session is null", async () => {
      useAuthStore.setState({ session: null, hydrated: true, authReady: true });

      renderWithProviders(
        <ProtectedArea allowedRole={UserRole.STORAGE_CUSTOMER} withAppShell={false}>
          <div>Protected Content</div>
        </ProtectedArea>,
      );

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalled();
      });
    });
  });
});
