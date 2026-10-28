import { focusManager, useQueryClient } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { useEffect, useRef, useState } from "react";
import {
  AppState,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from "react-native";
import { ScreenFrame } from "../../components/ui/screen-frame";
import { WorkspaceHeader, WorkspaceTabs } from "../../components/ui/workspace-ui";
import { authClient } from "../../lib/auth-client";
import { NotificationScreen } from "../notifications/notification-screen";
import type { CustomerRoute } from "./customer-api.types";
import {
  CustomerBookingScreen,
  CustomerBookingsScreen,
  CustomerCatalogScreen,
  CustomerCheckoutScreen,
  CustomerHomeScreen,
  CustomerPaymentScreen,
  CustomerRentalScreen,
  CustomerRentalsScreen,
  CustomerSupportNewScreen,
  CustomerSupportScreen,
  CustomerTicketScreen,
} from "./customer-api-screens";
import {
  clearCustomerCommand,
  clearPrivateFiles,
  readCustomerCommand,
  saveCustomerCommand,
} from "./customer-native";
import { CustomerTransactionsScreen } from "./customer-transactions-screen";
import { CUSTOMER_MOBILE_UI as U } from "./customer-ui.messages";

export function CustomerWorkspace({
  owner,
  name,
  initialRoute,
  onHome,
}: {
  owner: string;
  name: string;
  initialRoute?: CustomerRoute;
  onHome: () => void;
}) {
  const client = useQueryClient();
  const [stack, setStack] = useState<CustomerRoute[]>(
    initialRoute ? [{ screen: "home" }, initialRoute] : [{ screen: "home" }],
  );
  const route = stack.at(-1) ?? { screen: "home" as const };
  const go = (next: CustomerRoute) => setStack((s) => [...s, next]);
  const scroll = useRef<ScrollView>(null);
  const routeKey = `${route.screen}:${"id" in route ? route.id : ""}`;
  const previousRoute = useRef(routeKey);
  useEffect(() => {
    if (previousRoute.current !== routeKey) {
      scroll.current?.scrollTo({ y: 0, animated: false });
      previousRoute.current = routeKey;
    }
  }, [routeKey]);
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const listener = BackHandler.addEventListener("hardwareBackPress", () => {
      if (stack.length < 2) {
        onHome();
        return true;
      }
      setStack((s) => s.slice(0, -1));
      return true;
    });
    return () => listener.remove();
  }, [stack.length, onHome]);
  const selectedTab = ["booking", "bookings", "payment"].includes(route.screen)
    ? "rentals"
    : ["rental", "rentals"].includes(route.screen)
      ? "rentals"
      : route.screen === "transactions"
        ? "transactions"
        : ["ticket", "support", "support-new"].includes(route.screen)
          ? "support"
          : ["catalog", "checkout"].includes(route.screen)
            ? "catalog"
            : "home";

  useEffect(() => {
    clearPrivateFiles();
    let active = true;
    const handleUrl = (url: string | null) => {
      if (!url || !active) return false;
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== "metastorage:" || parsed.hostname !== "payment-result")
          return false;
        const id = parsed.searchParams.get("paymentId");
        if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return false;
        const payment: CustomerRoute = {
          screen: "payment",
          id,
          bookingId: parsed.searchParams.get("bookingId") ?? undefined,
        };
        setStack([{ screen: "home" }, payment]);
        void saveCustomerCommand(owner, "payment", payment);
        return true;
      } catch {
        return false;
      }
    };
    void Linking.getInitialURL().then(async (url) => {
      if (handleUrl(url)) return;
      const saved = await readCustomerCommand<CustomerRoute>(owner, "payment");
      if (active && saved?.screen === "payment") setStack([{ screen: "home" }, saved]);
    });
    const links = Linking.addEventListener("url", (e) => {
      handleUrl(e.url);
    });
    const appState = AppState.addEventListener("change", (state) => {
      focusManager.setFocused(state === "active");
      if (state === "active") void client.invalidateQueries();
    });
    return () => {
      active = false;
      links.remove();
      appState.remove();
      void client.cancelQueries();
      client.clear();
      clearPrivateFiles();
    };
  }, [owner, client]);
  let screen: import("react").ReactNode = null;
  switch (route.screen) {
    case "transactions":
      screen = <CustomerTransactionsScreen owner={owner} go={go} />;
      break;
    case "notifications":
      screen = <NotificationScreen owner={owner} />;
      break;
    case "home":
      screen = <CustomerHomeScreen owner={owner} go={go} />;
      break;
    case "catalog":
      screen = <CustomerCatalogScreen go={go} />;
      break;
    case "bookings":
      screen = <CustomerBookingsScreen owner={owner} go={go} />;
      break;
    case "booking":
      screen = <CustomerBookingScreen owner={owner} id={route.id} go={go} />;
      break;
    case "checkout":
      screen = (
        <CustomerCheckoutScreen
          owner={owner}
          facilityId={route.facilityId}
          unitTypeId={route.unitTypeId}
          go={go}
        />
      );
      break;
    case "payment":
      screen = (
        <CustomerPaymentScreen owner={owner} id={route.id} bookingId={route.bookingId} go={go} />
      );
      break;
    case "rentals":
      screen = <CustomerRentalsScreen owner={owner} go={go} />;
      break;
    case "rental":
      screen = <CustomerRentalScreen owner={owner} id={route.id} go={go} />;
      break;
    case "support":
      screen = <CustomerSupportScreen owner={owner} go={go} />;
      break;
    case "support-new":
      screen = (
        <CustomerSupportNewScreen
          owner={owner}
          go={go}
          bookingId={route.bookingId}
          paymentId={route.paymentId}
        />
      );
      break;
    case "ticket":
      screen = <CustomerTicketScreen owner={owner} id={route.id} />;
      break;
  }
  return (
    <ScreenFrame>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <WorkspaceHeader
          name={name}
          subtitle={U.customer}
          onHome={onHome}
          onNotifications={() => go({ screen: "notifications" })}
          onBack={stack.length > 1 ? () => setStack((s) => s.slice(0, -1)) : undefined}
          onLogout={() => {
            void Promise.all(
              ["checkout", "payment", "support-draft"].map((key) =>
                clearCustomerCommand(owner, key),
              ),
            ).then(() => authClient.signOut());
          }}
        />
        <ScrollView
          ref={scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerClassName="grow px-4 py-6 sm:px-6"
        >
          <View
            className="mx-auto w-full max-w-3xl"
            key={`${route.screen}:${"id" in route ? route.id : ""}`}
          >
            {screen}
          </View>
        </ScrollView>
        <WorkspaceTabs
          tabs={U.tabs}
          selected={selectedTab}
          onSelect={(key) => {
            const tab = U.tabs.find((item) => item.key === key);
            if (tab)
              setStack(
                tab.key === "home"
                  ? [{ screen: "home" }]
                  : [{ screen: "home" }, { screen: tab.key }],
              );
          }}
        />
      </KeyboardAvoidingView>
    </ScreenFrame>
  );
}
