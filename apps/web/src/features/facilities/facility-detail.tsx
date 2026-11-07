"use client";

import { CheckCircle2, Clock3, MapPin, Phone, Ruler, ShieldCheck, Warehouse } from "lucide-react";
import Link from "next/link";
import { buttonClassName } from "@/components/ui/button";
import { Currency, StatusBadge } from "@/components/ui/display";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { routes } from "@/config/routes";
import { useAuthStore } from "@/features/auth/auth-store";
import { cn } from "@/lib/cn";
import { useAvailability, useFacility } from "./hooks";

export function FacilityDetail({ facilityId }: { facilityId: string }) {
  const facilityQuery = useFacility(facilityId);
  const availabilityQuery = useAvailability(facilityId);
  const session = useAuthStore((state) => state.session);
  if (facilityQuery.isLoading || availabilityQuery.isLoading) return <LoadingState />;
  if (facilityQuery.isError || availabilityQuery.isError || !facilityQuery.data)
    return (
      <ErrorState
        message="Không tìm thấy thông tin cơ sở."
        onRetry={() => {
          facilityQuery.refetch();
          availabilityQuery.refetch();
        }}
      />
    );
  const facility = facilityQuery.data;
  const reservationPath = `${routes.customer.newReservation}?facilityId=${facility.id}`;
  const ctaPath = session
    ? reservationPath
    : `${routes.login}?returnTo=${encodeURIComponent(reservationPath)}`;
  const visualTone = facility.code.startsWith("HCM")
    ? "bg-gradient-to-br from-primary to-[#2d9077]"
    : facility.code.startsWith("HN")
      ? "bg-gradient-to-br from-slate-700 to-secondary"
      : "bg-gradient-to-br from-[#29664b] to-[#77a564]";
  return (
    <div>
      <div
        className={cn(
          "flex min-h-[330px] items-end justify-between overflow-hidden rounded-[25px] p-12 text-white max-[800px]:min-h-[290px] max-[800px]:p-8",
          visualTone,
        )}
      >
        <div>
          <StatusBadge value={facility.status} />
          <h1 className="my-4 text-5xl font-bold max-[800px]:text-4xl">{facility.name}</h1>
          <p className="flex items-center gap-2 text-[#e4f1ed]">
            <MapPin />
            {facility.address.line1}, {facility.address.district}, {facility.address.city}
          </p>
        </div>
        <Warehouse className="max-[800px]:hidden" size={110} />
      </div>
      <div className="mt-7 grid grid-cols-[minmax(0,1fr)_340px] items-start gap-7 max-[800px]:grid-cols-1">
        <div className="grid gap-6">
          <section className="rounded-card border border-line bg-white p-6 shadow-soft">
            <h2 className="text-2xl font-bold">Không gian an toàn, dễ tiếp cận</h2>
            <p className="text-muted">{facility.description}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              {facility.features.map((feature) => (
                <span
                  className="flex items-center gap-1.5 rounded-[9px] bg-primary-soft px-3 py-2 text-sm font-bold text-primary"
                  key={feature}
                >
                  <CheckCircle2 className="size-4" />
                  {feature}
                </span>
              ))}
            </div>
          </section>
          <section>
            <div className="mb-8 flex items-end justify-between gap-6">
              <div>
                <span className="mb-2.5 inline-block text-xs font-extrabold tracking-[0.13em] text-primary uppercase">
                  Bảng giá tham khảo
                </span>
                <h2 className="text-3xl font-bold">Chọn không gian phù hợp</h2>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3.5 max-[1024px]:grid-cols-2 max-[560px]:grid-cols-1">
              {availabilityQuery.data?.map((option) => (
                <article
                  className="grid gap-2 rounded-card border border-line bg-white p-5"
                  key={`${option.unitType}-${option.sizeLabel}`}
                >
                  <div className="flex items-center justify-between text-primary">
                    <Ruler />
                    <span>{option.sizeLabel}</span>
                  </div>
                  <h3 className="m-0 font-bold">{option.unitType}</h3>
                  <p className="m-0 text-xs text-muted">
                    Phù hợp khoảng {option.sizeSqm * 5} thùng đồ tiêu chuẩn
                  </p>
                  <strong className="mt-2 text-primary">
                    <Currency value={option.monthlyPrice} />{" "}
                    <small className="text-muted">/ tháng</small>
                  </strong>
                  <span
                    className={cn(
                      "text-xs font-bold",
                      option.availableCount ? "text-accent" : "text-danger",
                    )}
                  >
                    {option.availableCount ? `Còn ${option.availableCount} chỗ` : "Tạm hết chỗ"}
                  </span>
                </article>
              ))}
            </div>
          </section>
        </div>
        <aside className="sticky top-[100px] grid gap-4 rounded-card border border-line bg-white p-6 shadow-soft max-[800px]:static">
          <span className="mb-0 inline-block text-xs font-extrabold tracking-[0.13em] text-primary uppercase">
            Đặt chỗ trực tuyến
          </span>
          <h2 className="m-0 text-2xl font-bold text-primary">
            Từ <Currency value={facility.startingMonthlyPrice} />
          </h2>
          <p className="text-muted">Tiền cọc bằng một tháng thuê. Hoàn tất trong vài phút.</p>
          <div className="grid gap-3 border-y border-line py-4 text-sm">
            <span className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" />
              {facility.availableUnits} unit còn trống
            </span>
            <span className="flex items-center gap-2">
              <Clock3 className="size-4 text-primary" />
              {facility.openingHours}
            </span>
            <span className="flex items-center gap-2">
              <Phone className="size-4 text-primary" />
              {facility.phone}
            </span>
          </div>
          <Link href={ctaPath} className={buttonClassName("primary", "w-full")}>
            Bắt đầu đặt kho
          </Link>
          <small className="text-center text-muted">
            Chưa bị tính phí cho đến bước xác nhận cuối.
          </small>
        </aside>
      </div>
    </div>
  );
}
