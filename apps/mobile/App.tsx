import { parseMobilePaymentReturn } from "@metastorage/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { useEffect, useRef, useState } from "react";
import { Linking, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Button, Notice, ScreenFrame } from "./src/components/ui";
import { ThemedActivityIndicator } from "./src/components/ui/native-styles";
import { WORKSPACE_UI } from "./src/components/ui/workspace-ui.messages";
import { AUTHENTICATION } from "./src/features/auth/authentication.messages";
import type { CustomerRoute } from "./src/features/customer-api/customer-api.types";
import { CustomerWorkspace } from "./src/features/customer-api/customer-workspace";
import { MobileApp } from "./src/features/mobile-shell/mobile-app";
import { STAFF_API_UI } from "./src/features/staff-api/staff-api.messages";
import { StaffWorkspace } from "./src/features/staff-api/staff-workspace";
import { authClient } from "./src/lib/auth-client";
import { AuthenticationScreen } from "./src/screens/authentication-screen";
import { MOBILE_FONTS } from "./src/theme/fonts";
import "./global.css";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1 } } });

function ConnectedScreens() {
  const session = authClient.useSession();
  const user = session.data?.user;
  const owner = user?.id;
  const previousOwner = useRef<string | undefined>(undefined);
  const role = user && "role" in user ? user.role : undefined;
  const [homeVisit, setHomeVisit] = useState(0);
  const [destination, setDestination] = useState<CustomerRoute>();
  const [callbackUrl, setCallbackUrl] = useState<string>();
  useEffect(() => {
    if (previousOwner.current && previousOwner.current !== owner) setDestination(undefined);
    previousOwner.current = owner;
    if (owner) setCallbackUrl(undefined);
  }, [owner]);
  useEffect(() => {
    const handleUrl = (url: string | null) => {
      const payment = parseMobilePaymentReturn(url);
      if (payment) {
        setDestination({
          screen: "payment",
          id: payment.paymentId,
          reservationId: payment.reservationId,
        });
      } else if (url && /^metastorage:\/\/auth(?:[/?#]|$)/.test(url)) {
        setCallbackUrl(url);
      } else if (url && /^https?:/.test(url)) {
        const error = new URL(url).searchParams.get("error");
        if (error) setCallbackUrl("metastorage://auth?error=google");
      }
    };
    void Linking.getInitialURL().then(handleUrl);
    const listener = Linking.addEventListener("url", (event) => handleUrl(event.url));
    return () => listener.remove();
  }, []);
  const openHome = () => {
    setDestination(undefined);
    setHomeVisit((visit) => visit + 1);
  };

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        {session.isPending ? (
          <ScreenFrame>
            <View className="flex-1 items-center justify-center bg-surface">
              <ThemedActivityIndicator
                accessibilityLabel={AUTHENTICATION.loading}
                className="text-primary"
              />
            </View>
          </ScreenFrame>
        ) : !user ? (
          <AuthenticationScreen callbackUrl={callbackUrl} />
        ) : role === "CUSTOMER" ? (
          <CustomerWorkspace
            key={`${user.id}:${homeVisit}`}
            owner={user.id}
            name={user.name}
            initialRoute={destination}
            onHome={openHome}
          />
        ) : role === "FACILITY_STAFF" ? (
          <StaffWorkspace
            key={`${user.id}:${homeVisit}`}
            owner={user.id}
            name={user.name}
            onHome={openHome}
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
  const [fontsLoaded, fontError] = useFonts(MOBILE_FONTS);
  if (!fontsLoaded && !fontError) return null;

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
