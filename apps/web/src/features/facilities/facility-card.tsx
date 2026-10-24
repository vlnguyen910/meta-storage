"use client";

import { ArrowRight, MapPin } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { buttonClassName } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/display";
import { routes } from "@/config/routes";
import { cn } from "@/lib/cn";
import type { FacilityCatalogItem } from "./facility-catalog.types";

export function FacilityCard({
  facility,
  protectedMode = false,
}: {
  facility: FacilityCatalogItem;
  protectedMode?: boolean;
}) {
  const imageIndex = Number.parseInt(facility.code.slice(-2), 10) % 3;

  return (
    <article className="overflow-hidden rounded-card border border-line bg-white shadow-soft transition duration-200 hover:-translate-y-1 hover:shadow-card">
      <div className={cn("relative h-[170px] overflow-hidden bg-[#e8f5f1]")}>
        <Image
          src={`/images/metastorage/unit-${imageIndex}.png`}
          alt={`Không gian ${facility.name}`}
          fill
          sizes="(max-width: 560px) 100vw, 33vw"
          className="object-cover transition duration-300 hover:scale-105"
        />
        <span className="absolute inset-0 bg-gradient-to-t from-slate-950/55 via-transparent to-transparent" />
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
