import { zodResolver } from "@hookform/resolvers/zod";
import { type CustomerSignUpInput, CustomerSignUpInputSchema } from "@metastorage/contracts";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { MobileScreenProps } from "../../screens/mobile-screen.types";
import { mobileApi, mobileWorkflows } from "../demo/demo-client";
import { MOBILE_AUTH_MESSAGES as m } from "./mobile-auth.messages";

const LoginSchema = z.object({
  email: z.string().trim().email(m.invalidEmail),
  password: z.string().min(1, m.required),
});
export function useMobileAuth({ route, run, go }: MobileScreenProps) {
  const login = useForm({
    resolver: zodResolver(LoginSchema),
    defaultValues: { email: "", password: "" },
  });
  const signup = useForm<CustomerSignUpInput>({
    resolver: zodResolver(CustomerSignUpInputSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      callbackTarget: "mobile",
    },
  });
  const [email, setEmail] = useState(route.id ?? "");
  const [sent, setSent] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [emailError, setEmailError] = useState("");
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  return {
    login,
    signup,
    email,
    setEmail,
    sent,
    confirmReset,
    setConfirmReset,
    reset: () =>
      run(
        () => mobileWorkflows.resetDemo(true),
        () => {
          setConfirmReset(false);
          go("M-A01");
        },
        m.resetHint,
      ),
    cooldown,
    emailError,
    signIn: login.handleSubmit((values) =>
      run(
        () => mobileWorkflows.login(values.email, values.password),
        (session) => go(session.role === "FACILITY_STAFF" ? "M-FS01" : "M-C01"),
      ),
    ),
    register: signup.handleSubmit((values) =>
      run(
        () => mobileApi.auth.registerCustomer(values),
        () => go("M-A03", values.email),
      ),
    ),
    verify: () =>
      run(
        () => mobileWorkflows.verifyEmail(email),
        () => {
          setSent(true);
          go("M-A01");
        },
        m.verified,
      ),
    recover: () => {
      const valid = z.string().email().safeParse(email);
      if (!valid.success) {
        setEmailError(m.invalidEmail);
        return;
      }
      setEmailError("");
      return run(
        () => mobileApi.auth.forgotPassword(email),
        () => {
          setSent(true);
          setCooldown(60);
        },
        m.sent,
      );
    },
    demo: (role: "customer" | "staff") => {
      login.setValue("email", `${role}@metastorage.test`);
      login.setValue("password", "Demo@123");
    },
  };
}
