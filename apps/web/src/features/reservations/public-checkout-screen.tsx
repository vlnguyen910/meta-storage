import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { PublicHeader } from "@/components/layout/public-header";
import { LoadingState } from "@/components/ui/states";
import { routes } from "@/config/routes";
import fontStyles from "@/features/facilities/metastorage-fonts.module.css";
import { checkoutMessages as m } from "./checkout.messages";
import s from "./checkout.module.css";
import { ReservationWizard } from "./reservation-wizard";

export function PublicCheckoutScreen() {
  return (
    <div className={`${s.checkout} ${s.shell} ${fontStyles.page}`}>
      <PublicHeader />
      <main className={s.main}>
        <Link
          className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm text-[#165f4d]"
          href={routes.facilities}
        >
          <ArrowLeft size={16} />
          {m.backToFacilities}
        </Link>
        <Suspense fallback={<LoadingState label={m.loading} variant="form" />}>
          <ReservationWizard />
        </Suspense>
      </main>
      <footer className={s.footer}>
        <strong>{m.footer}</strong>
        <span>{m.copyright}</span>
      </footer>
    </div>
  );
}
