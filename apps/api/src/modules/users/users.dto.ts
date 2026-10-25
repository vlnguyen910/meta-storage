import type { User } from "@metastorage/contracts";
import type { User as StoredUser } from "@metastorage/database";

export function toUserDto(user: StoredUser): User {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    image: user.image,
    phone: user.phone,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
