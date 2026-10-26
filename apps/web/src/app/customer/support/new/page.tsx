import { Suspense } from "react";
import { CustomerSupportCreate } from "@/features/customer-support/support-screens";
export default function Page() {
  return (
    <Suspense>
      <CustomerSupportCreate />
    </Suspense>
  );
}
