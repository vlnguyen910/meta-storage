"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { LoadingState } from "@/components/ui/states";
import { useAuthStore } from "@/features/auth/auth-store";
import { PublicCheckoutScreen } from "@/features/reservations/public-checkout-screen";

export default function PublicReservationPage() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const session = useAuthStore((state) => state.session);
  const hydrated = useAuthStore((state) => state.hydrated);
  useEffect(() => {
    if (hydrated && !session) {
      const returnTo = `${pathname}${search.toString() ? `?${search}` : ""}`;
      router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
    }
  }, [hydrated, pathname, router, search, session]);
  if (!hydrated || !session) return <LoadingState variant="form" />;
  return <PublicCheckoutScreen />;
}
