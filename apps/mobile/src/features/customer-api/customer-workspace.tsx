import { focusManager, useQueryClient } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { useEffect, useState } from "react";
import {
  AppState,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { authClient } from "../../lib/auth-client";
import type { CustomerRoute } from "./customer-api.types";
import {
  CustomerBookingScreen,
  CustomerBookingsScreen,
  CustomerCatalogScreen,
  CustomerCheckoutScreen,
  CustomerHomeScreen,
  CustomerNotificationsScreen,
  CustomerPaymentScreen,
  CustomerRentalScreen,
  CustomerRentalsScreen,
  CustomerSupportNewScreen,
  CustomerSupportScreen,
  CustomerTicketScreen,
  CustomerTransactionsScreen,
} from "./customer-api-screens";
import {
  clearCustomerCommand,
  clearPrivateFiles,
  readCustomerCommand,
  saveCustomerCommand,
} from "./customer-native";

export function CustomerWorkspace({ owner }: { owner: string }) {
  const client = useQueryClient();
  const session = authClient.useSession();
  const userName = session.data?.user?.name ?? "Quý khách";
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
          chargeId: parsed.searchParams.get("chargeId") ?? undefined,
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
    case "transactions":
      screen = <CustomerTransactionsScreen owner={owner} go={go} />;
      break;
    case "notifications":
      screen = <CustomerNotificationsScreen go={go} />;
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
        {/* Top Header */}
        <View className="flex-row items-center justify-between border-b border-[#BFCAC4] bg-white px-4 py-2.5 shadow-xs">
          <View className="flex-row items-center gap-1.5">
            {stack.length > 1 && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Quay lại"
                onPress={() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s))}
                className="mr-1 py-1 pr-2 active:opacity-70"
              >
                <Text className="text-lg font-bold text-[#125345]">←</Text>
              </Pressable>
            )}
            <View className="flex-row items-center gap-1">
              <Text className="text-lg font-black text-[#125345]">storeX</Text>
              <Text className="text-xs font-bold text-emerald-500">●</Text>
            </View>
            <Text className="ml-1 text-xs text-slate-500 max-w-[120px]" numberOfLines={1}>
              {userName}
            </Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Lịch sử giao dịch"
              onPress={() => go({ screen: "transactions" })}
              className={`rounded-full px-2.5 py-1.5 border active:opacity-70 ${
                route.screen === "transactions"
                  ? "bg-[#125345] border-[#125345]"
                  : "bg-slate-50 border-slate-200"
              }`}
            >
              <Text
                className={`text-xs font-semibold ${route.screen === "transactions" ? "text-white" : "text-slate-700"}`}
              >
                💳 Giao dịch
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Thông báo"
              onPress={() => go({ screen: "notifications" })}
              className={`rounded-full px-2.5 py-1.5 border active:opacity-70 ${
                route.screen === "notifications"
                  ? "bg-[#125345] border-[#125345]"
                  : "bg-slate-50 border-slate-200"
              }`}
            >
              <Text
                className={`text-xs font-semibold ${route.screen === "notifications" ? "text-white" : "text-slate-700"}`}
              >
                🔔
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đăng xuất"
              onPress={() => {
                void Promise.all(
                  ["checkout", "payment", "support-draft"].map((k) =>
                    clearCustomerCommand(owner, k),
                  ),
                ).then(() => authClient.signOut());
              }}
              className="py-1 px-2 active:opacity-70"
            >
              <Text className="text-xs font-semibold text-rose-700">Thoát</Text>
            </Pressable>
          </View>
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

        {/* Bottom Tab Bar */}
        <View className="flex-row items-center justify-around border-t border-[#BFCAC4] bg-white py-2 px-1 shadow-lg">
          {[
            { screen: "home" as const, icon: "🏠", label: "Tổng quan" },
            { screen: "catalog" as const, icon: "🏢", label: "Tìm kho" },
            { screen: "rentals" as const, icon: "📦", label: "Kho của tôi" },
            { screen: "bookings" as const, icon: "📑", label: "Đơn đặt" },
            { screen: "support" as const, icon: "💬", label: "Hỗ trợ" },
          ].map((tab) => {
            const active = route.screen === tab.screen;
            return (
              <Pressable
                key={tab.screen}
                accessibilityRole="tab"
                accessibilityLabel={tab.label}
                onPress={() => {
                  if (tab.screen === "home") setStack([{ screen: "home" }]);
                  else go({ screen: tab.screen });
                }}
                className={`flex-1 items-center py-1 rounded-[6px] ${active ? "bg-[#E8F3EF]" : ""}`}
              >
                <Text className="text-base">{tab.icon}</Text>
                <Text
                  className={`text-[11px] font-semibold mt-0.5 ${
                    active ? "text-[#125345] font-bold" : "text-[#52635A]"
                  }`}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
