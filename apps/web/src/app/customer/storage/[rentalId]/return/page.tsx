import { redirect } from "next/navigation";

export default function Page() {
  redirect("/customer/support/new?category=RETURN");
}
