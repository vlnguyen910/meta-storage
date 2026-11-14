import type { IncomingHttpHeaders } from "node:http";
import type { WebSocket } from "@fastify/websocket";

export interface NotificationConnection {
  role: "FACILITY_MANAGER" | "FACILITY_STAFF" | "CUSTOMER";
  socket: WebSocket;
  headers: IncomingHttpHeaders;
  expiresAt: number;
}
