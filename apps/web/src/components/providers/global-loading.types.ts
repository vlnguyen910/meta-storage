export type GlobalLoadingContextValue = {
  manualCount: number;
  navigationCount: number;
  clearNavigationLoading: () => void;
  startNavigationLoading: () => () => void;
  runWithGlobalLoading: <T>(operation: () => Promise<T>) => Promise<T>;
};
