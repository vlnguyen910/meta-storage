import { Suspense } from "react";
import { PublicHeader } from "@/components/layout/public-header";
import { AuthFooter } from "@/features/auth/auth-footer";
import { LoginForm } from "@/features/auth/login-form";

export const metadata = {
  title: "Đăng nhập",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#faf8ff] text-slate-900 antialiased selection:bg-[#acf0d9] selection:text-[#002018]">
      {/* Header Navigation (Top Bar) */}
      <PublicHeader />

      {/* Main Canvas */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 md:py-12">
        <Suspense
          fallback={
            <div className="w-full max-w-[440px] rounded-[15px] bg-white p-8 border border-slate-200 shadow-xs text-center text-sm text-slate-500">
              Đang tải…
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </main>

      <AuthFooter />
    </div>
  );
}
