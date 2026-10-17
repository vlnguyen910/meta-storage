import { useCallback, useEffect, useState } from "react";
import { BackHandler, Platform } from "react-native";
import type { MobileRoute } from "../features/demo/demo.types";
import { SCREEN_TITLES } from "./route.messages";

function browserRoute(): MobileRoute {
  if (Platform.OS !== "web") return { screen: "M-P00" };
  const [screen, id] = location.hash.slice(1).split("/");
  if (!screen) return { screen: "M-P00" };
  if (!Object.hasOwn(SCREEN_TITLES, screen)) return { screen: "M-E02" };
  try {
    return { screen: screen as MobileRoute["screen"], id: id ? decodeURIComponent(id) : undefined };
  } catch {
    return { screen: "M-E02" };
  }
}
export function useMobileNavigation() {
  const [route, setRoute] = useState<MobileRoute>(browserRoute);
  const [history, setHistory] = useState<MobileRoute[]>([]);
  const go = useCallback(
    (screen: MobileRoute["screen"], id?: string) => {
      setHistory((h) => [...h, route]);
      setRoute({ screen, id });
      if (Platform.OS === "web")
        window.history.pushState(null, "", `#${screen}${id ? `/${encodeURIComponent(id)}` : ""}`);
    },
    [route],
  );
  const back = useCallback(() => {
    if (Platform.OS === "web" && history.length) {
      window.history.back();
      setHistory((h) => h.slice(0, -1));
      return;
    }
    const previous = history.at(-1) ?? { screen: "M-P00" as const };
    setHistory((h) => h.slice(0, -1));
    setRoute(previous);
  }, [history]);
  useEffect(() => {
    if (Platform.OS === "web") {
      const update = () => setRoute(browserRoute());
      window.addEventListener("popstate", update);
      window.addEventListener("hashchange", update);
      return () => {
        window.removeEventListener("popstate", update);
        window.removeEventListener("hashchange", update);
      };
    }
    const listener = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!history.length) return false;
      back();
      return true;
    });
    return () => listener.remove();
  }, [back, history.length]);
  return { route, go, back };
}
