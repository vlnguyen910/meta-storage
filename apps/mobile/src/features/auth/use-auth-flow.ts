import { CustomerSignUpInputSchema } from "@metastorage/contracts";
import { useEffect, useState } from "react";
import { Linking as NativeLinking } from "react-native";
import { api } from "../../lib/api";
import { authClient } from "../../lib/auth-client";
import { AUTH_MESSAGES } from "./auth.messages";
import type { AuthMode, SignupErrors, SignupField, VerifyEmailSimState } from "./auth-screen.types";

const emptyValues = {
  name: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
  terms: true,
  remember: false,
};

export function useAuthFlow() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [values, setValues] = useState(emptyValues);
  const [errors, setErrors] = useState<SignupErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [isSuccessMessage, setIsSuccessMessage] = useState(false);
  const [registeredUser, setRegisteredUser] = useState<{
    name: string;
    email: string;
  } | null>(null);
  const [verifySimState, setVerifySimState] = useState<VerifyEmailSimState>("pending");
  const [resendCountdown, setResendCountdown] = useState(45);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const sessionState = authClient.useSession();

  // Listen to deep link callback
  useEffect(() => {
    function handleUrl(url: string | null) {
      if (!url) return;
      let verificationUrl: URL;
      try {
        verificationUrl = new URL(url);
      } catch {
        return;
      }
      if (
        verificationUrl.protocol !== "metastorage:" ||
        verificationUrl.hostname !== "auth" ||
        verificationUrl.pathname !== "/verified"
      ) {
        return;
      }
      const hasError = verificationUrl.searchParams.has("error");
      if (hasError) {
        setResendCountdown(0);
        setVerifySimState("expired");
        setMessage(AUTH_MESSAGES.verificationLinkInvalid);
        setIsSuccessMessage(false);
      } else {
        setVerifySimState("success");
        setMessage(AUTH_MESSAGES.verificationCallbackReceived);
        setIsSuccessMessage(true);
      }
      setMode("verify-email");
    }

    void NativeLinking.getInitialURL().then(handleUrl);
    const subscription = NativeLinking.addEventListener("url", ({ url }) => handleUrl(url));
    return () => subscription.remove();
  }, []);

  // Countdown timer for email resend
  useEffect(() => {
    if (mode !== "verify-email" || verifySimState !== "pending") return;
    if (resendCountdown <= 0) return;

    const timer = setInterval(() => {
      setResendCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [mode, verifySimState, resendCountdown]);

  function updateField(field: SignupField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setMessage(null);
  }

  function setTerms(accepted: boolean) {
    setValues((current) => ({ ...current, terms: accepted }));
    if (accepted) {
      setErrors((current) => ({ ...current, terms: undefined }));
    }
  }

  function setRemember(remember: boolean) {
    setValues((current) => ({ ...current, remember }));
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setErrors({});
    setMessage(null);
    setIsSuccessMessage(false);
    if (nextMode === "verify-email") {
      setVerifySimState("pending");
      setResendCountdown(45);
    }
  }

  async function submitLogin() {
    setMessage(null);
    setIsSuccessMessage(false);
    setIsSubmitting(true);
    try {
      const email = values.email.trim().toLowerCase();
      const result = await authClient.signIn.email({
        email,
        password: values.password,
      });

      if (result.error?.code === "EMAIL_NOT_VERIFIED") {
        setMessage(AUTH_MESSAGES.loginEmailNotVerified);
        setIsSuccessMessage(false);
        setRegisteredUser({
          name: values.name || "Khách hàng",
          email,
        });
        setVerifySimState("pending");
        setMode("verify-email");
        return;
      }

      if (result.error) {
        throw new Error(result.error.message || AUTH_MESSAGES.requestFailed);
      }
    } catch (error) {
      setMessage(getErrorMessage(error));
      setIsSuccessMessage(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitRegister() {
    setMessage(null);
    setIsSuccessMessage(false);

    if (!values.terms) {
      setErrors((current) => ({
        ...current,
        terms: AUTH_MESSAGES.termsRequired,
      }));
      return;
    }

    const parseResult = CustomerSignUpInputSchema.safeParse({
      name: values.name,
      email: values.email,
      phone: values.phone,
      password: values.password,
      confirmPassword: values.confirmPassword,
      callbackTarget: "mobile",
    });

    if (!parseResult.success) {
      const nextErrors: SignupErrors = {};
      for (const issue of parseResult.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string" && !nextErrors[field as SignupField]) {
          nextErrors[field as SignupField] = issue.message;
        }
      }
      setErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await api.auth.registerCustomer(parseResult.data);
      const email = parseResult.data.email;
      setRegisteredUser({
        name: parseResult.data.name,
        email,
      });
      setVerifySimState("pending");
      setResendCountdown(45);
      setValues((current) => ({
        ...current,
        password: "",
        confirmPassword: "",
      }));
      setMode("verify-email");
    } catch (error) {
      setMessage(getErrorMessage(error));
      setIsSuccessMessage(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitForgotPassword() {
    if (!CustomerSignUpInputSchema.shape.email.safeParse(values.email).success) {
      setMessage(AUTH_MESSAGES.invalidEmail);
      setIsSuccessMessage(false);
      return;
    }
    setMessage(null);
    setIsSubmitting(true);
    try {
      await api.auth.forgotPassword(values.email.trim().toLowerCase());
      setMessage(AUTH_MESSAGES.forgotPasswordSentDesc);
      setIsSuccessMessage(true);
    } catch {
      setMessage(AUTH_MESSAGES.requestFailed);
      setIsSuccessMessage(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function resendVerificationEmail() {
    if ((verifySimState === "pending" && resendCountdown > 0) || isResending) return;
    const targetEmail = registeredUser?.email || values.email;
    if (!targetEmail) return;

    setIsResending(true);
    try {
      await api.auth.resendVerificationEmail(targetEmail, "metastorage://auth/verified");
      setVerifySimState("pending");
      setMessage(AUTH_MESSAGES.resendSuccessToast);
      setIsSuccessMessage(true);
      setResendCountdown(45);
    } catch {
      setMessage(AUTH_MESSAGES.requestFailed);
      setIsSuccessMessage(false);
    } finally {
      setIsResending(false);
    }
  }

  async function openMailApp() {
    try {
      const canOpen = await NativeLinking.canOpenURL("mailto:");
      if (canOpen) {
        await NativeLinking.openURL("mailto:");
      } else {
        setMessage("Không tìm thấy ứng dụng email mặc định trên thiết bị.");
        setIsSuccessMessage(false);
      }
    } catch {
      setMessage("Không thể mở ứng dụng email.");
      setIsSuccessMessage(false);
    }
  }

  async function callHotline(phone = "02873001188") {
    try {
      await NativeLinking.openURL(`tel:${phone.replace(/\s+/g, "")}`);
    } catch {
      setMessage(`Vui lòng quay số ${phone} từ bàn phím điện thoại.`);
      setIsSuccessMessage(false);
    }
  }

  function fillDemo(email = "customer@metastorage.test", password = "12345678") {
    setValues((current) => ({
      ...current,
      email,
      password,
    }));
    setErrors({});
    setMessage(null);
  }

  async function signOut() {
    await authClient.signOut();
    setMessage(null);
    setIsSuccessMessage(false);
    setMode("login");
  }

  return {
    mode,
    setMode: switchMode,
    values,
    errors,
    message,
    isSuccessMessage,
    registeredUser,
    verifySimState,
    resendCountdown,
    isSubmitting,
    isResending,
    user: sessionState.data?.user ?? null,
    isSessionPending: sessionState.isPending,
    updateField,
    setTerms,
    setRemember,
    submitLogin,
    submitRegister,
    submitForgotPassword,
    resendVerificationEmail,
    openMailApp,
    callHotline,
    fillDemo,
    signOut,
  };
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "response" in error) {
    const response = (error as { response?: unknown }).response;
    if (response && typeof response === "object" && "data" in response) {
      const data = (response as { data?: unknown }).data;
      if (
        data &&
        typeof data === "object" &&
        "message" in data &&
        typeof data.message === "string"
      ) {
        return data.message;
      }
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return AUTH_MESSAGES.requestFailed;
}
