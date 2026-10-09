"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { type CustomerSignUpInput, CustomerSignUpInputSchema } from "@metastorage/contracts";
import { ArrowRight, MailCheck, UserRoundPlus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button, buttonClassName } from "@/components/ui/button";
import { FieldShell, Input } from "@/components/ui/form-controls";
import { isMockMode } from "@/config/api-mode";
import { routes } from "@/config/routes";
import { api } from "@/lib/api";
import { MOCK_MESSAGES } from "@/mocks/mock.messages";
import { AUTH_MESSAGES } from "./auth.messages";

export function RegisterForm() {
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CustomerSignUpInput>({
    resolver: zodResolver(CustomerSignUpInputSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      callbackTarget: "web",
    },
  });

  async function onSubmit(values: CustomerSignUpInput) {
    setFormError(null);
    try {
      await api.auth.registerCustomer(values);
      setRegisteredEmail(values.email.trim().toLowerCase());
    } catch (error) {
      const message = getResponseMessage(error);
      setFormError(message ?? AUTH_MESSAGES.registrationFailed);
    }
  }

  if (registeredEmail) {
    return (
      <section
        className="w-full max-w-[620px] rounded-[22px] bg-white p-9 text-center shadow-card max-[560px]:p-[24px_18px]"
        aria-labelledby="signup-success-title"
      >
        <span className="mx-auto grid size-[50px] place-items-center rounded-[14px] bg-primary text-white">
          <MailCheck aria-hidden="true" />
        </span>
        <h1 id="signup-success-title" className="mt-5 text-3xl font-bold">
          {isMockMode ? MOCK_MESSAGES.registeredTitle : "Kiểm tra hộp thư"}
        </h1>
        <p className="mt-3 text-muted">
          {isMockMode ? (
            MOCK_MESSAGES.registered
          ) : (
            <>
              Chúng tôi đã gửi liên kết xác minh đến{" "}
              <strong className="break-all text-ink">{registeredEmail}</strong>. Hãy xác minh email
              trước khi đăng nhập.
            </>
          )}
        </p>
        <Link className={`${buttonClassName("primary")} mt-6`} href={routes.login}>
          Đến trang đăng nhập <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </section>
    );
  }

  return (
    <section className="w-full max-w-[620px] rounded-[22px] bg-white p-9 shadow-card max-[560px]:p-[24px_18px]">
      <div className="flex items-center gap-4">
        <span className="grid size-[50px] place-items-center rounded-[14px] bg-primary text-white">
          <UserRoundPlus aria-hidden="true" />
        </span>
        <div>
          <span className="mb-2 inline-block text-xs font-extrabold tracking-[0.13em] text-primary uppercase">
            Tài khoản khách hàng
          </span>
          <h1 className="m-0 text-3xl font-bold">Tạo tài khoản metastorage</h1>
        </div>
      </div>
      <p className="mb-6 mt-3 text-muted">
        Dùng email để xác minh và kết nối an toàn với hồ sơ đặt kho của bạn.
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4" noValidate>
        <FieldShell label="Họ và tên" error={errors.name?.message}>
          <Input autoComplete="name" {...register("name")} />
        </FieldShell>
        <FieldShell label="Email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" {...register("email")} />
        </FieldShell>
        <FieldShell label="Số điện thoại" error={errors.phone?.message}>
          <Input type="tel" autoComplete="tel" inputMode="tel" {...register("phone")} />
        </FieldShell>
        <FieldShell label="Mật khẩu" error={errors.password?.message} hint="Tối thiểu 8 ký tự.">
          <Input type="password" autoComplete="new-password" {...register("password")} />
        </FieldShell>
        <FieldShell label="Nhập lại mật khẩu" error={errors.confirmPassword?.message}>
          <Input type="password" autoComplete="new-password" {...register("confirmPassword")} />
        </FieldShell>
        <input type="hidden" value="web" {...register("callbackTarget")} />
        {formError ? (
          <p className="m-0 text-sm text-danger" role="alert">
            {formError}
          </p>
        ) : null}
        <Button
          type="submit"
          loading={isSubmitting}
          icon={<ArrowRight size={18} aria-hidden="true" />}
        >
          Tạo tài khoản
        </Button>
      </form>
      <p className="mb-0 mt-5 text-center text-sm text-muted">
        Đã có tài khoản?{" "}
        <Link className="font-bold text-primary" href={routes.login}>
          Đăng nhập
        </Link>
      </p>
    </section>
  );
}

function getResponseMessage(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("response" in error)) return undefined;
  const response = error.response;
  if (!response || typeof response !== "object" || !("data" in response)) return undefined;
  const data = response.data;
  return data && typeof data === "object" && "message" in data && typeof data.message === "string"
    ? data.message
    : undefined;
}
