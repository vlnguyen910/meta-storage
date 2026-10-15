"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { type CustomerSignUpInput, CustomerSignUpInputSchema } from "@metastorage/contracts";
import axios from "axios";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  MailCheck,
  Phone,
  Shield,
  User,
  UserCheck,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { isMockMode } from "@/config/api-mode";
import { routes } from "@/config/routes";
import { api } from "@/lib/api";
import { MOCK_MESSAGES } from "@/mocks/mock.messages";
import { AUTH_MESSAGES } from "./auth.messages";
import type { RegisterFormValues } from "./auth.types";

export function RegisterForm() {
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(CustomerSignUpInputSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      callbackTarget: "web",
      terms: true,
    },
  });

  const passwordValue = watch("password");
  const confirmPasswordValue = watch("confirmPassword");
  const isMatching =
    confirmPasswordValue && passwordValue && passwordValue === confirmPasswordValue;
  const isMismatch =
    confirmPasswordValue && passwordValue && passwordValue !== confirmPasswordValue;

  async function onSubmit(values: RegisterFormValues) {
    setFormError(null);
    if (!watch("terms")) {
      setFormError(AUTH_MESSAGES.termsRequired);
      return;
    }
    try {
      const payload: CustomerSignUpInput = {
        name: values.name,
        email: values.email,
        phone: values.phone,
        password: values.password,
        confirmPassword: values.confirmPassword,
        callbackTarget: values.callbackTarget,
      };
      await api.auth.registerCustomer(payload);
      setRegisteredEmail(values.email.trim().toLowerCase());
    } catch (error) {
      const message = getResponseMessage(error);
      setFormError(message ?? AUTH_MESSAGES.registrationFailed);
    }
  }

  if (registeredEmail) {
    return (
      <div className="w-full max-w-[500px] mx-auto">
        <section
          className="w-full bg-white rounded-[15px] p-6 md:p-8 border border-slate-200 shadow-[0px_4px_6px_-1px_rgba(15,23,42,0.06),0px_2px_4px_-2px_rgba(15,23,42,0.03)] text-center"
          aria-labelledby="signup-success-title"
        >
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#e8f3ef] text-[#165f4d] mb-4 shadow-xs mx-auto">
            <MailCheck className="w-7 h-7" aria-hidden="true" />
          </div>
          <h1
            id="signup-success-title"
            className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight mb-2"
          >
            {isMockMode ? MOCK_MESSAGES.registeredTitle : AUTH_MESSAGES.checkEmailTitle}
          </h1>
          <p className="text-xs md:text-sm text-slate-500 leading-relaxed max-w-md mx-auto mb-6">
            {isMockMode
              ? MOCK_MESSAGES.registered
              : AUTH_MESSAGES.checkEmailSubtitle(registeredEmail)}
          </p>
          <Link
            href={routes.login}
            className="w-full h-11 bg-[#165f4d] hover:bg-[#0f493b] active:bg-[#0a352b] text-white text-sm font-semibold rounded-lg inline-flex items-center justify-center gap-2 transition-all duration-150 shadow-xs active:scale-[0.99]"
          >
            <span>{AUTH_MESSAGES.goToLogin}</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[500px] mx-auto">
      {/* Registration Card */}
      <section className="w-full bg-white rounded-[15px] p-6 md:p-8 border border-slate-200 shadow-[0px_4px_6px_-1px_rgba(15,23,42,0.06),0px_2px_4px_-2px_rgba(15,23,42,0.03)]">
        {/* Badge & Header */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#e8f3ef] text-[#165f4d] text-xs font-semibold mb-3 border border-[#cce7df]">
            <UserCheck className="w-3.5 h-3.5" />
            <span>{AUTH_MESSAGES.registerBadge}</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight mb-1.5">
            {AUTH_MESSAGES.registerTitle}
          </h1>
          <p className="text-xs md:text-sm text-slate-500 leading-relaxed">
            {AUTH_MESSAGES.registerSubtitle}
          </p>
        </div>

        {/* Registration Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {/* Field 1: Họ và tên */}
          <div>
            <label htmlFor="name" className="block text-sm font-bold text-slate-900 mb-1.5">
              {AUTH_MESSAGES.fullNameLabel} <span className="text-rose-600">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                id="name"
                type="text"
                autoComplete="name"
                placeholder={AUTH_MESSAGES.fullNamePlaceholder}
                {...register("name")}
                className="w-full h-10 pl-9 pr-3.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#165f4d] focus:ring-1 focus:ring-[#165f4d] transition-colors"
              />
            </div>
            {errors.name?.message && (
              <p className="mt-1 text-xs text-rose-600">{errors.name.message}</p>
            )}
          </div>

          {/* Field 2: Số điện thoại */}
          <div>
            <label htmlFor="phone" className="block text-sm font-bold text-slate-900 mb-1.5">
              {AUTH_MESSAGES.phoneLabel} <span className="text-rose-600">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Phone className="w-4 h-4" />
              </div>
              <input
                id="phone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                placeholder={AUTH_MESSAGES.phonePlaceholder}
                {...register("phone")}
                className="w-full h-10 pl-9 pr-3.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#165f4d] focus:ring-1 focus:ring-[#165f4d] transition-colors"
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-500">{AUTH_MESSAGES.phoneHint}</p>
            {errors.phone?.message && (
              <p className="mt-1 text-xs text-rose-600">{errors.phone.message}</p>
            )}
          </div>

          {/* Field 3: Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-bold text-slate-900 mb-1.5">
              {AUTH_MESSAGES.emailLabel} <span className="text-rose-600">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder={AUTH_MESSAGES.emailPlaceholder}
                {...register("email")}
                className="w-full h-10 pl-9 pr-3.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#165f4d] focus:ring-1 focus:ring-[#165f4d] transition-colors"
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-500">{AUTH_MESSAGES.emailRegisterHint}</p>
            {errors.email?.message && (
              <p className="mt-1 text-xs text-rose-600">{errors.email.message}</p>
            )}
          </div>

          {/* Field 4: Mật khẩu */}
          <div>
            <label htmlFor="password" className="block text-sm font-bold text-slate-900 mb-1.5">
              {AUTH_MESSAGES.passwordLabel} <span className="text-rose-600">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder={AUTH_MESSAGES.passwordPlaceholder}
                {...register("password")}
                className="w-full h-10 pl-9 pr-11 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#165f4d] focus:ring-1 focus:ring-[#165f4d] transition-colors"
              />
              <button
                type="button"
                aria-label={showPassword ? AUTH_MESSAGES.hidePassword : AUTH_MESSAGES.showPassword}
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 focus:outline-none transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">{AUTH_MESSAGES.passwordRegisterHint}</p>
            {errors.password?.message && (
              <p className="mt-1 text-xs text-rose-600">{errors.password.message}</p>
            )}
          </div>

          {/* Field 5: Xác nhận lại mật khẩu */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="confirmPassword" className="block text-sm font-bold text-slate-900">
                {AUTH_MESSAGES.confirmPasswordLabel} <span className="text-rose-600">*</span>
              </label>
              {isMatching ? (
                <span className="text-[11px] font-medium text-emerald-600 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  {AUTH_MESSAGES.passwordsMatch}
                </span>
              ) : isMismatch ? (
                <span className="text-[11px] font-medium text-rose-600 flex items-center gap-1">
                  <X className="w-3.5 h-3.5" />
                  {AUTH_MESSAGES.passwordsDoNotMatch}
                </span>
              ) : null}
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder={AUTH_MESSAGES.confirmPasswordPlaceholder}
                {...register("confirmPassword")}
                className="w-full h-10 pl-9 pr-11 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#165f4d] focus:ring-1 focus:ring-[#165f4d] transition-colors"
              />
              <button
                type="button"
                aria-label={
                  showConfirmPassword ? AUTH_MESSAGES.hidePassword : AUTH_MESSAGES.showPassword
                }
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 focus:outline-none transition-colors cursor-pointer"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.confirmPassword?.message && (
              <p className="mt-1 text-xs text-rose-600">{errors.confirmPassword.message}</p>
            )}
          </div>

          {/* Field 6: Terms & Agreement */}
          <div className="pt-1">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                {...register("terms")}
                className="w-4 h-4 mt-0.5 rounded border-slate-300 text-[#165f4d] focus:ring-[#165f4d] focus:ring-offset-0 transition-all cursor-pointer"
              />
              <span className="text-xs text-slate-600 leading-relaxed">
                {AUTH_MESSAGES.termsAgreementPrefix}{" "}
                <Link
                  href="/terms"
                  className="font-medium text-[#165f4d] hover:underline"
                  target="_blank"
                >
                  {AUTH_MESSAGES.termsOfService}
                </Link>{" "}
                {AUTH_MESSAGES.termsAgreementAnd}{" "}
                <Link
                  href="/privacy"
                  className="font-medium text-[#165f4d] hover:underline"
                  target="_blank"
                >
                  {AUTH_MESSAGES.privacyPolicy}
                </Link>{" "}
                {AUTH_MESSAGES.termsAgreementSuffix}
              </span>
            </label>
          </div>

          <input type="hidden" value="web" {...register("callbackTarget")} />

          {formError ? (
            <p
              className="m-0 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-3"
              role="alert"
            >
              {formError}
            </p>
          ) : null}

          {/* Primary Submit CTA */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 bg-[#165f4d] hover:bg-[#0f493b] active:bg-[#0a352b] text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-all duration-150 shadow-xs active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#165f4d] cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <span>{isSubmitting ? AUTH_MESSAGES.registering : AUTH_MESSAGES.registerButton}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>

        {/* Bottom Redirection */}
        <div className="mt-6 pt-4 border-t border-slate-200 text-center">
          <p className="text-xs text-slate-600">
            {AUTH_MESSAGES.alreadyHaveAccount}{" "}
            <Link
              href={routes.login}
              className="font-bold text-[#165f4d] hover:underline transition-colors"
            >
              {AUTH_MESSAGES.loginNow}
            </Link>
          </p>
        </div>
      </section>

      {/* Security & Trust Micro-indicators */}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-slate-500 text-xs">
        <div className="flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-[#165f4d]" />
          <span>{AUTH_MESSAGES.sslSecurity}</span>
        </div>
        <span className="inline-block w-1 h-1 rounded-full bg-slate-300" />
        <div className="flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-[#165f4d]" />
          <span>{AUTH_MESSAGES.surveillanceSecurity}</span>
        </div>
      </div>
    </div>
  );
}

function getResponseMessage(error: unknown): string | undefined {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string } | undefined;
    return typeof data?.message === "string" ? data.message : undefined;
  }
  if (error && typeof error === "object" && "response" in error) {
    const response = (error as { response?: unknown }).response;
    if (response && typeof response === "object" && "data" in response) {
      const data = (response as { data?: unknown }).data;
      if (data && typeof data === "object" && "message" in data) {
        const msg = (data as { message?: unknown }).message;
        if (typeof msg === "string") return msg;
      }
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return undefined;
}
