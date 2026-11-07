import { useEffect, useRef, useState } from "react";
import { BackHandler, Platform } from "react-native";
import type { BookingFacility } from "../common/booking.types";
import { bookingError } from "../common/booking.utils";
import type {
  BookingOrigin,
  CustomerNavigatorProps,
  CustomerRoute,
  CustomerSupportOrigin,
} from "../common/customer-home.types";
import { PROFILE as PROFILE_MESSAGES } from "../common/profile.messages";
import { Notice } from "../components/ui";
import { BOOKING } from "../features/booking/booking.messages";
import { resumeBooking } from "../features/booking/booking.service";
import { CustomerLayout } from "../features/customer-home/components/customer-layout";
import { CUSTOMER_HOME as M } from "../features/customer-home/customer-home.messages";
import { useFacilitySearch } from "../features/customer-home/use-facility-search";
import { MY_STORAGE } from "../features/my-storage/my-storage.messages";
import { CustomerProfileScreen } from "../screens/account/customer-profile-screen";
import { AppointmentDetailScreen } from "../screens/appointments/appointment-detail-screen";
import { AppointmentsScreen } from "../screens/appointments/appointments-screen";
import { FacilitySearchScreen } from "../screens/facilities/facility-search-screen";
import { HomeScreen } from "../screens/home/home-screen";
import { CustomerSupportListScreen } from "../screens/support/customer-support-list-screen";
import { CustomerSupportRequestScreen } from "../screens/support/customer-support-request-screen";
import { CustomerSupportTicketScreen } from "../screens/support/customer-support-ticket-screen";
import { BookingNavigator } from "./booking-navigator";
import { MyStorageNavigator } from "./my-storage-navigator";

const titles = {
  storage: MY_STORAGE.title,
  booking: BOOKING.title,
  home: M.title,
  profile: M.account,
  search: M.discovery,
  appointments: M.appointments,
  appointment: M.detail,
  "support-new": M.supportNew,
  "support-list": PROFILE_MESSAGES.supportList,
  "support-ticket": M.supportTicket,
};

function supportOriginRoute(origin: CustomerSupportOrigin): CustomerRoute {
  if (origin === "profile") return { screen: "profile" };
  if (origin === "support-list") return { screen: "support-list" };
  if (origin === "storage-transactions") return { screen: "storage", view: "transactions" };
  return { screen: "storage", view: "current" };
}

