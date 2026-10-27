import {
  type CreateUserInput,
  CreateUserInputSchema,
  type CustomerRegistrationStats,
  type UpdateOwnProfileInput,
  UpdateOwnProfileInputSchema,
  type UpdateUserInput,
  UpdateUserInputSchema,
  type User,
  type UserListQuery,
  type UserRole,
} from "@metastorage/contracts";
import { ConflictError, ForbiddenError, NotFoundError } from "../../common/errors/app-error";
import type { AuthService } from "../auth/auth.service";
import { toUserDto } from "./users.dto";
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
    return toUserDto(user);
  }

  async getUserById(id: string): Promise<User> {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundError(USER_MESSAGES.userNotFound);
    }
    return toUserDto(user);
  }

  async listUsers(query: UserListQuery): Promise<User[]> {
    return (await this.usersRepository.list(query)).map(toUserDto);
  }

  async customerRegistrations(
    year = new Date().getUTCFullYear(),
  ): Promise<CustomerRegistrationStats> {
    const from = new Date(Date.UTC(year, 0, 1));
    const to = new Date(Date.UTC(year + 1, 0, 1));
    const [countsByMonth, availableYears, summary] = await Promise.all([
      this.usersRepository.customerRegistrations(from, to),
      this.usersRepository.customerRegistrationYears(),
      this.usersRepository.dashboardSummary(),
    ]);
    const counts = new Map(countsByMonth.map((item) => [item.month, item.count]));
    return {
      year,
      years: [...new Set([new Date().getUTCFullYear(), year, ...availableYears])].sort(
        (a, b) => b - a,
      ),
      summary,
      items: Array.from({ length: 12 }, (_, index) => {
        const month = `${year}-${String(index + 1).padStart(2, "0")}`;
        return { month, count: counts.get(month) ?? 0 };
      }),
    };
  }

  async updateOwnProfile(userId: string, input: UpdateOwnProfileInput): Promise<User> {
    const data = UpdateOwnProfileInputSchema.parse(input);
    const user = await this.usersRepository.updateProfile(userId, data);
    if (!user) throw new NotFoundError(USER_MESSAGES.userNotFound);
    return toUserDto(user);
  }

  async updateUserRole(id: string, role: UserRole): Promise<User> {
    return this.updateUser(id, { role });
  }

  async updateUser(id: string, input: UpdateUserInput): Promise<User> {
    const data = UpdateUserInputSchema.parse(input);
    return this.usersRepository.transaction(async (tx) => {
      const existing = await this.usersRepository.findByIdForUpdate(id, tx);
      if (!existing) throw new NotFoundError(USER_MESSAGES.userNotFound);
      if (data.role === "SYSTEM_ADMIN" && existing.role !== "SYSTEM_ADMIN") {
        throw new ForbiddenError(USER_MESSAGES.adminCreationForbidden);
      }
      const roleChanged = data.role !== undefined && data.role !== existing.role;
      const disabling = data.status === "INACTIVE";
      if (existing.role === "SYSTEM_ADMIN" && (disabling || roleChanged)) {
        throw new ForbiddenError(USER_MESSAGES.adminProtected);
      }
      if ((roleChanged || disabling) && (await this.usersRepository.hasOpenWork(id, tx))) {
        throw new ConflictError(USER_MESSAGES.openWorkPreventsChange);
      }
      const user = await this.usersRepository.update(id, data, tx);
      if (!user) throw new NotFoundError(USER_MESSAGES.userNotFound);
      if (roleChanged || disabling) {
        await this.usersRepository.deactivateAssignments(id, tx);
        await this.usersRepository.revokeSessions(id, tx);
      }
      return toUserDto(user);
    });
  }
}
