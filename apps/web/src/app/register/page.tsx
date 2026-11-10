import { Suspense } from "react";
import { PublicHeader } from "@/components/layout/public-header";
import { AuthFooter } from "@/features/auth/auth-footer";
import { RegisterForm } from "@/features/auth/register-form";

export const metadata = {
  title: "Đăng ký khách hàng",
};

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#faf8ff] text-slate-900 antialiased selection:bg-[#acf0d9] selection:text-[#002018]">
      {/* Header Navigation (Top Bar) */}
      <PublicHeader />

      {/* Main Canvas */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 md:py-12">
        <Suspense
          fallback={
            <div className="w-full max-w-[500px] rounded-[15px] bg-white p-8 border border-slate-200 shadow-xs text-center text-sm text-slate-500">
              Đang tải…
            </div>
          }
        >
          <RegisterForm />
        </Suspense>
      </main>

      <AuthFooter />
    </div>
  );
}
