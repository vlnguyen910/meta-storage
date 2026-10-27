"use client";

import { Clock3, MapPin, Ruler, ShieldCheck, Warehouse } from "lucide-react";
import Link from "next/link";
import { buttonClassName } from "@/components/ui/button";
import { Currency, StatusBadge } from "@/components/ui/display";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { routes } from "@/config/routes";
import { cn } from "@/lib/cn";
import { facilitiesMessages as m } from "./facilities.messages";
import { useAvailability, useFacility } from "./hooks";

export function FacilityDetail({ facilityId }: { facilityId: string }) {
  const facilityQuery = useFacility(facilityId);
  const availabilityQuery = useAvailability(facilityId);
  if (facilityQuery.isLoading || availabilityQuery.isLoading)
    return <LoadingState variant="detail" />;
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
  const reservationPath = `${routes.reservationNew}?facilityId=${facility.id}`;
  const ctaPath = reservationPath;
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
          <StatusBadge value="ACTIVE" />
          <h1 className="my-4 text-5xl font-bold max-[800px]:text-4xl">{facility.name}</h1>
          <p className="flex items-center gap-2 text-[#e4f1ed]">
            <MapPin />
            {facility.address}
          </p>
        </div>
        <Warehouse className="max-[800px]:hidden" size={110} />
      </div>
      <div className="mt-7 grid grid-cols-[minmax(0,1fr)_340px] items-start gap-7 max-[800px]:grid-cols-1">
        <div className="grid gap-6">
          <section className="rounded-card border border-line bg-white p-6 shadow-soft">
            <h2 className="text-2xl font-bold">Không gian an toàn, dễ tiếp cận</h2>
            <p className="text-muted">
              {facility.description ?? "Thông tin facility đang được cập nhật."}
            </p>
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
            {availabilityQuery.data?.length ? (
              <div className="grid grid-cols-3 gap-3.5 max-[1024px]:grid-cols-2 max-[560px]:grid-cols-1">
                {availabilityQuery.data.map((option) => (
                  <article
                    className="grid gap-2 rounded-card border border-line bg-white p-5"
                    key={option.unitTypeId}
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
                      {option.availableCount === null
                        ? m.chooseSchedule
                        : m.available(option.availableCount)}
                    </span>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Chưa có loại kho phù hợp"
                description="Facility này hiện chưa có Unit Type để lựa chọn."
              />
            )}
          </section>
        </div>
        <aside className="sticky top-[100px] grid gap-4 rounded-card border border-line bg-white p-6 shadow-soft max-[800px]:static">
          <span className="mb-0 inline-block text-xs font-extrabold tracking-[0.13em] text-primary uppercase">
            Đặt chỗ trực tuyến
          </span>
          <h2 className="m-0 text-2xl font-bold text-primary">
            {m.from}{" "}
            {facility.startingMonthlyPrice === null ? (
              m.priceUnavailable
            ) : (
              <Currency value={facility.startingMonthlyPrice} />
            )}
          </h2>
          <p className="text-muted">Tiền cọc bằng một tháng thuê. Hoàn tất trong vài phút.</p>
          <div className="grid gap-3 border-y border-line py-4 text-sm">
            <span className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" />
              {m.chooseSchedule}
            </span>
            <span className="flex items-center gap-2">
              <Clock3 className="size-4 text-primary" />
              {m.scheduleAtCheckout}
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
