import type { LoginDevice } from "./login-device.types";

export function describeLoginDevice(headers: Headers): LoginDevice {
  const agent = (headers.get("user-agent") ?? "").slice(0, 1024);
  const platform = headers.get("x-device-platform");
  const operatingSystem =
    /Android/i.test(agent) || platform === "android"
      ? "Android"
      : /iPhone|iPad|iPod/i.test(agent) || platform === "ios"
        ? "iOS"
        : /Windows/i.test(agent)
          ? "Windows"
          : /Macintosh|Mac OS X/i.test(agent)
            ? "macOS"
            : /Linux/i.test(agent)
              ? "Linux"
              : null;
  const browser = /Edg\//.test(agent)
    ? "Edge"
    : /SamsungBrowser\//.test(agent)
      ? "Samsung Internet"
      : /Firefox\/|FxiOS\//.test(agent)
        ? "Firefox"
        : /Chrome\/|CriOS\//.test(agent)
          ? "Chrome"
          : /Safari\//.test(agent)
            ? "Safari"
            : null;
  const device = /iPad/i.test(agent)
    ? "iPad"
    : /iPhone/i.test(agent)
      ? "iPhone"
      : operatingSystem === "Android"
        ? /Mobile/i.test(agent)
          ? "Android phone"
          : "Android device"
        : operatingSystem === "iOS"
          ? "iOS device"
          : operatingSystem
            ? "Computer"
            : null;
  // Reduced browser user agents expose "K", not the actual Android hardware model.
  const androidModel = agent
    .match(/Android [^;()]+;\s*(?:[a-z]{2}[-_][a-z]{2};\s*)?([^;)]+?)(?:\s+Build\/[^;)]*)?\)/i)?.[1]
    ?.trim();
  const model =
    (
      headers.get("x-device-model")?.trim() ||
      (androidModel && androidModel !== "K" ? androidModel : null)
    )?.slice(0, 120) ?? null;
  return { device, operatingSystem, browser, model };
}
