import { useEffect, useRef } from "react";
import type { GatewayProps } from "../../../common/booking.types";
import { gatewaySource } from "../../../common/booking.utils";
import { BOOKING as M } from "../booking.messages";
export function PaymentGateway({ url, fields, onCheck, onError }: GatewayProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const source = gatewaySource(url, fields);
    const doc = frame.current?.contentDocument;
    if (!doc) return;
    doc.body.replaceChildren();
    const form = doc.createElement("form");
    form.method = "POST";
    form.action = source.uri;
    for (const [key, value] of Object.entries(fields)) {
      const input = doc.createElement("input");
      input.type = "hidden";
      input.name = key;
      input.value = String(value);
      form.appendChild(input);
    }
    doc.body.appendChild(form);
    form.submit();
  }, [url, fields]);
  return (
    <iframe
      ref={frame}
      title={M.gatewayTitle}
      onLoad={onCheck}
      onError={onError}
      className="h-full w-full flex-1 border-0"
    />
  );
}
