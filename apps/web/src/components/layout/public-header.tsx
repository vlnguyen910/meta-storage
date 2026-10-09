"use client";

import { APP_NAME } from "@metastorage/shared";

import { Menu, Warehouse, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { roleHome, routes } from "@/config/routes";
import { useAuthStore } from "@/features/auth/auth-store";

export function PublicHeader() {
  const [open, setOpen] = useState(false);
  const session = useAuthStore((state) => state.session);
  return (
    <header className="sticky top-0 z-40 flex h-[74px] items-center border-b border-line bg-white/90 backdrop-blur-[14px]">
      <div className="mx-auto flex w-[min(1180px,calc(100%_-_40px))] items-center justify-between max-[800px]:w-[min(100%_-_28px,680px)]">
        <Link
          href={routes.home}
          className="inline-flex items-center gap-2.5 text-[1.35rem] font-extrabold tracking-[-0.04em]"
          aria-label="metastorage trang chủ"
        >
          <span className="grid size-[38px] place-items-center rounded-[11px] bg-primary text-white">
            <Warehouse size={22} />
          </span>
          <span>{APP_NAME}</span>
        </Link>
        <button
          type="button"
          className="hidden cursor-pointer border-0 bg-transparent p-2 text-inherit max-[800px]:grid max-[800px]:place-items-center"
          onClick={() => setOpen((value) => !value)}
          aria-label="Mở menu"
        >
          {open ? <X /> : <Menu />}
        </button>
        <nav
          className={`${open ? "max-[800px]:grid" : "max-[800px]:hidden"} flex items-center gap-7 font-semibold text-slate-700 max-[800px]:absolute max-[800px]:top-[66px] max-[800px]:right-3.5 max-[800px]:left-3.5 max-[800px]:items-stretch max-[800px]:rounded-card max-[800px]:border max-[800px]:border-line max-[800px]:bg-white max-[800px]:p-[18px] max-[800px]:shadow-card`}
        >
          <Link className="hover:text-primary max-[800px]:p-2" href={routes.home}>
            Trang chủ
          </Link>
          <Link className="hover:text-primary max-[800px]:p-2" href={routes.facilities}>
            Tìm kho
          </Link>
          <a className="hover:text-primary max-[800px]:p-2" href={`${routes.home}#how-it-works`}>
            Cách hoạt động
          </a>
          <Link
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-[18px] font-bold text-white shadow-[0_6px_18px_rgb(22_95_77_/_20%)] transition hover:-translate-y-px hover:bg-primary-dark max-[800px]:mt-1"
            href={session?.user.role ? roleHome[session.user.role] : routes.login}
          >
            {session ? "Vào dashboard" : "Đăng nhập"}
          </Link>
        </nav>
      </div>
    </header>
  );
}
