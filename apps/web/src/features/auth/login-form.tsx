"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { UserRole } from "@metastorage/contracts";
import axios from "axios";
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { FieldShell, Input } from "@/components/ui/form-controls";
import { useToast } from "@/components/ui/toast";
import { isMockMode } from "@/config/api-mode";
import { roleHome, routes, safeReturnTo } from "@/config/routes";
import { api } from "@/lib/api";
import { demoAccounts } from "@/mocks/seeds";
import { AUTH_MESSAGES } from "./auth.messages";
import { useAuthStore } from "./auth-store";

const schema = z.object({
  email: z.string().email(AUTH_MESSAGES.invalidEmail),
  password: z.string().min(8, AUTH_MESSAGES.passwordTooShort),
});
type FormValues = z.infer<typeof schema>;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setSession = useAuthStore((state) => state.setSession);
  const { showToast } = useToast();
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: isMockMode
      ? { email: "customer@metastorage.test", password: "Demo@123" }
      : { email: "", password: "" },
  });

  async function onSubmit(values: FormValues) {
    try {
      const session = await api.auth.login(values);
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
        ? (error.response?.data as { code?: string; message?: string } | undefined)
        : undefined;
      const message =
        responseData?.code === "EMAIL_NOT_VERIFIED"
          ? AUTH_MESSAGES.loginEmailNotVerified
          : responseData?.message;
      showToast(message ?? AUTH_MESSAGES.loginFailed, "error");
    }
  }

  return (
    <div className="w-full max-w-[620px] justify-self-end rounded-[22px] bg-white p-9 shadow-card max-[800px]:justify-self-center max-[560px]:p-[24px_18px]">
      <div className="flex items-center gap-4">
        <span className="grid size-[50px] place-items-center rounded-[14px] bg-primary text-white">
          <LockKeyhole />
        </span>
        <div>
          <span className="mb-2.5 inline-block text-xs font-extrabold tracking-[0.13em] text-primary uppercase">
            Khu vực thành viên
          </span>
          <h1 className="m-0 text-3xl font-bold">Đăng nhập metastorage</h1>
        </div>
      </div>
      <p className="mb-6 text-muted">
        Truy cập reservation, kho đang thuê và công việc vận hành của bạn.
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
        <FieldShell label="Email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" {...register("email")} />
        </FieldShell>
        <FieldShell label="Mật khẩu" error={errors.password?.message}>
          <Input type="password" autoComplete="current-password" {...register("password")} />
        </FieldShell>
        <div className="flex items-center justify-between text-sm max-[560px]:items-start max-[560px]:gap-2.5">
          <label className="flex items-center gap-2 text-muted">
            <input type="checkbox" /> Ghi nhớ email
          </label>
          <Link className="font-bold text-primary" href={routes.forgotPassword}>
            Quên mật khẩu?
          </Link>
        </div>
        <Button type="submit" loading={isSubmitting} icon={<ArrowRight size={18} />}>
          Đăng nhập
        </Button>
      </form>
      {isMockMode ? (
        <div className="mt-5 rounded-[14px] bg-[#f5f8f7] p-4">
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck size={18} />
            <strong>Tài khoản demo</strong>
            <span className="ml-auto text-xs text-muted">Mật khẩu: Demo@123</span>
          </div>
          <div className="grid grid-cols-2 gap-2 max-[560px]:grid-cols-1">
            {demoAccounts.map((account) => (
              <button
                key={account.email}
                type="button"
                className="cursor-pointer rounded-[9px] border border-[#dce4e1] bg-white p-2.5 text-left hover:border-primary"
                onClick={() => {
                  setValue("email", account.email, { shouldValidate: true });
                  setValue("password", "Demo@123", { shouldValidate: true });
                }}
              >
                <strong className="block text-xs">{account.label}</strong>
                <small className="mt-1 block text-[0.68rem] text-muted">{account.email}</small>
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {!isMockMode ? (
        <p className="mb-0 mt-5 text-center text-sm text-muted">
          Chưa có tài khoản?{" "}
          <Link className="font-bold text-primary" href={routes.register}>
            Đăng ký Customer
          </Link>
        </p>
      ) : null}
    </div>
  );
}
