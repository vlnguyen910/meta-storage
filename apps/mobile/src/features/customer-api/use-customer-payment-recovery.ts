import { createMobilePaymentReturn, parseMobilePaymentReturn } from "@metastorage/shared";
import { focusManager, useQueryClient } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { useEffect } from "react";
import { AppState } from "react-native";
import type { CustomerRoute } from "../../common/customer-api.types";
import { readCustomerCommand, saveCustomerCommand } from "./customer-native";

type PaymentRoute = Extract<CustomerRoute, { screen: "payment" }>;

export function useCustomerPaymentRecovery(owner: string, restore: (route: PaymentRoute) => void) {
  const client = useQueryClient();
  useEffect(() => {
    let active = true;
    let revision = 0;
    let previousState = AppState.currentState;
    const recoverSaved = async () => {
      const request = ++revision;
      try {
        const saved = await readCustomerCommand<PaymentRoute>(owner, "payment");
        if (
          !active ||
          request !== revision ||
          saved?.screen !== "payment" ||
          !createMobilePaymentReturn(saved.id, saved.reservationId)
        )
          return;
        restore({ screen: "payment", id: saved.id, reservationId: saved.reservationId });
      } catch {
        // Storage recovery is best effort; the existing payment screen still queries the API.
      }
    };
    const handleUrl = (url: string | null) => {
      const parsed = parseMobilePaymentReturn(url);
      if (!active || !parsed) return false;
      revision++;
      const route: PaymentRoute = {
        screen: "payment",
        id: parsed.paymentId,
        reservationId: parsed.reservationId,
      };
      restore(route);
      void saveCustomerCommand(owner, "payment", route).catch(() => {});
      return true;
    };
    const initialRevision = revision;
    void Linking.getInitialURL()
      .then(async (url) => {
        if (active && revision === initialRevision && !handleUrl(url)) await recoverSaved();
      })
      .catch(async () => {
        if (active && revision === initialRevision) await recoverSaved();
      });
    const links = Linking.addEventListener("url", (event) => handleUrl(event.url));
    const appState = AppState.addEventListener("change", (state) => {
      focusManager.setFocused(state === "active");
      if (state === "active" && previousState !== "active") {
        void recoverSaved();
        void client.invalidateQueries();
      }
      previousState = state;
    });
    return () => {
      active = false;
      revision++;
      links.remove();
      appState.remove();
    };
  }, [owner, restore, client]);
}
