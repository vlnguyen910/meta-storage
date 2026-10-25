import type { FastifyReply, FastifyRequest } from "fastify";

export async function privateTrackingResponse(_request: FastifyRequest, reply: FastifyReply) {
  reply.header("Cache-Control", "no-store").header("Referrer-Policy", "no-referrer");
}
