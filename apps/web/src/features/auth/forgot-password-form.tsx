"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  ArrowRight,
  Headphones,
  Info,
  KeyRound,
  Lock,
  Mail,
  MailCheck,
  RefreshCw,
  Shield,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { routes } from "@/config/routes";
import { api } from "@/lib/api";
import { AUTH_MESSAGES } from "./auth.messages";
import type { ForgotPasswordFormValues } from "./auth.types";

const schema = z.object({
  email: z.string().email(AUTH_MESSAGES.invalidEmail),
});

export function ForgotPasswordForm() {
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(60);
  const [isResending, setIsResending] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
    },
  });

  useEffect(() => {
    if (!submittedEmail || countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [submittedEmail, countdown]);

  async function onSubmit({ email }: ForgotPasswordFormValues) {
    try {
      await api.auth.forgotPassword(email);
    } finally {
      setSubmittedEmail(email.trim().toLowerCase());
      setCountdown(60);
    }
  }

  async function handleResend() {
    if (!submittedEmail || countdown > 0 || isResending) return;
    setIsResending(true);
    try {
      await api.auth.forgotPassword(submittedEmail);
    } finally {
      setIsResending(false);
      setCountdown(60);
    }
  }

  return (
    <div className="w-full max-w-[480px] mx-auto">
      {/* Centered Card Container */}
      <div className="w-full bg-white rounded-[15px] border border-slate-200 shadow-xs p-6 sm:p-8 relative overflow-hidden transition-all duration-300">
        {/* Top Decorative Structural Accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#165f4d] via-[#246957] to-[#004637]" />

        {submittedEmail ? (
          /* STATE 2: PRIVACY-PRESERVING SENT RESULT */
          <section className="space-y-6" aria-labelledby="sent-state-heading">
            <div className="space-y-2">
              <div className="w-11 h-11 rounded-xl bg-[#ecfdf5] flex items-center justify-center text-[#107012] mb-3 border border-[#a7f3d0]">
                <MailCheck className="w-6 h-6" aria-hidden="true" />
              </div>
              <h1
                id="sent-state-heading"
                className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight"
              >
                {AUTH_MESSAGES.forgotPasswordSuccessTitle}
              </h1>
              <p className="text-xs md:text-sm text-slate-600">
                {AUTH_MESSAGES.forgotPasswordSuccessSubtitle}
              </p>
            </div>

            {/* Privacy Notification Box (Zero User Enumeration) */}
            <div className="p-4 rounded-xl bg-[#f8fafc] border border-slate-200 space-y-2">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#165f4d]" aria-hidden="true" />
                <span className="text-xs md:text-sm font-semibold text-slate-900">
                  {AUTH_MESSAGES.securityNoticeTitle}
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                {AUTH_MESSAGES.securityNoticeBody}
              </p>
            </div>

            {/* Guidance Box for spam/retry */}
            <div className="p-4 rounded-xl bg-[#fffbeb] border border-[#fde68a] flex items-start gap-3">
              <Info className="w-5 h-5 text-[#92400e] shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-1">
                <p className="text-xs md:text-sm font-semibold text-[#92400e]">
                  {AUTH_MESSAGES.didNotReceiveEmailTitle}
                </p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {AUTH_MESSAGES.didNotReceiveEmailBody}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 border-t border-slate-200 space-y-3">
              <button
                type="button"
                id="resendBtn"
                disabled={countdown > 0 || isResending}
                onClick={handleResend}
                className="w-full h-10 flex items-center justify-center gap-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs md:text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <RefreshCw
                  className={`w-4 h-4 text-slate-500 ${isResending ? "animate-spin" : ""}`}
                  aria-hidden="true"
                />
                <span>
                  {countdown > 0
                    ? AUTH_MESSAGES.resendCountdown(countdown)
                    : isResending
                      ? AUTH_MESSAGES.resendingEmail
                      : AUTH_MESSAGES.resendEmailBtn}
                </span>
              </button>
              <div className="text-center pt-1">
                <Link
                  href={routes.login}
                  className="inline-flex items-center gap-1.5 text-xs md:text-sm font-semibold text-[#165f4d] hover:text-[#004637] transition-colors group"
                >
                  <ArrowLeft
                    className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform"
                    aria-hidden="true"
                  />
                  <span>{AUTH_MESSAGES.backToLogin}</span>
                </Link>
              </div>
            </div>
          </section>
        ) : (
          /* STATE 1: REQUEST FORM VIEW */
          <section className="space-y-6" aria-labelledby="form-state-heading">
            {/* Header Hierarchy */}
            <div className="space-y-2">
              <div className="w-11 h-11 rounded-xl bg-[#e8f3ef] flex items-center justify-center text-[#165f4d] mb-3 border border-[#cce7df]">
                <KeyRound className="w-6 h-6" aria-hidden="true" />
              </div>
              <h1
                id="form-state-heading"
                className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight"
              >
                {AUTH_MESSAGES.forgotPasswordTitle}
              </h1>
              <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
                {AUTH_MESSAGES.forgotPasswordSubtitle}
              </p>
            </div>

            {/* The Request Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
              <div className="space-y-1.5">
                <label
                  htmlFor="recoveryEmail"
                  className="block text-xs md:text-sm font-semibold text-slate-900"
                >
                  {AUTH_MESSAGES.forgotPasswordEmailLabel} <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <Mail className="w-4 h-4" aria-hidden="true" />
                  </div>
                  <input
                    id="recoveryEmail"
                    type="email"
                    autoComplete="email"
                    placeholder={AUTH_MESSAGES.emailPlaceholder}
                    {...register("email")}
                    className="block w-full h-10 pl-9 pr-3.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#165f4d] focus:ring-1 focus:ring-[#165f4d] transition-all"
                  />
                </div>
                {errors.email?.message && (
                  <p className="mt-1 text-xs text-rose-600">{errors.email.message}</p>
                )}
                <p className="text-[11px] text-slate-500 flex items-start gap-1.5 pt-1">
                  <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{AUTH_MESSAGES.forgotPasswordEmailHint}</span>
                </p>
              </div>

              {/* Primary CTA Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-11 flex items-center justify-center gap-2 rounded-lg bg-[#165f4d] hover:bg-[#0f493b] active:bg-[#0a352b] active:scale-[0.99] text-white text-sm font-semibold shadow-xs transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#165f4d] focus:ring-offset-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <span>
                  {isSubmitting
                    ? AUTH_MESSAGES.forgotPasswordSubmitting
                    : AUTH_MESSAGES.forgotPasswordSubmitBtn}
                </span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </form>

            {/* Secondary Navigation */}
            <div className="pt-2 border-t border-slate-200 text-center">
              <Link
                href={routes.login}
                className="inline-flex items-center gap-1.5 text-xs md:text-sm font-semibold text-[#165f4d] hover:text-[#004637] transition-colors hover:underline"
              >
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                <span>{AUTH_MESSAGES.backToLogin}</span>
              </Link>
            </div>
          </section>
        )}
      </div>

      {/* Security & Trust Indicators below card */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-slate-500 text-xs">
        <div className="flex items-center gap-1.5">
          <Lock className="w-4 h-4 text-[#165f4d]" aria-hidden="true" />
          <span>{AUTH_MESSAGES.tlsSecurity}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-[#165f4d]" aria-hidden="true" />
          <span>{AUTH_MESSAGES.privacySecurity}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Headphones className="w-4 h-4 text-[#165f4d]" aria-hidden="true" />
          <span>{AUTH_MESSAGES.helpCenter247}</span>
        </div>
      </div>
    </div>
  );
}
