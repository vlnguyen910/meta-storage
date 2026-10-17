import websocket from "@fastify/websocket";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { ForbiddenError } from "../../common/errors/app-error";
import { env } from "../../config/env";
import { requireRole } from "../auth/auth.guard";
import { NOTIFICATION_MESSAGES } from "./notifications.messages";
import { NotificationsService } from "./notifications.service";

const notificationsPluginAsync: FastifyPluginAsync = async (app) => {
  await app.register(websocket, { options: { maxPayload: 1024 } });
  const notifications = new NotificationsService(app.db);
  app.decorate("notifications", notifications);
  app.get(
    "/api/notifications/ws",
    {
      websocket: true,
      preValidation: [
        async (request) => {
          const origins = env.AUTH_TRUSTED_ORIGINS.split(",").map((origin) => origin.trim());
          if (!request.headers.origin || !origins.includes(request.headers.origin))
            throw new ForbiddenError(NOTIFICATION_MESSAGES.originDenied);
        },
        requireRole("FACILITY_STAFF"),
      ],
    },
    (socket, request) => {
      if (!request.user || !request.session) return socket.close(1008);
      notifications.connect(request.user.id, {
        socket,
        headers: request.headers,
        expiresAt: new Date(request.session.expiresAt).getTime(),
      });
    },
  );
  const timer = setInterval(() => notifications.expire(), 30_000);
  timer.unref();
  app.addHook("preClose", async () => {
    clearInterval(timer);
    notifications.close();
  });
};

export const notificationsPlugin = fp(notificationsPluginAsync, {
  name: "notifications-plugin",
  dependencies: ["database-plugin", "auth-plugin"],
});
