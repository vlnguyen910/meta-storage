import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/format";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        "rounded-card border border-line bg-surface p-6 text-ink shadow-soft",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function Currency({ value }: { value: number }) {
  return <>{formatCurrency(value)}</>;
}

export function StatusBadge({ value }: { value: string }) {
  const labels: Record<string, string> = {
    ACTIVE: "Đang hoạt động",
    AVAILABLE: "Còn trống",
    CONFIRMED: "Đã xác nhận",
    CANCELLED: "Đã hủy",
    NO_SHOW: "Không đến",
    CHECKED_IN: "Đã nhận kho",
    SUCCEEDED: "Đã thanh toán",
    PAID: "Đã thanh toán",
    PENDING: "Đang chờ thanh toán",
    FAILED: "Thanh toán thất bại",
    REFUNDED: "Đã hoàn tiền",
    REFUND_PENDING: "Chờ hoàn tiền",
    RESERVED: "Đã giữ chỗ",
    OCCUPIED: "Đang thuê",
    MAINTENANCE: "Bảo trì",
    OVERDUE: "Quá hạn",
    RETURN_PENDING: "Đang trả kho",
    COMPLETED: "Đã hoàn tất",
    CLOSED: "Đã kết thúc",
    DRAFT: "Bản nháp",
    SCHEDULED: "Đã lên lịch",
    PASSED: "Đạt tiêu chuẩn",
    UNPAID: "Chưa thanh toán",
    PARTIALLY_PAID: "Thanh toán một phần",
    TERMINATED: "Đã chấm dứt",
  };
  const positive = [
    "ACTIVE",
    "AVAILABLE",
    "CONFIRMED",
    "SUCCEEDED",
    "PAID",
    "COMPLETED",
    "PASSED",
  ].includes(value);
  const info = ["CHECKED_IN", "OCCUPIED", "IN_PROGRESS", "SCHEDULED"].includes(value);
  const danger = ["FAILED", "OVERDUE", "NO_SHOW", "UNPAID"].includes(value);
  const warning = [
    "PENDING",
    "RESERVED",
    "RETURN_PENDING",
    "MAINTENANCE",
    "REFUND_PENDING",
    "PARTIALLY_PAID",
  ].includes(value);
  return (
    <span
      className={cn(
        "inline-flex min-h-[26px] w-fit items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        positive && "border-emerald-200/80 bg-emerald-50 text-emerald-800",
        info && "border-sky-200/80 bg-sky-50 text-sky-800",
        danger && "border-rose-200/80 bg-rose-50 text-rose-700",
        warning && "border-amber-200/80 bg-amber-50 text-amber-800",
        !positive && !info && !danger && !warning && "border-slate-200 bg-slate-100 text-slate-700",
      )}
    >
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          positive && "bg-emerald-600",
          info && "bg-sky-600",
          danger && "bg-rose-600",
          warning && "bg-amber-600",
          !positive && !info && !danger && !warning && "bg-slate-500",
        )}
      />
      {labels[value] ?? value}
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-[30px] flex items-end justify-between gap-6 max-[800px]:flex-col max-[800px]:items-start">
      <div>
        {eyebrow ? (
          <span className="mb-2.5 inline-block text-xs font-extrabold tracking-[0.13em] text-primary uppercase">
            {eyebrow}
          </span>
        ) : null}
        <h1 className="mb-2 text-4xl font-bold max-[560px]:text-3xl">{title}</h1>
        {description ? <p className="m-0 text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
