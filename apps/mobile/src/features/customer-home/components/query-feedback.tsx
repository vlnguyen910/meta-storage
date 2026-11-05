import { Button, Notice } from "../../../components/ui";
import { CUSTOMER_HOME as M } from "../customer-home.messages";

export function QueryFeedback({
  pending,
  error,
  retry,
}: {
  pending: boolean;
  error: boolean;
  retry: () => void;
}) {
  return pending ? (
    <Notice>{M.pending}</Notice>
  ) : error ? (
    <>
      <Notice error>{M.error}</Notice>
      <Button label={M.retry} variant="outline" onPress={retry} />
    </>
  ) : null;
}
