import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import type { CustomerRoute } from "../../../common/customer-api.types";
import { ScreenFrame } from "../../../components/ui/screen-frame";
import { WorkspaceHeader, WorkspaceTabs } from "../../../components/ui/workspace-ui";
import {
  clearCustomerCommand,
  clearPrivateFiles,
} from "../../../features/customer-api/customer-native";
import { CUSTOMER_MOBILE_UI as U } from "../../../features/customer-api/customer-ui.messages";
import { useCustomerPaymentRecovery } from "../../../features/customer-api/use-customer-payment-recovery";
import { authClient } from "../../../lib/auth-client";
import { NotificationScreen } from "../notifications/notification-screen";
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
import { CustomerTransactionsScreen } from "./customer-transactions-screen";

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

  const restorePayment = useCallback((payment: Extract<CustomerRoute, { screen: "payment" }>) => {
    setStack((current) => {
      const top = current.at(-1);
      return top?.screen === "payment" &&
        top.id === payment.id &&
        top.reservationId === payment.reservationId
        ? current
        : [{ screen: "home" }, payment];
    });
  }, []);
  useCustomerPaymentRecovery(owner, restorePayment);
  // biome-ignore lint/correctness/useExhaustiveDependencies: changing accounts must clear the previous account's private cache.
  useEffect(() => {
    clearPrivateFiles();
    return () => {
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
        <CustomerPaymentScreen
          owner={owner}
          id={route.id}
          reservationId={route.reservationId}
          go={go}
        />
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
          reservationId={route.reservationId}
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
              ["checkout", "reservation-checkout-v2", "payment", "support-draft"].map((key) =>
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
