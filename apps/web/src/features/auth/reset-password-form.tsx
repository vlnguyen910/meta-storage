"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { type ResetPasswordInput, ResetPasswordInputSchema } from "@metastorage/contracts";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { routes } from "@/config/routes";
import { api } from "@/lib/api";
import { AUTH_MESSAGES as m } from "./auth.messages";

export function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(ResetPasswordInputSchema),
    defaultValues: { token, newPassword: "", confirmPassword: "" },
  });
  const invalid =
    !ResetPasswordInputSchema.shape.token.safeParse(token).success || params.has("error");
  async function submit(input: ResetPasswordInput) {
    setFailed(false);
    try {
      await api.auth.resetPassword(input);
      setDone(true);
      window.history.replaceState(null, "", routes.resetPassword);
    } catch {
      setFailed(true);
    }
  }
  return (
    <section className="w-full max-w-[480px] space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <h1 className="text-2xl font-bold">{done ? m.resetSuccessTitle : m.resetTitle}</h1>
      {done ? (
        <p role="status">{m.resetSuccess}</p>
      ) : invalid ? (
        <p role="alert">{m.resetInvalid}</p>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit(submit)} noValidate>
          <p className="text-sm text-slate-600">{m.resetHint}</p>
          <input type="hidden" {...register("token")} />
          {(["newPassword", "confirmPassword"] as const).map((field) => (
            <div key={field} className="space-y-1">
              <label className="block text-sm font-semibold" htmlFor={field}>
                {field === "newPassword" ? m.resetNewPassword : m.confirmPasswordLabel}
              </label>
              <input
                id={field}
                type="password"
                autoComplete="new-password"
                className="min-h-11 w-full rounded-lg border border-slate-300 px-3 focus-visible:outline-2 focus-visible:outline-emerald-800"
                aria-invalid={Boolean(errors[field])}
                aria-describedby={errors[field] ? `${field}-error` : undefined}
                {...register(field)}
              />
              {errors[field] && (
                <p id={`${field}-error`} role="alert" className="text-sm text-rose-700">
                  {field === "newPassword" ? m.resetPasswordLength : m.passwordsDoNotMatch}
                </p>
              )}
            </div>
          ))}
          {failed && (
            <p role="alert" className="text-sm text-rose-700">
              {m.resetFailed}
            </p>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="min-h-11 w-full rounded-lg bg-emerald-900 px-4 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-900 disabled:opacity-60"
          >
            {isSubmitting ? m.resetSubmitting : m.resetSubmit}
          </button>
        </form>
      )}
      {(invalid || failed) && (
        <Link className="inline-flex min-h-11 items-center underline" href={routes.forgotPassword}>
          {m.resetRequestNew}
        </Link>
      )}
      <Link className="flex min-h-11 items-center text-emerald-900 underline" href={routes.login}>
        {m.backToLogin}
      </Link>
    </section>
  );
}
