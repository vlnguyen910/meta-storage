import { ArrowLeft, Warehouse } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { LoadingState } from "@/components/ui/states";
import { routes } from "@/config/routes";
import fontStyles from "@/features/facilities/metastorage-fonts.module.css";
import { checkoutMessages as m } from "./checkout.messages";
import s from "./checkout.module.css";
import { ReservationWizard } from "./reservation-wizard";

export function PublicCheckoutScreen() {
  return (
    <div className={`${s.checkout} ${s.shell} ${fontStyles.page}`}>
      <header className={s.header}>
        <div className={s.headerInner}>
          <Link className={s.headerBack} href={routes.facilities}>
            <ArrowLeft size={16} />
            {m.backToFacilities}
          </Link>
          <Link className={s.brand} href={routes.home}>
            <Warehouse size={25} />
            {m.brand}
          </Link>
          <span className={s.headerHint}>{m.contactDescription}</span>
        </div>
      </header>
      <main className={s.main}>
        <Suspense fallback={<LoadingState label={m.loading} />}>
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
