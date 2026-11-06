import { WebView } from "react-native-webview";
import type { GatewayProps } from "../../../common/booking.types";
import { gatewaySource, isGatewayReturn } from "../../../common/booking.utils";
export function PaymentGateway({ url, fields, onReturn, onError }: GatewayProps) {
  return (
    <WebView
      source={gatewaySource(url, fields)}
      originWhitelist={["*"]}
      setSupportMultipleWindows={false}
      onError={onError}
      onHttpError={onError}
      onShouldStartLoadWithRequest={(request) => {
        if (isGatewayReturn(request.url, fields)) {
          onReturn();
          return false;
        }
        return request.url === "about:blank" || request.url.startsWith("https://");
      }}
    />
  );
}
