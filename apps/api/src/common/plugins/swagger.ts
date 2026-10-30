import swagger, { type SwaggerTransform } from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { createJsonSchemaTransform } from "fastify-type-provider-zod";
import { env } from "../../config/env";
import { DEV_AUTH_ACCOUNTS, DEV_AUTH_PASSWORD } from "../../dev/auth-fixtures";
import { SWAGGER_MESSAGES } from "./swagger.messages";
import { swaggerQuickLoginCss, swaggerQuickLoginJs } from "./swagger-quick-login";

const openApiSchemaTransform = createJsonSchemaTransform({
  zodToJsonConfig: { target: "openapi-3.0" },
});

function moduleTag(url: string): string | undefined {
  if (url.startsWith("/api/auth/")) return "Authentication";
  if (url.startsWith("/api/inspections")) return "Inspections";
  if (url.startsWith("/api/reservations")) return "Reservations";
  if (url.startsWith("/api/appointments")) return "Appointments";
  if (url.startsWith("/api/payments/") || url === "/api/sepay/ipn") return "Payments";
  if (url.startsWith("/api/facilities/")) return "Facilities";
  if (url.startsWith("/api/rentals/")) return "Rentals";
  if (url.startsWith("/api/users/")) return "Users";
  if (url === "/api/health") return "System";
  return undefined;
}

const moduleSchemaTransform: SwaggerTransform = (input) => {
  const result = openApiSchemaTransform(input);
  const tag = moduleTag(input.url);
  if (tag) {
    result.schema ??= {};
    if (!result.schema.tags?.length) result.schema.tags = [tag];
  }
  return result;
};

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
      tags: [
        { name: "Authentication" },
        { name: "Facilities" },
        { name: "Reservations" },
        { name: "Appointments" },
        { name: "Check-ins" },
        { name: "Inspections" },
        { name: "Payments" },
        { name: "Rentals" },
        { name: "Users" },
        { name: "System" },
      ],
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
    transform: moduleSchemaTransform,
  });

  await fastify.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      deepLinking: true,
      docExpansion: "list",
      withCredentials: true,
    },
    theme: {
      js: [{ filename: "quick-login.js", content: swaggerQuickLoginJs }],
      css: [{ filename: "quick-login.css", content: swaggerQuickLoginCss }],
    },
    staticCSP: true,
  });
};

export const swaggerPlugin = fp(swaggerPluginCallback, {
  name: "swagger-plugin",
});
