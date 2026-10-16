"use client";

import { ArrowRight, MapPin, ShieldCheck, Warehouse } from "lucide-react";
import Link from "next/link";
import { buttonClassName } from "@/components/ui/button";
import { Currency, StatusBadge } from "@/components/ui/display";
import { routes } from "@/config/routes";
import { cn } from "@/lib/cn";
import { facilitiesMessages as m } from "./facilities.messages";
import type { FacilityCatalogItem } from "./facility-catalog.types";

export function FacilityCard({
  facility,
  protectedMode = false,
}: {
  facility: FacilityCatalogItem;
  protectedMode?: boolean;
}) {
  const visualTone = facility.code.startsWith("HCM")
    ? "bg-gradient-to-br from-primary to-[#2d9077]"
    : facility.code.startsWith("HN")
      ? "bg-gradient-to-br from-slate-700 to-secondary"
      : "bg-gradient-to-br from-[#29664b] to-[#77a564]";

  return (
    <article className="overflow-hidden rounded-card border border-line bg-white shadow-soft transition duration-200 hover:-translate-y-1 hover:shadow-card">
      <div
        className={cn(
          "relative flex h-[170px] items-center justify-center text-white/80",
          visualTone,
        )}
      >
        <Warehouse size={42} />
        <span className="absolute top-3.5 left-3.5">
          <StatusBadge value="ACTIVE" />
        </span>
        <span className="absolute right-3.5 bottom-3 font-extrabold text-white">
          {facility.code}
        </span>
      </div>
      <div className="grid gap-4 p-5">
        <div>
          <h3 className="mb-2 text-lg font-bold">{facility.name}</h3>
          <p className="m-0 flex items-center gap-2 text-muted">
            <MapPin size={16} />
            {facility.address}
          </p>
        </div>
        <div className="grid gap-2 text-xs text-muted">
          <span className="flex items-center gap-2">
            <ShieldCheck size={16} />
            {m.chooseSchedule}
          </span>
        </div>
        <div className="flex items-baseline gap-1.5 border-t border-line pt-3.5">
          <span className="text-xs text-muted">Chỉ từ</span>
          <strong className="text-xl text-primary">
            {facility.startingMonthlyPrice === null ? (
              m.priceUnavailable
            ) : (
              <Currency value={facility.startingMonthlyPrice} />
            )}
          </strong>
          <small className="text-xs text-muted">/ tháng</small>
        </div>
        <Link
          className={buttonClassName("outline")}
          href={
            protectedMode
              ? `${routes.reservationNew}?facilityId=${facility.id}`
              : routes.facility(facility.id)
          }
        >
          Xem chi tiết <ArrowRight size={17} />
        </Link>
      </div>
    </article>
  );
}
