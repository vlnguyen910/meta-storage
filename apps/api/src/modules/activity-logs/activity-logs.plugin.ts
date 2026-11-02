import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { type ActivityLogsService, activityEntityId } from "./activity-logs.service";

const plugin: FastifyPluginAsync<{ service: ActivityLogsService }> = async (fastify, options) => {
  await options.service.initialize();
  const entityIds = new WeakMap<FastifyRequest, string>();

  fastify.addHook("preSerialization", async (request, _reply, payload) => {
    const data = (payload as { data?: { id?: unknown } } | null)?.data;
    const id = activityEntityId(data?.id);
    if (id) entityIds.set(request, id);
    return payload;
  });
  fastify.addHook("onResponse", async (request, reply) => {
    await options.service.recordRequest(request, reply, entityIds.get(request));
  });
};

export const activityLogsPlugin = fp(plugin, { name: "activity-logs-plugin" });
