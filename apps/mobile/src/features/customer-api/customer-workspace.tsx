import { focusManager, useQueryClient } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { useEffect, useRef, useState } from "react";
import {
  AppState,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { ScreenFrame } from "../../components/ui/screen-frame";
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
import { CustomerNavDrawer } from "./customer-nav-drawer";
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
  onHome?: () => void;
}) {
  const client = useQueryClient();
  const session = authClient.useSession();
  const email = session.data?.user?.email;
  const [drawerVisible, setDrawerVisible] = useState(false);
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
        if (onHome) onHome();
        return true;
      }
      setStack((s) => s.slice(0, -1));
      return true;
    });
    return () => listener.remove();
  }, [stack.length, onHome]);

  const selectedTab: "home" | "catalog" | "rentals" | "transactions" | "support" = [
    "booking",
    "bookings",
    "payment",
    "rental",
    "rentals",
  ].includes(route.screen)
    ? "rentals"
    : route.screen === "transactions"
      ? "transactions"
      : ["ticket", "support", "support-new"].includes(route.screen)
        ? "support"
        : ["catalog", "checkout"].includes(route.screen)
          ? "catalog"
          : "home";

  const handleSelectTab = (key: "home" | "catalog" | "rentals" | "transactions" | "support") => {
    if (key === "home") {
      setStack([{ screen: "home" }]);
    } else {
      setStack([{ screen: "home" }, { screen: key }]);
    }
  };

  const handleLogout = () => {
    void Promise.all(
      ["checkout", "reservation-checkout-v2", "payment", "support-draft"].map((key) =>
        clearCustomerCommand(owner, key),
      ),
    ).then(() => authClient.signOut());
  };

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
          reservationId: parsed.searchParams.get("reservationId") ?? undefined,
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
        {/* Top Header */}
        <View className="border-b border-slate-200 bg-white px-4 py-2.5 shadow-2xs">
          <View className="mx-auto w-full max-w-3xl flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              {stack.length > 1 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Quay lại"
                  onPress={() => setStack((s) => s.slice(0, -1))}
                  className="mr-1 h-9 w-9 items-center justify-center rounded-xl bg-slate-100 active:bg-slate-200"
                >
                  <Text className="text-lg font-bold text-slate-800">←</Text>
                </Pressable>
              ) : null}

              {/* Menu Drawer Toggle Button */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Mở danh mục điều hướng"
                onPress={() => setDrawerVisible(true)}
                className="h-10 w-10 items-center justify-center rounded-xl bg-[#0B2F24] active:bg-[#184E40]"
              >
                <Text className="text-base font-black text-[#52D1A6]">☰</Text>
              </Pressable>

              <View>
                <View className="flex-row items-center gap-1">
                  <Text className="text-base font-black text-[#0B2F24]">storeX</Text>
                  <Text className="text-xs font-bold text-[#52D1A6]">●</Text>
                </View>
                <Text numberOfLines={1} className="text-[11px] text-slate-500 max-w-[140px]">
                  {name}
                </Text>
              </View>
            </View>

            {/* Right Quick Controls */}
            <View className="flex-row items-center gap-2">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Thông báo"
                onPress={() => go({ screen: "notifications" })}
                className="h-9 w-9 items-center justify-center rounded-xl bg-slate-100 active:bg-slate-200"
              >
                <Text className="text-sm">🔔</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Đăng xuất"
                onPress={handleLogout}
                className="h-9 w-9 items-center justify-center rounded-xl bg-slate-100 active:bg-slate-200"
              >
                <Text className="text-sm text-slate-700">↪</Text>
              </Pressable>
            </View>
          </View>
        </View>

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

        {/* Dark Green Bottom Navigation Bar Matching User Design */}
        <View className="border-t border-[#184E40] bg-[#0B2F24] px-1 py-1.5 shadow-lg">
          <View className="mx-auto w-full max-w-3xl flex-row items-center justify-around">
            {U.tabs.map((tab) => {
              const isActive = selectedTab === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  accessibilityRole="tab"
                  accessibilityLabel={tab.label}
                  accessibilityState={{ selected: isActive }}
                  onPress={() => handleSelectTab(tab.key)}
                  className={`flex-1 items-center justify-center py-1.5 rounded-xl ${
                    isActive ? "bg-[#184E40]" : "bg-transparent"
                  }`}
                >
                  <Text className={`text-base ${isActive ? "text-[#52D1A6]" : "text-[#8FAFA5]"}`}>
                    {tab.icon}
                  </Text>
                  <Text
                    numberOfLines={1}
                    className={`mt-0.5 text-[10px] font-bold ${
                      isActive ? "text-white" : "text-[#8FAFA5]"
                    }`}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Slide-over Dark Green Drawer Modal */}
        <CustomerNavDrawer
          visible={drawerVisible}
          onClose={() => setDrawerVisible(false)}
          currentTab={selectedTab}
          onSelectTab={handleSelectTab}
          onOpenNotifications={() => go({ screen: "notifications" })}
          owner={owner}
          name={name}
          email={email}
          onLogout={handleLogout}
        />
      </KeyboardAvoidingView>
    </ScreenFrame>
  );
}
