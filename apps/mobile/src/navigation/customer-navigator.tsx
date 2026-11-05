import { useEffect, useState } from "react";
import { BackHandler, Platform } from "react-native";
import type { CustomerNavigatorProps, CustomerRoute } from "../common/customer-home.types";
import { CustomerLayout } from "../features/customer-home/components/customer-layout";
import { CUSTOMER_HOME as M } from "../features/customer-home/customer-home.messages";
import { AppointmentDetailScreen } from "../screens/appointment-detail-screen";
import { AppointmentsScreen } from "../screens/appointments-screen";
import { HomeScreen } from "../screens/home-screen";

export function CustomerNavigator(props: CustomerNavigatorProps) {
  const [route, setRoute] = useState<CustomerRoute>({ screen: "home" });
  const home = () => setRoute({ screen: "home" });
  const back = () => setRoute({ screen: route.screen === "appointment" ? route.from : "home" });
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const listener = BackHandler.addEventListener("hardwareBackPress", () => {
      if (route.screen === "home") return false;
      setRoute({ screen: route.screen === "appointment" ? route.from : "home" });
      return true;
    });
    return () => listener.remove();
  }, [route]);
  useEffect(() => {
    if (Platform.OS === "web")
      document.title = `${route.screen === "home" ? M.title : route.screen === "appointments" ? M.appointments : M.detail} | MetaStorage`;
  }, [route.screen]);
  return (
    <CustomerLayout
      {...props}
      title={
        route.screen === "home"
          ? undefined
          : route.screen === "appointments"
            ? M.appointments
            : M.detail
      }
      onBack={back}
      onHome={home}
    >
      {route.screen === "home" ? (
        <HomeScreen
          owner={props.user.id}
          onAppointments={() => setRoute({ screen: "appointments" })}
          onAppointment={(id) => setRoute({ screen: "appointment", id, from: "home" })}
        />
      ) : route.screen === "appointments" ? (
        <AppointmentsScreen
          owner={props.user.id}
          onAppointment={(id) => setRoute({ screen: "appointment", id, from: "appointments" })}
        />
      ) : (
        <AppointmentDetailScreen owner={props.user.id} id={route.id} />
      )}
    </CustomerLayout>
  );
}
