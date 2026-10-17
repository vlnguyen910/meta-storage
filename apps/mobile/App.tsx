import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthScreen } from "./src/features/auth/auth-screen";
import { MobileApp } from "./src/features/mobile-shell/mobile-app";
import { authClient } from "./src/lib/auth-client";
import { CheckInScreen } from "./src/screens/check-in-screen";
import "./global.css";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1 } } });

function ConnectedScreens() {
  const session = authClient.useSession();
  const user = session.data?.user;
  const role = user && "role" in user ? user.role : undefined;
  const canOperateCheckIn = role === "FACILITY_STAFF" || role === "FACILITY_MANAGER";

  return (
    <SafeAreaProvider>
      {user && canOperateCheckIn ? <CheckInScreen user={user} /> : <AuthScreen />}
    </SafeAreaProvider>
  );
}

export default function App() {
  return process.env.EXPO_PUBLIC_API_MODE === "api" ? (
    <ConnectedScreens />
  ) : (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <MobileApp />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
