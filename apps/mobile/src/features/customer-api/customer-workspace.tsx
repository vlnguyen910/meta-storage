import { CUSTOMER_WORKSPACE as M } from "@metastorage/shared";
import { focusManager, useQueryClient } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { useEffect, useState } from "react";
import { AppState, KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../../components/ui/mobile-ui";
import { authClient } from "../../lib/auth-client";
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

export function CustomerWorkspace({ owner }: { owner: string }) {
  const client = useQueryClient();
  const [stack, setStack] = useState<CustomerRoute[]>([{ screen: "home" }]);
  const route = stack.at(-1) ?? { screen: "home" as const };
  const go = (next: CustomerRoute) => setStack((s) => [...s, next]);
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
    <SafeAreaView className="flex-1 bg-[#F6F8F6]">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View className="flex-row flex-wrap justify-between gap-2 border-b border-[#BFCAC4] bg-white p-3">
          <Button
            label={M.back}
            secondary
            onPress={() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s))}
          />
          <Button label={M.dashboard} secondary onPress={() => setStack([{ screen: "home" }])} />
          <Button
            label={M.logout}
            secondary
            onPress={() => {
              void Promise.all(
                ["checkout", "payment", "support-draft"].map((k) => clearCustomerCommand(owner, k)),
              ).then(() => authClient.signOut());
            }}
          />
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerClassName="grow p-4"
        >
          <View
            className="mx-auto w-full max-w-xl"
            key={`${route.screen}:${"id" in route ? route.id : ""}`}
          >
            {screen}
          </View>
        </ScrollView>
        <View className="flex-row flex-wrap justify-center gap-2 border-t border-[#BFCAC4] bg-white p-2">
          <Button label={M.facility} secondary onPress={() => go({ screen: "catalog" })} />
          <Button label={M.bookings} secondary onPress={() => go({ screen: "bookings" })} />
          <Button label={M.storage} secondary onPress={() => go({ screen: "rentals" })} />
          <Button label={M.support} secondary onPress={() => go({ screen: "support" })} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