export function CustomerNavigator(props: CustomerNavigatorProps) {
  const [route, setRoute] = useState<CustomerRoute>({ screen: "home" });
  const revision = useRef(0);
  const [bookingErrorText, setBookingErrorText] = useState("");
  const [notice, setNotice] = useState(false);
  const search = useFacilitySearch(route.screen === "search");
  const navigate = (next: CustomerRoute) => {
    revision.current++;
    setBookingErrorText("");
    setNotice(false);
    setRoute(next);
  };
  const home = () => navigate({ screen: "home" });
  const back = () =>
    navigate(
      route.screen === "booking"
        ? route.from
        : route.screen === "support-new" || route.screen === "support-ticket"
          ? supportOriginRoute(route.from)
          : route.screen === "support-list"
            ? { screen: "profile" }
            : { screen: route.screen === "appointment" ? route.from : "home" },
    );
  const storage = () => navigate({ screen: "storage", view: "current" });
  const unavailable = () => setNotice(true);
  const bookingOpening = useRef(false);
  async function book(facility: BookingFacility, unitTypeId?: string) {
    if (bookingOpening.current) return;
    bookingOpening.current = true;
    const initial = revision.current;
    try {
      const pending = await resumeBooking(props.user.id);
      if (revision.current !== initial) return;
      const from: BookingOrigin =
        route.screen === "storage"
          ? route
          : route.screen === "search"
            ? { screen: "search" }
            : { screen: "home" };
      navigate({
        screen: "booking",
        facility: pending?.facility ?? facility,
        unitTypeId: pending ? undefined : unitTypeId,
        from,
      });
    } catch (e) {
      setBookingErrorText(bookingError(e));
    } finally {
      bookingOpening.current = false;
    }
  }
  useEffect(() => {
    let alive = true;
    const initial = revision.current;
    void resumeBooking(props.user.id)
      .then((pending) => {
        if (alive && pending && revision.current === initial)
          setRoute({ screen: "booking", facility: pending.facility, from: { screen: "home" } });
      })
      .catch((e) => {
        if (alive && revision.current === initial) setBookingErrorText(bookingError(e));
      });
    return () => {
      alive = false;
    };
  }, [props.user.id]);
  useEffect(() => {
    if (Platform.OS !== "android" || route.screen === "booking") return;
    const listener = BackHandler.addEventListener("hardwareBackPress", () => {
      if (notice) {
        setNotice(false);
        return true;
      }
      if (route.screen === "home") return false;
      if (route.screen === "storage" && route.view !== "current") {
        setRoute({ screen: "storage", view: "current" });
        return true;
      }
      setRoute(
        route.screen === "support-new" || route.screen === "support-ticket"
          ? supportOriginRoute(route.from)
          : route.screen === "support-list"
            ? { screen: "profile" }
            : { screen: route.screen === "appointment" ? route.from : "home" },
      );
      return true;
    });
    return () => listener.remove();
  }, [route, notice]);
  useEffect(() => {
    if (Platform.OS === "web") document.title = `${titles[route.screen]} | MetaStorage`;
  }, [route.screen]);
  if (route.screen === "booking")
    return (
      <BookingNavigator
        key={route.facility.id}
        facility={route.facility}
        user={props.user}
        unitTypeId={route.unitTypeId}
        onClose={back}
        onHome={home}
        onChangeFacility={() => navigate({ screen: "search" })}
        onAppointment={(id) => navigate({ screen: "appointment", id, from: "home" })}
      />
    );
  return (
    <CustomerLayout
      {...props}
      title={
        route.screen === "home" || route.screen === "storage" || route.screen === "profile"
          ? undefined
          : titles[route.screen]
      }
      showTabs={
        route.screen === "home" ||
        route.screen === "search" ||
        route.screen === "storage" ||
        route.screen === "profile"
      }
      selectedTab={
        route.screen === "profile" ? "profile" : route.screen === "storage" ? "rentals" : "home"
      }
      onProfile={() => navigate({ screen: "profile" })}
      onStorage={storage}
      onBack={back}
      onHome={home}
      onUnavailable={unavailable}
      notice={notice}
      onDismissNotice={() => setNotice(false)}
    >
      {bookingErrorText ? <Notice error>{bookingErrorText}</Notice> : null}
      {route.screen === "profile" ? (
        <CustomerProfileScreen
          {...props}
          onUnavailable={unavailable}
          onCreateSupport={() => navigate({ screen: "support-new", from: "profile" })}
          onAllSupport={() => navigate({ screen: "support-list" })}
        />
      ) : route.screen === "home" ? (
        <HomeScreen
          owner={props.user.id}
          onStorage={storage}
          onBook={(facility) => void book(facility)}
          onAppointments={() => navigate({ screen: "appointments" })}
          onAppointment={(id) => navigate({ screen: "appointment", id, from: "home" })}
          onSearch={(value) => {
            search.start(value);
            navigate({ screen: "search" });
          }}
        />
      ) : route.screen === "storage" ? (
        <MyStorageNavigator
          owner={props.user.id}
          view={route.view}
          onView={(view) => navigate({ screen: "storage", view })}
          onBook={() => {
            search.start("");
            navigate({ screen: "search" });
          }}
          onRebook={(facility, id) => void book(facility, id)}
          onUnavailable={unavailable}
          onCreateSupport={(reservationId, paymentId) =>
            navigate({
              screen: "support-new",
              reservationId,
              paymentId,
              from: route.view === "transactions" ? "storage-transactions" : "storage-current",
            })
          }
        />
      ) : route.screen === "search" ? (
        <FacilitySearchScreen state={search} onBook={(facility) => void book(facility)} />
      ) : route.screen === "appointments" ? (
        <AppointmentsScreen
          owner={props.user.id}
          onAppointment={(id) => navigate({ screen: "appointment", id, from: "appointments" })}
          onUnavailable={unavailable}
        />
      ) : route.screen === "support-new" ? (
        <CustomerSupportRequestScreen
          owner={props.user.id}
          reservationId={route.reservationId}
          paymentId={route.paymentId}
          onCreated={(id) =>
            navigate({ screen: "support-ticket", id, created: true, from: route.from })
          }
        />
      ) : route.screen === "support-list" ? (
        <CustomerSupportListScreen
          owner={props.user.id}
          onCreate={() => navigate({ screen: "support-new", from: "support-list" })}
          onTicket={(id) =>
            navigate({ screen: "support-ticket", id, created: false, from: "support-list" })
          }
        />
      ) : route.screen === "support-ticket" ? (
        <CustomerSupportTicketScreen owner={props.user.id} id={route.id} created={route.created} />
      ) : (
        <AppointmentDetailScreen owner={props.user.id} id={route.id} />
      )}
    </CustomerLayout>
  );
}
