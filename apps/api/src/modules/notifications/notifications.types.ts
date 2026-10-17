import type { IncomingHttpHeaders } from "node:http";
import type { WebSocket } from "@fastify/websocket";

export interface NotificationConnection {
  socket: WebSocket;
  headers: IncomingHttpHeaders;
  expiresAt: number;
}
