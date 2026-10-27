import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { activityForResponse } from "./user-activity";
import type { UserActivityInput } from "./user-activity.types";
import { UserHistoryRepository } from "./user-history.repository";

const plugin: FastifyPluginAsync = async (fastify) => {
  const repository = new UserHistoryRepository(fastify.db);
  const pending = new WeakMap<FastifyRequest, UserActivityInput | null>();
  const activity = (request: FastifyRequest, payload?: unknown) =>
    activityForResponse(
      {
        method: request.method,
        route: request.routeOptions.url ?? "",
        actorId: request.user?.id ?? null,
        params: request.params,
        body: request.body,
      },
      payload,
    );

  fastify.addHook("preSerialization", async (request, reply, payload) => {
    if (reply.statusCode >= 200 && reply.statusCode < 300) {
      const event = activity(request, payload);
      pending.set(request, event);
    }
    return payload;
  });
  fastify.addHook("onResponse", async (request, reply) => {
    if (reply.statusCode < 200 || reply.statusCode >= 300) return;
    const event = pending.has(request) ? pending.get(request) : activity(request);
    if (!event) return;
    try {
      // shortcut: accepted write requests include idempotent repeats; use domain events if exact change auditing is needed.
      // The response is already sent; an optional log cannot roll back or fail the user action.
      await repository.recordActivity(event);
    } catch {
      fastify.log.warn(
        { requestId: request.id, action: event.action },
        "User activity log could not be stored",
      );
    }
  });
};

export const userActivityPlugin = fp(plugin, { name: "user-activity-plugin" });
