import type { StorageNavigatorProps } from "../common/my-storage.types";
import { StorageHeader } from "../features/my-storage/components/storage-header";
import { StorageOverlays } from "../features/my-storage/components/storage-overlays";
import { useMyStorage } from "../features/my-storage/use-my-storage";
import { RentalHistoryScreen } from "../screens/rental/rental-history-screen";
import { RentalTransactionsScreen } from "../screens/rental/rental-transactions-screen";
import { RentalsScreen } from "../screens/rental/rentals-screen";
export function MyStorageNavigator(props: StorageNavigatorProps) {
  const state = useMyStorage(props.owner, props.view);
  return (
    <>
      <StorageHeader
        state={state}
        view={props.view}
        onView={(view) => {
          state.setSelection(null);
          props.onView(view);
        }}
        onBook={props.onBook}
      />
      {props.view === "current" ? (
        <RentalsScreen state={state} onUnavailable={props.onUnavailable} />
      ) : props.view === "history" ? (
        <RentalHistoryScreen state={state} onRebook={props.onRebook} />
      ) : (
        <RentalTransactionsScreen state={state} />
      )}
      <StorageOverlays state={state} />
    </>
  );
}
