import { randomUUID } from "node:crypto";
import type { CreateUserInput, UpdateUserInput } from "@metastorage/contracts";
import { accounts, type Database, desc, eq, sql, type User, users } from "@metastorage/database";
import { ConflictError } from "../../common/errors/app-error";
import { USER_MESSAGES } from "./users.messages";

export class UsersRepository {
  constructor(private readonly db: Database) {}

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

  async list(limit: number, offset: number): Promise<User[]> {
    return this.db
      .select()
      .from(users)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(users.createdAt), desc(users.id));
  }

  async update(id: string, data: UpdateUserInput): Promise<User | undefined> {
    const [user] = await this.db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }
}
