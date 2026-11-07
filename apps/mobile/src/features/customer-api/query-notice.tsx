import { CUSTOMER_WORKSPACE as M } from "@metastorage/shared";
import { Button, Notice } from "../../components/ui/mobile-ui";
import { customerError } from "./use-customer-ticket";

export function QueryNotice({
  query,
}: {
  query: { isPending: boolean; isError: boolean; error: unknown; refetch: () => unknown };
}) {
  return query.isPending ? (
    <Notice>{M.loading}</Notice>
  ) : query.isError ? (
    <>
      <Notice error>{customerError(query.error)}</Notice>
      <Button label={M.retry} onPress={() => void query.refetch()} />
    </>
  ) : null;
}
