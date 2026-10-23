"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, CheckCircle2, Mail, Ticket } from "lucide-react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { isMockMode } from "@/config/api-mode";
import { bookingLookupMessages as m } from "./booking-lookup.messages";
import { BookingLookupFormSchema, type BookingLookupFormValues } from "./booking-lookup.types";
import { useGuestAccessRequest } from "./use-guest-access-request";

export function BookingLookupForm() {
  const requestLink = useGuestAccessRequest();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BookingLookupFormValues>({
    resolver: zodResolver(BookingLookupFormSchema),
    defaultValues: { bookingCode: "", email: "" },
  });

  function startAgain() {
    requestLink.reset();
    reset();
  }

  return (
    <main className="mx-auto w-[min(1120px,calc(100%_-_40px))] py-12 sm:py-16">
      <nav aria-label="Đường dẫn trang" className="mb-8 text-sm text-slate-600">
        <Link className="rounded-sm hover:text-[#125345] focus-visible:outline-2" href="/">
          Trang chủ
        </Link>
        <span aria-hidden="true" className="px-2 text-slate-400">
          /
        </span>
        <span aria-current="page" className="font-semibold text-[#125345]">
          {m.title}
        </span>
      </nav>

      <section className="mx-auto max-w-3xl rounded border border-[#bfcac4] bg-white p-6 shadow-[0_2px_12px_rgba(19,27,46,0.04)] sm:p-10">
        {requestLink.submitted ? (
          <div className="py-4 text-center">
            <CheckCircle2 aria-hidden="true" className="mx-auto mb-4 size-12 text-[#125345]" />
            <h1 className="mb-3 text-2xl font-bold text-[#131b2e]" id="lookup-success-title">
              {m.title}
            </h1>
            <p className="mx-auto mb-7 max-w-xl leading-7 text-slate-600" role="status">
              {isMockMode ? m.mockSuccess : m.success}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                className="min-h-11 rounded border border-[#bfcac4] px-5 font-semibold text-[#125345] hover:bg-[#f2f8f6] focus-visible:outline-2 focus-visible:outline-offset-2"
                onClick={startAgain}
                type="button"
              >
                {m.tryAgain}
              </button>
              <Link
                className="inline-flex min-h-11 items-center rounded bg-[#125345] px-5 font-semibold text-white hover:bg-[#0d4338] focus-visible:outline-2 focus-visible:outline-offset-2"
                href="/"
              >
                {m.home}
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <p className="mb-3 inline-flex items-center rounded bg-[#e8f3ef] px-3 py-1.5 text-sm font-semibold text-[#125345]">
                Tra cứu không cần đăng nhập
              </p>
              <h1 className="mb-3 text-3xl font-bold tracking-tight text-[#131b2e] sm:text-4xl">
                {m.title}
              </h1>
              <p className="max-w-2xl leading-7 text-slate-600">{m.description}</p>
            </div>

            {requestLink.error ? (
              <p
                className="mb-5 rounded border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800"
                role="alert"
              >
                {requestLink.error}
              </p>
            ) : null}

            <form className="space-y-6" noValidate onSubmit={handleSubmit(requestLink.request)}>
              <div>
                <label className="mb-2 block font-semibold text-[#131b2e]" htmlFor="bookingCode">
                  {m.bookingCode}
                </label>
                <div className="relative">
                  <Ticket
                    aria-hidden="true"
                    className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-500"
                  />
                  <input
                    autoCapitalize="characters"
                    autoComplete="off"
                    className="min-h-12 w-full rounded border border-[#bfcac4] bg-white pl-12 pr-4 uppercase tracking-wide text-[#131b2e] placeholder:normal-case placeholder:tracking-normal focus:border-[#125345] focus:outline-none focus:ring-2 focus:ring-[#125345]/20"
                    id="bookingCode"
                    maxLength={50}
                    placeholder={m.bookingCodePlaceholder}
                    {...register("bookingCode")}
                    aria-describedby={errors.bookingCode ? "bookingCode-error" : "bookingCode-hint"}
                    aria-invalid={Boolean(errors.bookingCode)}
                  />
                </div>
                {errors.bookingCode ? (
                  <p className="mt-2 text-sm text-rose-700" id="bookingCode-error">
                    {errors.bookingCode.message || m.bookingCodeRequired}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-slate-600" id="bookingCode-hint">
                    {m.bookingCodeHint}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-2 block font-semibold text-[#131b2e]" htmlFor="bookingEmail">
                  {m.email}
                </label>
                <div className="relative">
                  <Mail
                    aria-hidden="true"
                    className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-500"
                  />
                  <input
                    autoComplete="email"
                    className="min-h-12 w-full rounded border border-[#bfcac4] bg-white pl-12 pr-4 text-[#131b2e] placeholder:text-slate-400 focus:border-[#125345] focus:outline-none focus:ring-2 focus:ring-[#125345]/20"
                    id="bookingEmail"
                    maxLength={320}
                    placeholder={m.emailPlaceholder}
                    type="email"
                    {...register("email")}
                    aria-describedby={errors.email ? "bookingEmail-error" : "bookingEmail-hint"}
                    aria-invalid={Boolean(errors.email)}
                  />
                </div>
                {errors.email ? (
                  <p className="mt-2 text-sm text-rose-700" id="bookingEmail-error">
                    {errors.email.message || m.emailInvalid}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-slate-600" id="bookingEmail-hint">
                    {m.emailHint}
                  </p>
                )}
              </div>

              <button
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded bg-[#125345] px-6 font-semibold text-white transition-colors hover:bg-[#0d4338] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-70 sm:w-auto"
                disabled={isSubmitting || requestLink.pending}
                type="submit"
              >
                {isSubmitting || requestLink.pending ? m.submitting : m.submit}
                <ArrowRight aria-hidden="true" className="size-5" />
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
