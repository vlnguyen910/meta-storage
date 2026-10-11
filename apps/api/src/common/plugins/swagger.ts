import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { createJsonSchemaTransform } from "fastify-type-provider-zod";
import { env } from "../../config/env";
import { DEV_AUTH_ACCOUNTS, DEV_AUTH_PASSWORD } from "../../dev/auth-fixtures";
import { SWAGGER_MESSAGES } from "./swagger.messages";

const openApiSchemaTransform = createJsonSchemaTransform({
  zodToJsonConfig: { target: "openapi-3.0" },
});

const swaggerPluginCallback: FastifyPluginAsync = async (fastify) => {
  if (env.NODE_ENV === "production") {
    return;
  }

  await fastify.register(swagger, {
    openapi: {
      openapi: "3.0.3",
      info: {
        title: "metastorage API",
        description: SWAGGER_MESSAGES.description,
        version: "0.0.1",
      },
      paths: {
        "/api/auth/sign-in/email": {
          post: {
            tags: ["Authentication"],
            summary: SWAGGER_MESSAGES.signInSummary,
            description: SWAGGER_MESSAGES.signInDescription,
            security: [],
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  examples: Object.fromEntries(
                    DEV_AUTH_ACCOUNTS.map(({ role, email }) => [
                      role,
                      {
                        summary: role,
                        value: { email, password: DEV_AUTH_PASSWORD, rememberMe: true },
                      },
                    ]),
                  ),
                  schema: {
                    type: "object",
                    required: ["email", "password"],
                    properties: {
                      email: { type: "string", format: "email" },
                      password: { type: "string", minLength: 8, format: "password" },
                      rememberMe: { type: "boolean", default: true },
                    },
                  },
                },
              },
            },
            responses: {
              "200": { description: SWAGGER_MESSAGES.sessionCreated },
              "401": { description: SWAGGER_MESSAGES.invalidCredentials },
              "403": { description: SWAGGER_MESSAGES.verificationRequired },
            },
          },
        },
        "/api/auth/sign-out": {
          post: {
            tags: ["Authentication"],
            summary: SWAGGER_MESSAGES.signOutSummary,
            security: [{ sessionAuth: [] }],
            responses: { "200": { description: SWAGGER_MESSAGES.sessionCleared } },
          },
        },
      },
      servers: [
        {
          url: "/",
          description: SWAGGER_MESSAGES.localServer,
        },
      ],
      components: {
        securitySchemes: {
          bookingTrackingSession: {
            type: "apiKey",
            in: "cookie",
            name: "metastorage_booking_session",
          },
          sessionAuth: {
            type: "apiKey",
            in: "cookie",
            name: "metastorage-auth.session_token",
          },
        },
      },
    },
    transform: openApiSchemaTransform,
  });

  await fastify.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      deepLinking: true,
      docExpansion: "list",
      withCredentials: true,
    },
    staticCSP: true,
  });
};

export const swaggerPlugin = fp(swaggerPluginCallback, {
  name: "swagger-plugin",
});
