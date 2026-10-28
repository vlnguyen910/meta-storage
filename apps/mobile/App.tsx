import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Linking, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Button, Notice } from "./src/components/ui/mobile-ui";
import { WORKSPACE_UI } from "./src/components/ui/workspace-ui.messages";
import { AuthScreen } from "./src/features/auth/auth-screen";
import type { CustomerRoute } from "./src/features/customer-api/customer-api.types";
import { CustomerWorkspace } from "./src/features/customer-api/customer-workspace";
import { PublicWorkspace } from "./src/features/landing/landing-screen";
import { MobileApp } from "./src/features/mobile-shell/mobile-app";
import { STAFF_API_UI } from "./src/features/staff-api/staff-api.messages";
import { StaffWorkspace } from "./src/features/staff-api/staff-workspace";
import { authClient } from "./src/lib/auth-client";
import "./global.css";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1 } } });

function ConnectedScreens() {
  const session = authClient.useSession();
  const user = session.data?.user;
  const role = user && "role" in user ? user.role : undefined;
  const [view, setView] = useState<"public" | "auth" | "workspace">("public");
  const [destination, setDestination] = useState<CustomerRoute>();
  const [callbackUrl, setCallbackUrl] = useState<string>();
  useEffect(() => {
    const handleUrl = (url: string | null) => {
      if (!url?.startsWith("metastorage://")) return;
      const parsed = new URL(url);
      if (parsed.hostname === "auth") {
        setCallbackUrl(url);
        setView("auth");
      } else if (parsed.hostname === "payment-result") {
        const id = parsed.searchParams.get("paymentId");
        if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return;
        setDestination({
          screen: "payment",
          id,
          bookingId: parsed.searchParams.get("bookingId") ?? undefined,
        });
        setView("auth");
      }
    };
    void Linking.getInitialURL().then(handleUrl);
    const listener = Linking.addEventListener("url", (event) => handleUrl(event.url));
    return () => listener.remove();
  }, []);
  useEffect(() => {
    if (user && view === "auth") setView("workspace");
  }, [user, view]);
  const openAccount = () => {
    setDestination(undefined);
    setView(user ? "workspace" : "auth");
  };

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        {view === "public" || (!user && view === "workspace") ? (
          <PublicWorkspace
            signedIn={Boolean(user)}
            onLogin={openAccount}
            onBook={(route) => {
              setDestination(route);
              setView(user ? "workspace" : "auth");
            }}
          />
        ) : !user ? (
          <AuthScreen callbackUrl={callbackUrl} onBack={() => setView("public")} />
        ) : role === "CUSTOMER" ? (
          <CustomerWorkspace
            key={user.id}
            owner={user.id}
            name={user.name}
            initialRoute={destination}
            onHome={() => setView("public")}
          />
        ) : role === "FACILITY_STAFF" ? (
          <StaffWorkspace
            key={user.id}
            owner={user.id}
            name={user.name}
            onHome={() => setView("public")}
          />
        ) : user ? (
          <View className="flex-1 justify-center bg-slate-50 p-6">
            <Notice error>{STAFF_API_UI.noPermission}</Notice>
            <Button
              label={WORKSPACE_UI.logout}
              onPress={() => {
                void authClient.signOut();
              }}
            />
          </View>
        ) : null}
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

export default function App() {
  return process.env.EXPO_PUBLIC_API_MODE !== "demo" ? (
    <ConnectedScreens />
  ) : (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <MobileApp />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
