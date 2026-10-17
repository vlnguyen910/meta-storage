import type { FastifyServerOptions } from "fastify";
import { env } from "../../config/env";

export const loggerConfig: FastifyServerOptions["logger"] = {
  level: env.LOG_LEVEL,

  ...(env.NODE_ENV === "development" && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:HH:MM:ss",
        ignore: "pid,hostname",
      },
    },
  }),

  serializers: {
    req(req) {
      return {
        method: req.method,
        url: req.url,
        remoteAddress: req.ip,
      };
    },

    res(res) {
      return {
        statusCode: res.statusCode,
      };
    },
  },
};
