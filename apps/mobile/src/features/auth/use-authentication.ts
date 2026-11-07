import { zodResolver } from "@hookform/resolvers/zod";
import { CustomerSignUpInputSchema } from "@metastorage/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { BackHandler, Platform } from "react-native";
import { z } from "zod";
import type { AuthenticationOptions, AuthRoute, Verification } from "../../common/auth.types";
import { authenticationError } from "../../common/auth.utils";
import { api } from "../../lib/api";
import { authClient } from "../../lib/auth-client";
import { mobileApi, mobileWorkflows } from "../demo/demo-client";
import { AUTHENTICATION as M } from "./authentication.messages";

const emailSchema = CustomerSignUpInputSchema.shape.email;
const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, M.passwordRequired),
});
const recoverySchema = z.object({ email: emailSchema });
const registrationSchema = z.object({
  name: CustomerSignUpInputSchema.shape.name,
  email: emailSchema,
  password: CustomerSignUpInputSchema.shape.password,
  phone: z
    .string()
    .trim()
    .pipe(CustomerSignUpInputSchema.shape.phone.unwrap().or(z.literal(""))),
});
const validationOptions = {
  error: (issue: { path?: PropertyKey[]; code: string }) => {
    switch (issue.path?.[0]) {
      case "email":
        return M.invalidEmail;
      case "password":
        return M.passwordLength;
      case "name":
        return issue.code === "too_big" ? M.nameTooLong : M.nameRequired;
      case "phone":
        return M.phoneInvalid;
      default:
        return undefined;
    }
  },
};

export function useAuthentication({
  callbackUrl,
  demo = false,
  onAuthenticated,
}: AuthenticationOptions) {
  const client = useQueryClient();
  const [page, setPage] = useState<AuthRoute>("login");
  const [verification, setVerification] = useState<Verification>("pending");
  const [verificationEmail, setVerificationEmail] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [recoveryCooldown, setRecoveryCooldown] = useState(0);
  const [feedback, setFeedback] = useState<{ message: string; error?: boolean }>();
  const login = useForm({
    resolver: zodResolver(loginSchema, validationOptions),
    defaultValues: { email: "", password: "" },
  });
  const registration = useForm({
    resolver: zodResolver(registrationSchema, validationOptions),
    defaultValues: { email: "", password: "", name: "", phone: "" },
  });
  const recovery = useForm({
    resolver: zodResolver(recoverySchema, validationOptions),
    defaultValues: { email: "" },
  });
  const request = useMutation({ mutationFn: (action: () => Promise<void>) => action() });
  const navigate = useCallback(
    (next: AuthRoute) => {
      setPage(next);
      setFeedback(undefined);
      request.reset();
    },
    [request.reset],
  );

  useEffect(() => {
    if (!callbackUrl) return;
    try {
      const url = new URL(callbackUrl);
      if (url.protocol !== "metastorage:" || url.hostname !== "auth") return;
      request.reset();
      setFeedback(undefined);
      if (url.pathname === "/verified") {
        setVerification(url.searchParams.has("error") ? "expired" : "returned");
        setPage("verify-email");
        setResendCooldown(0);
      } else if (url.searchParams.has("error")) {
        setPage("login");
        setFeedback({ message: M.googleFailed, error: true });
      }
    } catch {
      // Ignore links that do not belong to this flow.
    }
  }, [callbackUrl, request.reset]);
  const coolingDown = resendCooldown > 0 || recoveryCooldown > 0;
  useEffect(() => {
    if (!coolingDown) return;
    const timer = setInterval(() => {
      setResendCooldown((value) => Math.max(0, value - 1));
      setRecoveryCooldown((value) => Math.max(0, value - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [coolingDown]);
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const listener = BackHandler.addEventListener("hardwareBackPress", () => {
      if (page === "login") return false;
      if (!request.isPending) navigate("login");
      return true;
    });
    return () => listener.remove();
  }, [page, navigate, request.isPending]);

  function run(action: () => Promise<void>) {
    if (request.isPending) return;
    setFeedback(undefined);
    request.mutate(action);
  }
  const signIn = login.handleSubmit((values) =>
    run(async () => {
      if (demo) {
        const session = await mobileWorkflows.login(values.email, values.password);
        await client.invalidateQueries({ queryKey: ["mobile", "workspace"] });
        onAuthenticated?.(session.role);
        return;
      }
      const result = await authClient.signIn.email(values);
      if (result.error?.code === "EMAIL_NOT_VERIFIED") {
        setVerificationEmail(values.email);
        setVerification("pending");
        setResendCooldown(45);
        setPage("verify-email");
      } else if (result.error) {
        throw new Error(
          result.error.code === "INVALID_EMAIL_OR_PASSWORD"
            ? M.invalidCredentials
            : M.requestFailed,
        );
      }
    }),
  );
  const register = registration.handleSubmit((values) =>
    run(async () => {
      const input = CustomerSignUpInputSchema.parse({
        ...values,
        phone: values.phone?.trim() || undefined,
        confirmPassword: values.password,
        callbackTarget: "mobile",
      });
      await (demo ? mobileApi : api).auth.registerCustomer(input);
      setVerificationEmail(input.email);
      login.setValue("email", input.email);
      registration.reset({ ...values, password: "" });
      setVerification("pending");
      setResendCooldown(45);
      setPage("verify-email");
    }),
  );
  const recover = recovery.handleSubmit((values) =>
    run(async () => {
      await (demo ? mobileApi : api).auth.forgotPassword(values.email);
      setFeedback({ message: M.recoverySent });
      setRecoveryCooldown(60);
    }),
  );
  function resend() {
    if (resendCooldown > 0 || !verificationEmail) return;
    run(async () => {
      await (demo ? mobileApi : api).auth.resendVerificationEmail(
        verificationEmail,
        "metastorage://auth/verified",
      );
      setVerification("pending");
      setResendCooldown(45);
      setFeedback({ message: M.resent });
    });
  }
  function google() {
    run(async () => {
      if (demo) throw new Error(M.googleDemo);
      const callbackURL = Platform.OS === "web" ? window.location.origin : "metastorage://auth";
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL,
        errorCallbackURL: `${callbackURL}?error=google`,
      });
      if (result.error) throw new Error(M.googleFailed);
      await authClient.getSession({ query: { disableCookieCache: true } });
    });
  }
  return {
    page,
    navigate,
    login,
    registration,
    recovery,
    signIn,
    register,
    recover,
    resend,
    google,
    verification,
    verificationEmail,
    cooldown: page === "forgot-password" ? recoveryCooldown : resendCooldown,
    feedback: feedback?.message,
    pending: request.isPending,
    error: request.error
      ? authenticationError(request.error)
      : feedback?.error
        ? feedback.message
        : undefined,
  };
}
