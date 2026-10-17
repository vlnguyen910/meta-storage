import {
  CreateUserInputSchema,
  UpdateUserRoleInputSchema,
  UpdateUserStatusInputSchema,
  UserIdParamsSchema,
  UserListQuerySchema,
} from "@metastorage/contracts";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { successResponse } from "../../common/response/api-response";
import { requireAuth, requireRole } from "../auth/auth.guard";
import { AuthRepository } from "../auth/auth.repository";
import { AuthService } from "../auth/auth.service";
import { USER_MESSAGES } from "./users.messages";
import { UsersRepository } from "./users.repository";
import { UsersService } from "./users.service";

export const usersRoutes: FastifyPluginAsync = async (fastify) => {
  const repository = new UsersRepository(fastify.db);
  const service = new UsersService(repository, new AuthService(new AuthRepository(fastify.db)));

  const typedApp = fastify.withTypeProvider<ZodTypeProvider>();

  typedApp.post(
    "/",
    {
      schema: {
        body: CreateUserInputSchema,
      },
      preHandler: [requireRole("SYSTEM_ADMIN")],
    },
    async (request, reply) => {
      const user = await service.createUser(request.body);
      return reply.status(201).send(successResponse(user, USER_MESSAGES.userCreated));
    },
  );

  typedApp.patch(
    "/:id/status",
    {
      schema: {
        params: UserIdParamsSchema,
        body: UpdateUserStatusInputSchema,
      },
      preHandler: [requireRole("SYSTEM_ADMIN")],
    },
    async (request, reply) => {
      const user = await service.updateUser(request.params.id, request.body);
      return reply.status(200).send(successResponse(user, USER_MESSAGES.statusUpdated));
    },
  );

  // GET /api/users
  typedApp.get(
    "/",
    {
      schema: {
        querystring: UserListQuerySchema,
      },
      preHandler: [requireRole("SYSTEM_ADMIN")],
    },
    async (request, reply) => {
      const { limit, offset } = request.query;
      const users = await service.listUsers(limit, offset);
      return reply.status(200).send(successResponse(users));
    },
  );

  // PATCH /api/users/:id/role
  typedApp.patch(
    "/:id/role",
    {
      schema: {
        params: UserIdParamsSchema,
        body: UpdateUserRoleInputSchema,
      },
      preHandler: [requireRole("SYSTEM_ADMIN")],
    },
    async (request, reply) => {
      const user = await service.updateUserRole(request.params.id, request.body.role);
      return reply.status(200).send(successResponse(user, USER_MESSAGES.roleUpdated));
    },
  );

  // GET /api/users/:id
  typedApp.get(
    "/:id",
    {
      schema: {
        params: UserIdParamsSchema,
      },
      preHandler: [requireRole("SYSTEM_ADMIN")],
    },
    async (request, reply) => {
      const { id } = request.params;
      const user = await service.getUserById(id);
      return reply.status(200).send(successResponse(user));
    },
  );

  // GET /api/users/me
  typedApp.get(
    "/me",
    {
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      // biome-ignore lint/style/noNonNullAssertion: <it will never null if have session!>
      const currentUser = request.user!;
      const userProfile = await service.getUserById(currentUser.id);

      return reply.status(200).send(successResponse(userProfile));
    },
  );
};
