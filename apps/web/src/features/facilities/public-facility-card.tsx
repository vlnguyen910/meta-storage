import type { CatalogFacility } from "@metastorage/contracts";
import { ArrowRight, Boxes, MapPin } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Currency } from "@/components/ui/display";
import { routes } from "@/config/routes";
import { facilitiesMessages as m } from "./facilities.messages";

export function PublicFacilityCard({ facility }: { facility: CatalogFacility }) {
  return (
    <article className="grid overflow-hidden rounded-lg border border-[#e2e8f0] bg-white shadow-[0_1px_3px_rgb(15_23_42/4%)] transition hover:border-[#125345]/30 hover:shadow-[0_8px_24px_rgb(18_83_69/8%)] md:grid-cols-[29%_1fr_240px]">
      <div className="relative min-h-[220px] bg-[#e8f5f1]">
        <Image
          src="/images/metastorage/storage-interior.png"
          alt={m.illustration}
          fill
          sizes="(max-width: 767px) 100vw, 360px"
          className="object-cover"
        />
        <span className="absolute top-3 left-3 rounded bg-[#125345] px-2.5 py-1 text-xs font-semibold text-white">
          {facility.code}
        </span>
        <span className="absolute right-3 bottom-3 rounded bg-black/65 px-2 py-1 text-[10px] text-white">
          {m.illustration}
        </span>
      </div>
      <div className="flex flex-col justify-center gap-4 p-6">
        <div>
          <Link
            href={`${routes.reservationNew}?facilityId=${encodeURIComponent(facility.id)}`}
            className="hover:text-[#125345]"
          >
            <h2 className="text-xl font-bold tracking-tight">{facility.name}</h2>
          </Link>
          <p className="mt-2 flex items-start gap-2 text-xs leading-6 text-[#64748b]">
            <MapPin size={15} className="mt-1" />
            {facility.address}
          </p>
        </div>
        {facility.description ? (
          <p className="text-sm text-[#64748b]">{facility.description}</p>
        ) : null}
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-2 rounded bg-[#e8f5f1] px-2.5 py-1.5 font-medium text-[#125345]">
            <span className="size-1.5 rounded-full bg-[#125345]" />
            {m.available(facility.availableUnits)}
          </span>
          <span className="inline-flex items-center gap-2 rounded bg-[#f8f9f8] px-2.5 py-1.5 text-[#64748b]">
            <Boxes size={14} />
            {m.inventory(facility.totalUnits)}
          </span>
        </div>
      </div>
      <div className="flex flex-col justify-center gap-3 border-t border-[#e2e8f0] bg-[#f8faf9] p-6 md:border-t-0 md:border-l">
        <span className="text-[10px] font-semibold tracking-wider text-[#64748b] uppercase">
          {m.price}
        </span>
        <div className="text-[#125345]">
          <span className="text-xs">{m.from} </span>
          <strong className="text-2xl">
            <Currency value={facility.startingMonthlyPrice} />
          </strong>
          <span className="mt-1 block text-xs text-[#64748b]">{m.monthly}</span>
        </div>
        <Link
          href={`${routes.reservationNew}?facilityId=${encodeURIComponent(facility.id)}`}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded bg-[#125345] px-3 text-sm font-semibold text-white hover:bg-[#0f4d3e]"
        >
          {m.details}
          <ArrowRight size={16} />
        </Link>
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(facility.address)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-8 items-center justify-center gap-1 text-xs text-[#125345] hover:underline"
        >
          <MapPin size={13} />
          {m.map}
        </a>
      </div>
    </article>
  );
}
