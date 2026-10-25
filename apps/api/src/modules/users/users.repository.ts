import { randomUUID } from "node:crypto";
import type {
  CreateUserInput,
  UpdateOwnProfileInput,
  UpdateUserInput,
  UserListQuery,
} from "@metastorage/contracts";
import {
  accounts,
  and,
  type Database,
  desc,
  eq,
  facilityAssignments,
  ilike,
  or,
  sessions,
  sql,
  type User,
  users,
} from "@metastorage/database";
import { ConflictError } from "../../common/errors/app-error";
import { hasOpenAssignedWork } from "../facilities/staff-work.repository";
import { USER_MESSAGES } from "./users.messages";
import type { UserTransaction } from "./users.types";

export class UsersRepository {
  constructor(private readonly db: Database) {}

  transaction<T>(work: (tx: UserTransaction) => Promise<T>): Promise<T> {
    return this.db.transaction(work);
  }

  async findByIdForUpdate(id: string, tx: UserTransaction): Promise<User | undefined> {
    const [user] = await tx.select().from(users).where(eq(users.id, id)).for("update");
    return user;
  }

  hasOpenWork(id: string, tx: UserTransaction): Promise<boolean> {
    return hasOpenAssignedWork(tx, id);
  }

  async deactivateAssignments(id: string, tx: UserTransaction): Promise<void> {
    await tx
      .update(facilityAssignments)
      .set({ isActive: false, endedAt: new Date() })
      .where(and(eq(facilityAssignments.userId, id), eq(facilityAssignments.isActive, true)));
  }

  async revokeSessions(id: string, tx: UserTransaction): Promise<void> {
    await tx.delete(sessions).where(eq(sessions.userId, id));
  }

  async create(data: Omit<CreateUserInput, "password">, passwordHash: string): Promise<User> {
    try {
      return await this.db.transaction(async (tx) => {
        const [user] = await tx
          .insert(users)
          .values({
            name: data.name,
            email: data.email,
            phone: data.phone,
            role: data.role,
            status: data.status,
            emailVerified: data.emailVerified,
          })
          .returning();
        if (!user) throw new Error(USER_MESSAGES.failedToCreateUser);
        await tx.insert(accounts).values({
          id: randomUUID(),
          userId: user.id,
          accountId: user.id,
          providerId: "credential",
          password: passwordHash,
        });
        return user;
      });
    } catch (error) {
      const cause = error instanceof Error && error.cause ? error.cause : error;
      if (
        cause &&
        typeof cause === "object" &&
        "code" in cause &&
        cause.code === "23505" &&
        "constraint_name" in cause
      ) {
        if (cause.constraint_name === "users_email_unique") {
          throw new ConflictError(USER_MESSAGES.emailAlreadyExists);
        }
        if (cause.constraint_name === "users_phone_unique") {
          throw new ConflictError(USER_MESSAGES.phoneAlreadyExists);
        }
      }
      throw error;
    }
  }

  async findByEmail(email: string): Promise<User | undefined> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(sql`lower(btrim(${users.email})) = ${email}`)
      .limit(1);
    return user;
  }

  async findById(id: string): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async list(query: UserListQuery): Promise<User[]> {
    const search = query.search ? `%${query.search.replace(/[\\%_]/g, "\\$&")}%` : undefined;
    return this.db
      .select()
      .from(users)
      .where(
        and(
          query.role ? eq(users.role, query.role) : undefined,
          query.status ? eq(users.status, query.status) : undefined,
          search
            ? or(ilike(users.name, search), ilike(users.email, search), ilike(users.phone, search))
            : undefined,
        ),
      )
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(desc(users.createdAt), desc(users.id));
  }

  async update(id: string, data: UpdateUserInput, tx: UserTransaction): Promise<User | undefined> {
    const [user] = await tx
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async updateProfile(id: string, data: UpdateOwnProfileInput): Promise<User | undefined> {
    try {
      const [user] = await this.db
        .update(users)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning();
      return user;
    } catch (error) {
      const cause = error instanceof Error && error.cause ? error.cause : error;
      if (
        cause &&
        typeof cause === "object" &&
        "code" in cause &&
        cause.code === "23505" &&
        "constraint_name" in cause &&
        cause.constraint_name === "users_phone_unique"
      ) {
        throw new ConflictError(USER_MESSAGES.phoneAlreadyExists);
      }
      throw error;
    }
  }
}
