import { Button, Notice } from "../../../components/ui";
import { CUSTOMER_HOME as M } from "../customer-home.messages";

export function QueryFeedback({
  pending,
  error,
  retry,
  errorMessage = M.error,
}: {
  pending: boolean;
  error: boolean;
  retry: () => void;
  errorMessage?: string;
}) {
  return pending ? (
    <Notice>{M.pending}</Notice>
  ) : error ? (
    <>
      <Notice error>{errorMessage}</Notice>
      <Button label={M.retry} variant="outline" onPress={retry} />
    </>
  ) : null;
}
