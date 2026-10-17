import {
  type CreateUserInput,
  CreateUserInputSchema,
  type UpdateUserInput,
  UpdateUserInputSchema,
  type UserRole,
} from "@metastorage/contracts";
import type { User } from "@metastorage/database";
import { ConflictError, ForbiddenError, NotFoundError } from "../../common/errors/app-error";
import type { AuthService } from "../auth/auth.service";
import { USER_MESSAGES } from "./users.messages";
import type { UsersRepository } from "./users.repository";

export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly authService: AuthService,
  ) {}

  async createUser(input: CreateUserInput): Promise<User> {
    const data = CreateUserInputSchema.parse(input);
    if (await this.usersRepository.findByEmail(data.email)) {
      throw new ConflictError(USER_MESSAGES.emailAlreadyExists);
    }
    const passwordHash = await this.authService.hashPassword(data.password);
    const user = await this.usersRepository.create(
      {
        name: data.name,
        email: data.email,
        phone: data.phone ?? null,
        role: data.role,
        status: data.status,
        emailVerified: data.emailVerified,
      },
      passwordHash,
    );
    return user;
  }

  async getUserById(id: string): Promise<User> {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundError(USER_MESSAGES.userNotFound);
    }
    return user;
  }

  async listUsers(limit: number, offset: number): Promise<User[]> {
    return await this.usersRepository.list(limit, offset);
  }

  async updateUserRole(id: string, role: UserRole): Promise<User> {
    return this.updateUser(id, { role });
  }

  async updateUser(id: string, input: UpdateUserInput): Promise<User> {
    const data = UpdateUserInputSchema.parse(input);
    const existing = await this.usersRepository.findById(id);
    if (!existing) throw new NotFoundError(USER_MESSAGES.userNotFound);
    if (data.role === "SYSTEM_ADMIN" && existing.role !== "SYSTEM_ADMIN") {
      throw new ForbiddenError(USER_MESSAGES.adminCreationForbidden);
    }
    if (
      existing.role === "SYSTEM_ADMIN" &&
      (data.status === "INACTIVE" || (data.role !== undefined && data.role !== "SYSTEM_ADMIN"))
    ) {
      throw new ForbiddenError(USER_MESSAGES.adminProtected);
    }
    const user = await this.usersRepository.update(id, data);
    if (!user) {
      throw new NotFoundError(USER_MESSAGES.userNotFound);
    }
    return user;
  }
}
