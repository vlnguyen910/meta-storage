import { EmptyState } from "@/components/ui/states";
import { OPERATIONS_MESSAGES as M } from "../operations.messages";
export function OperationsFeesView() {
  return <EmptyState title={M.rentalFeesRetired} description={M.rentalFeesRetiredHint} />;
}
