import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppProviders } from "@/components/providers/app-providers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "metastorage - Kho lưu trữ linh hoạt",
    template: "%s | metastorage",
  },
  description: "Đặt và quản lý kho lưu trữ tự phục vụ an toàn, minh bạch.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
