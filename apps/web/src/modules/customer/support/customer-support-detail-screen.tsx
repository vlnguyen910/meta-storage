"use client";

import { useRouter } from "next/navigation";
import { customerRoutes } from "@/config/routes";
import { CustomerSupportDialog } from "@/features/customer-support/customer-support-dialog";
import { CustomerSupportList } from "@/features/customer-support/support-screens";

export function CustomerSupportDetailScreen({
  ticketId,
  intercepted = false,
}: {
  ticketId: string;
  intercepted?: boolean;
}) {
  const router = useRouter();
  return (
    <>
      {!intercepted && <CustomerSupportList />}
      <CustomerSupportDialog
        ticketId={ticketId}
        onClose={() => {
          if (intercepted) router.back();
          else router.replace(customerRoutes.support, { scroll: false });
        }}
      />
    </>
  );
}
