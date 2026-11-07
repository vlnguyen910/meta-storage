"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Mail } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useGlobalLoading } from "@/components/providers/global-loading-provider";
import { routes } from "@/config/routes";
import { api } from "@/lib/api";
import { AUTH_MESSAGES as m } from "./auth.messages";
import type { ForgotPasswordFormValues } from "./auth.types";

const schema = z.object({ email: z.string().trim().toLowerCase().email(m.invalidEmail) });

export function VerifyEmailView() {
  const { runWithGlobalLoading } = useGlobalLoading();
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const [countdown, setCountdown] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: searchParams.get("email") ?? "" },
  });

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  async function resend({ email }: ForgotPasswordFormValues) {
    if (countdown > 0) return;
    setFeedback(null);
    try {
      await runWithGlobalLoading(() =>
        api.auth.resendVerificationEmail(email, `${window.location.origin}/verify-email`),
      );
      setFailed(false);
      setFeedback(m.verificationResent);
      setCountdown(45);
    } catch {
      setFailed(true);
      setFeedback(m.verificationRequestFailed);
    }
  }

  const expired = error === "expired" || error === "TOKEN_EXPIRED";
  return (
    <section className="mx-auto w-full max-w-[500px] rounded border border-[#bfcac4] bg-white p-6 shadow-xs sm:p-8">
      <Mail className="mx-auto mb-4 text-[#165f4d]" aria-hidden="true" size={36} />
      <h1 className="text-center text-2xl font-bold text-slate-900">
        {error ? (expired ? m.expiredTitle : m.failureTitle) : m.verificationCheck}
      </h1>
      <p className="mt-3 text-sm text-slate-600">
        {error
          ? expired
            ? m.expiredDescription
            : m.failureDescription
          : m.verificationCheckDescription}
      </p>
      <form onSubmit={handleSubmit(resend)} className="mt-6 grid gap-3" noValidate>
        <label htmlFor="verification-email" className="text-sm font-semibold">
          {m.emailLabel}
        </label>
        <input
          id="verification-email"
          type="email"
          autoComplete="email"
          aria-invalid={Boolean(errors.email)}
          aria-describedby="verification-email-hint verification-email-error"
          {...register("email")}
          className="min-h-11 w-full rounded border border-[#bfcac4] px-3 text-sm focus-visible:outline-2 focus-visible:outline-[#165f4d]"
        />
        <p id="verification-email-hint" className="text-xs text-slate-600">
          {m.verificationEmailHint}
        </p>
        <p
          id="verification-email-error"
          role={errors.email ? "alert" : undefined}
          className="text-sm text-rose-800"
        >
          {errors.email?.message}
        </p>
        {feedback ? (
          <p
            role={failed ? "alert" : "status"}
            className={failed ? "text-sm text-rose-800" : "text-sm text-[#165f4d]"}
          >
            {feedback}
          </p>
        ) : null}
        <button
          id="resend-btn"
          type="submit"
          disabled={isSubmitting || countdown > 0}
          className="min-h-11 rounded bg-[#165f4d] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#165f4d]"
        >
          {m.resendVerifyEmail}
          {countdown > 0 ? ` (${countdown}s)` : ""}
        </button>
      </form>
      <Link
        href={routes.login}
        className="mt-4 flex min-h-11 items-center justify-center rounded border border-[#bfcac4] px-4 text-sm font-semibold text-[#165f4d] focus-visible:outline-2 focus-visible:outline-[#165f4d]"
      >
        {m.continueToLogin}
      </Link>
    </section>
  );
}
