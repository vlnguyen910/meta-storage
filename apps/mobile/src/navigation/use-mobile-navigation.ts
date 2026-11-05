import { useCallback, useEffect, useState } from "react";
import { BackHandler, Platform } from "react-native";
import type { MobileRoute } from "../features/demo/demo.types";
import { SCREEN_TITLES } from "./route.messages";

function browserRoute(home: MobileRoute["screen"]): MobileRoute {
  if (Platform.OS !== "web") return { screen: home };
  const [screen, id] = location.hash.slice(1).split("/");
  if (!screen || screen === "M-P00") return { screen: home };
  if (!Object.hasOwn(SCREEN_TITLES, screen)) return { screen: "M-E02" };
  try {
    return { screen: screen as MobileRoute["screen"], id: id ? decodeURIComponent(id) : undefined };
  } catch {
    return { screen: "M-E02" };
  }
}
export function useMobileNavigation(home: MobileRoute["screen"] = "M-A01") {
  const [route, setRoute] = useState<MobileRoute>(() => browserRoute(home));
  const [history, setHistory] = useState<MobileRoute[]>([]);
  const go = useCallback(
    (screen: MobileRoute["screen"], id?: string) => {
      if (screen === "M-P00") screen = home;
      setHistory((h) => [...h, route]);
      setRoute({ screen, id });
      if (Platform.OS === "web")
        window.history.pushState(null, "", `#${screen}${id ? `/${encodeURIComponent(id)}` : ""}`);
    },
    [route, home],
  );
  const back = useCallback(() => {
    if (Platform.OS === "web" && history.length) {
      window.history.back();
      setHistory((h) => h.slice(0, -1));
      return;
    }
    const previous = history.at(-1) ?? { screen: home };
    setHistory((h) => h.slice(0, -1));
    setRoute(previous);
  }, [history, home]);
  useEffect(() => {
    setRoute((current) =>
      current.screen === "M-A01" && home !== "M-A01" ? { screen: home } : current,
    );
  }, [home]);
  useEffect(() => {
    if (Platform.OS === "web") {
      const update = () => setRoute(browserRoute(home));
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
  }, [back, history.length, home]);
  return { route, go, back };
}
