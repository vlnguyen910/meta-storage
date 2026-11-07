import type { ReactNode } from "react";
import { BrandLogo } from "@/components/ui/brand-logo";
import { landingMessages as m } from "@/features/landing/landing.messages";
import { PublicHeader } from "./public-header";

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#faf8ff]">
      <PublicHeader />
      {children}
      <footer className="bg-[#0d352d] py-7 text-[#dcebe7]">
        <div className="mx-auto flex w-[min(1180px,calc(100%_-_40px))] items-center justify-between gap-6 max-[560px]:flex-col max-[560px]:text-center">
          <strong className="flex items-center gap-2">
            <BrandLogo />
            {m.brand}
          </strong>
          <span className="text-[#b2cbc5]">Kho lưu trữ linh hoạt, an tâm mỗi ngày.</span>
          <span className="text-[#b2cbc5]">© 2026 {m.brand}</span>
        </div>
      </footer>
    </div>
  );
}
