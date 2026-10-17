import cors from "@fastify/cors";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { env } from "../../config/env";

const corsPluginAsync: FastifyPluginAsync = async (fastify) => {
  await fastify.register(cors, {
    origin: env.CORS_ORIGIN.split(",").map((origin) => origin.trim()),
    credentials: true,
  });
};

export const corsPlugin = fp(corsPluginAsync, {
  name: "cors-plugin",
});
