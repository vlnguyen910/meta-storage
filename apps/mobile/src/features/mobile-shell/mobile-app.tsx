import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Heading, Notice } from "../../components/ui/mobile-ui";
import { SCREEN_TITLES } from "../../navigation/route.messages";
import { useMobileNavigation } from "../../navigation/use-mobile-navigation";
import { AuthScreens } from "../../screens/auth-screens";
import { CheckoutScreens } from "../../screens/checkout-screens";
import { CustomerScreens } from "../../screens/customer-screens";
import { PublicScreens } from "../../screens/public-screens";
import { StaffScreens } from "../../screens/staff-screens";
import { DEMO_MESSAGES } from "../demo/demo.messages";
import { mobileWorkflows } from "../demo/demo-client";
import { useMobileWorkspace } from "../demo/use-mobile-workspace";
import { SHELL_MESSAGES as m } from "./shell.messages";

export function MobileApp() {
  const workspace = useMobileWorkspace();
  const navigation = useMobileNavigation();
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollView>(null);
  const { data } = workspace;
  const { route, go, back } = navigation;
  const role = data?.session?.role;
  const customer = route.screen.startsWith("M-C") && !route.screen.startsWith("M-CK");
  const guestBooking =
    route.screen === "M-C03" && !role && !!data?.bookings.some((b) => b.id === route.id);
  const forbidden =
    !!data &&
    ((route.screen.startsWith("M-FS") && role !== "FACILITY_STAFF") ||
      (customer && role !== "CUSTOMER" && !guestBooking) ||
      (route.screen.startsWith("M-CK") && role === "FACILITY_STAFF"));
  const screen = forbidden ? "M-E01" : route.screen;
  const focusedRoute = `${screen}:${route.id ?? ""}`;
  const previousRoute = useRef(focusedRoute);
  const props = data ? { route, data, go, run: workspace.run, pending: workspace.pending } : null;
  useEffect(() => {
    if (previousRoute.current !== focusedRoute) {
      scroll.current?.scrollTo({ y: 0, animated: false });
      previousRoute.current = focusedRoute;
    }
    if (Platform.OS === "web") document.title = m.pageTitle(SCREEN_TITLES[screen]);
  }, [screen, focusedRoute]);
  return (
    <KeyboardAvoidingView
      className="flex-1 bg-[#F6F8F6]"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <StatusBar style="dark" />
      <View
        role={Platform.OS === "web" ? "banner" : undefined}
        className="border-b border-[#BFCAC4] bg-white px-4"
      >
        <View className="mx-auto w-full max-w-xl flex-row items-center justify-between gap-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={m.back}
            onPress={back}
            className="min-h-12 min-w-12 items-center justify-center"
          >
            <Text className="text-2xl text-[#125345]">←</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={m.home}
            onPress={() => go("M-P00")}
            className="min-h-12 flex-row items-center gap-2"
          >
            <View className="h-8 w-8 items-center justify-center rounded-[4px] bg-[#125345]">
              <Text className="text-lg font-bold text-white">S</Text>
            </View>
            <Text className="text-xl font-bold text-[#125345]">{m.brand}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={role ? m.logout : m.login}
            disabled={workspace.pending}
            onPress={() =>
              role
                ? void workspace.run(
                    () => mobileWorkflows.logout(),
                    () => go("M-P00"),
                  )
                : go("M-A01")
            }
            className="min-h-12 justify-center px-2"
          >
            <Text className="font-semibold text-[#125345]">{role ? m.logout : m.login}</Text>
          </Pressable>
        </View>
      </View>
      <ScrollView
        ref={scroll}
        role={Platform.OS === "web" ? "main" : undefined}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerClassName="flex-grow px-4 py-5"
        automaticallyAdjustKeyboardInsets
      >
        <View className="mx-auto w-full max-w-xl">
          <Notice>{DEMO_MESSAGES.mock}</Notice>
          {workspace.query.isPending ? (
            <>
              <ActivityIndicator accessibilityLabel={m.loading} color="#125345" />
              <Text className="mt-3 text-center text-[#52635A]">{m.loading}</Text>
            </>
          ) : workspace.query.isError ? (
            <>
              <Notice error>{workspace.query.error.message}</Notice>
              <Button label={m.retry} onPress={() => void workspace.query.refetch()} />
            </>
          ) : null}
          {workspace.message ? (
            <>
              <Notice error={workspace.error}>{workspace.message}</Notice>
              <Button label={m.dismiss} secondary onPress={workspace.clearMessage} />
            </>
          ) : null}
          {workspace.pending ? (
            <View className="mb-4 flex-row items-center gap-3">
              <ActivityIndicator color="#125345" />
              <Text accessibilityLiveRegion="polite" className="text-[#52635A]">
                {m.saving}
              </Text>
            </View>
          ) : null}
          {screen === "M-E01" || screen === "M-E02" ? (
            <>
              <Heading>{SCREEN_TITLES[screen]}</Heading>
              <Notice error>{screen === "M-E01" ? m.forbidden : m.notFound}</Notice>
              <Button label={m.home} onPress={() => go("M-P00")} />
              <Button
                label={m.returnOverview}
                secondary
                onPress={() =>
                  go(role === "FACILITY_STAFF" ? "M-FS01" : role === "CUSTOMER" ? "M-C01" : "M-A01")
                }
              />
            </>
          ) : props ? (
            <View key={`${route.screen}:${route.id ?? ""}`}>
              {screen.startsWith("M-P") ? (
                <PublicScreens {...props} />
              ) : screen.startsWith("M-A") ? (
                <AuthScreens {...props} />
              ) : screen.startsWith("M-CK") ? (
                <CheckoutScreens {...props} />
              ) : screen.startsWith("M-C") ? (
                <CustomerScreens {...props} />
              ) : screen.startsWith("M-FS") ? (
                <StaffScreens {...props} />
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>
      <View
        role={Platform.OS === "web" ? "navigation" : undefined}
        accessibilityLabel={m.navigation}
        className="border-t border-[#BFCAC4] bg-white"
      >
        <View className="mx-auto w-full max-w-xl flex-row">
          {(role === "FACILITY_STAFF"
            ? [
                ["M-FS01", m.tasks],
                ["M-FS02", SCREEN_TITLES["M-FS02"]],
                ["M-FS04", SCREEN_TITLES["M-FS04"]],
              ]
            : role === "CUSTOMER"
              ? [
                  ["M-C01", m.account],
                  ["M-C02", SCREEN_TITLES["M-C02"]],
                  ["M-C04", m.holds],
                  ["M-C06", m.rentals],
                ]
              : [
                  ["M-P00", m.home],
                  ["M-P01", m.find],
                  ["M-A01", m.account],
                ]
          ).map(([code, label]) => (
            <Pressable
              key={code}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected: route.screen === code }}
              aria-current={route.screen === code ? "page" : undefined}
              onPress={() => go(code as keyof typeof SCREEN_TITLES)}
              className="min-h-14 flex-1 justify-center px-1 py-3"
            >
              <Text
                className={`text-center text-xs font-semibold ${route.screen === code ? "text-[#125345]" : "text-[#52635A]"}`}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
