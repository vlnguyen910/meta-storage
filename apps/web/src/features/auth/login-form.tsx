"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { UserRole } from "@metastorage/contracts";
import axios from "axios";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Headphones,
  KeyRound,
  Lock,
  Mail,
  QrCode,
  Shield,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useToast } from "@/components/ui/toast";
import { isMockMode } from "@/config/api-mode";
import { roleHome, routes, safeReturnTo } from "@/config/routes";
import { api } from "@/lib/api";
import { demoAccounts } from "@/mocks/seeds";
import { AUTH_MESSAGES } from "./auth.messages";
import type { LoginFormValues } from "./auth.types";
import { useAuthStore } from "./auth-store";

const schema = z.object({
  email: z.string().email(AUTH_MESSAGES.invalidEmail),
  password: z.string().min(8, AUTH_MESSAGES.passwordTooShort),
  remember: z.boolean().optional(),
});

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setSession = useAuthStore((state) => state.setSession);
  const { showToast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(schema),
    defaultValues: isMockMode
      ? { email: "customer@metastorage.test", password: "12345678", remember: false }
      : { email: "", password: "", remember: false },
  });

  async function onSubmit(values: LoginFormValues) {
    try {
      const session = await api.auth.login({
        email: values.email,
        password: values.password,
      });
      setSession(session);
      const role = session.user.role;
      if (!role) {
        router.replace(routes.forbidden);
        return;
      }
      showToast(AUTH_MESSAGES.loginWelcome(session.user.name));
      const requested = safeReturnTo(searchParams.get("returnTo"), roleHome[role]);
      const roleRoot = `/${roleHome[role].split("/")[1]}`;
      const customerReservationEntry =
        session.user.role === UserRole.STORAGE_CUSTOMER &&
        (requested === routes.reservationNew || requested.startsWith(`${routes.reservationNew}?`));
      const destination =
        requested === roleRoot || requested.startsWith(`${roleRoot}/`) || customerReservationEntry
          ? requested
          : roleHome[role];
      router.replace(destination);
    } catch (error) {
      const responseData = axios.isAxiosError(error)
        ? (error.response?.data as
            | { code?: string; message?: string; error?: { code?: string; message?: string } }
            | undefined)
        : undefined;
      const message =
        (responseData?.code ?? responseData?.error?.code) === "EMAIL_NOT_VERIFIED"
          ? AUTH_MESSAGES.loginEmailNotVerified
          : (responseData?.error?.message ?? responseData?.message);
      showToast(message ?? AUTH_MESSAGES.loginFailed, "error");
    }
  }

  return (
    <div className="w-full max-w-[440px] mx-auto">
      {/* Centered Login Card */}
      <div className="w-full bg-white rounded-[15px] p-6 md:p-8 border border-slate-200 shadow-[0px_4px_6px_-1px_rgba(15,23,42,0.06),0px_2px_4px_-2px_rgba(15,23,42,0.03)]">
        {/* Card Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#e8f3ef] text-[#165f4d] mb-3.5 shadow-xs">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight mb-2">
            {AUTH_MESSAGES.loginTitle}
          </h1>
          <p className="text-xs md:text-sm text-slate-500 leading-relaxed">
            {AUTH_MESSAGES.loginSubtitle}
          </p>
        </div>

        {/* Authentication Form */}
        <form method="post" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Field 1: Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-bold text-slate-900 mb-1.5">
              {AUTH_MESSAGES.emailLabel}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-600">
                <Mail className="w-4 h-4" />
              </div>
              <input
                id="email"
                type="email"
                disabled={!hydrated}
                autoComplete="email"
                placeholder={AUTH_MESSAGES.emailPlaceholder}
                {...register("email")}
                className="w-full h-10 pl-9 pr-3.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-600 focus:outline-none focus:border-[#165f4d] focus:ring-1 focus:ring-[#165f4d] transition-colors"
              />
            </div>
            {errors.email?.message && (
              <p className="mt-1 text-xs text-rose-600">{errors.email.message}</p>
            )}
          </div>

          {/* Field 2: Password */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="password" className="block text-sm font-bold text-slate-900">
                {AUTH_MESSAGES.passwordLabel}
              </label>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-600">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                disabled={!hydrated}
                autoComplete="current-password"
                placeholder={AUTH_MESSAGES.passwordPlaceholder}
                {...register("password")}
                className="w-full h-10 pl-9 pr-11 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-600 focus:outline-none focus:border-[#165f4d] focus:ring-1 focus:ring-[#165f4d] transition-colors"
              />
              <button
                type="button"
                aria-label={showPassword ? AUTH_MESSAGES.hidePassword : AUTH_MESSAGES.showPassword}
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-600 hover:text-slate-700 focus:outline-none transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password?.message && (
              <p className="mt-1 text-xs text-rose-600">{errors.password.message}</p>
            )}
          </div>

          {/* Field 3: Remember & Forgot Password */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                {...register("remember")}
                className="w-4 h-4 rounded border-slate-300 text-[#165f4d] focus:ring-[#165f4d] focus:ring-offset-0 transition-all cursor-pointer"
              />
              <span className="text-xs text-slate-600 hover:text-slate-900">
                {AUTH_MESSAGES.rememberMe}
              </span>
            </label>
            <Link
              href={routes.forgotPassword}
              className="text-xs text-[#165f4d] hover:underline font-medium focus:outline-none whitespace-nowrap"
            >
              {AUTH_MESSAGES.forgotPassword}
            </Link>
          </div>

          {/* Role Intelligence Notice Box */}
          <div className="rounded-lg bg-[#f8fafc] p-3 border border-slate-200 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-[#165f4d] shrink-0 mt-0.5" />
            <p className="text-xs text-slate-600 leading-relaxed">{AUTH_MESSAGES.roleNotice}</p>
          </div>

          {/* Primary CTA Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={!hydrated || isSubmitting}
              className="w-full h-11 bg-[#165f4d] hover:bg-[#0f493b] active:bg-[#0a352b] text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-all duration-150 shadow-xs active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#165f4d] cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <span>{isSubmitting ? AUTH_MESSAGES.loggingIn : AUTH_MESSAGES.loginButton}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>

        {/* Alternative SSO Dividers */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white px-3 text-slate-600">{AUTH_MESSAGES.orContinueWith}</span>
          </div>
        </div>

        {/* Alternative SSO Buttons */}
        <div className="space-y-2.5">
          {/* Google SSO */}
          <button
            type="button"
            className="w-full h-10 px-4 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium flex items-center justify-center gap-3 transition-colors duration-150 shadow-xs cursor-pointer"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                fill="#EA4335"
              />
            </svg>
            <span>{AUTH_MESSAGES.googleLogin}</span>
          </button>

          {/* QR Code App Login */}
          <button
            type="button"
            className="w-full h-10 px-4 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium flex items-center justify-center gap-2.5 transition-colors duration-150 shadow-xs cursor-pointer"
          >
            <QrCode className="w-4 h-4 text-slate-500" />
            <span>{AUTH_MESSAGES.qrLogin}</span>
          </button>
        </div>

        {/* Demo Accounts (in Mock Mode) */}
        {isMockMode && (
          <div className="mt-5 rounded-xl bg-[#f8fafc] p-3.5 border border-slate-200">
            <div className="mb-2.5 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <ShieldCheck className="w-4 h-4 text-[#165f4d]" />
                <span>{AUTH_MESSAGES.demoAccountsTitle}</span>
              </div>
              <span className="text-[11px] text-slate-500">{AUTH_MESSAGES.demoPasswordLabel}</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {demoAccounts.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  className="cursor-pointer rounded-lg border border-slate-200 bg-white p-2 text-left hover:border-[#165f4d] hover:bg-[#e8f3ef]/30 transition-all text-xs"
                  onClick={() => {
                    setValue("email", account.email, { shouldValidate: true });
                    setValue("password", "12345678", { shouldValidate: true });
                  }}
                >
                  <strong className="block text-[11px] text-slate-900 truncate">
                    {account.label}
                  </strong>
                  <span className="block text-[10px] text-slate-500 truncate">{account.email}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Hotline Help Note */}
        <div className="mt-6 pt-4 border-t border-slate-200 text-center">
          <p className="text-xs text-slate-500 flex items-center justify-center gap-1.5">
            <Headphones className="w-4 h-4 text-slate-600" />
            <span>{AUTH_MESSAGES.hotlineLabel}</span>
            <a
              href={`tel:${AUTH_MESSAGES.hotlineNumber.replace(/\s+/g, "")}`}
              className="font-semibold text-[#165f4d] hover:underline"
            >
              {AUTH_MESSAGES.hotlineNumber}
            </a>
          </p>
        </div>
      </div>

      {/* Security & Trust Micro-indicators under Card */}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-slate-500 text-xs">
        <div className="flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-[#165f4d]" />
          <span>{AUTH_MESSAGES.sslSecurity}</span>
        </div>
        <span className="inline-block w-1 h-1 rounded-full bg-slate-300" />
        <div className="flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-[#165f4d]" />
          <span>{AUTH_MESSAGES.isoSecurity}</span>
        </div>
      </div>
    </div>
  );
}
