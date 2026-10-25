import type { UserRole, UserStatus } from "./users";

export interface User {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  phone: string | null;
  role: UserRole | null;
  status: UserStatus | null;
  createdAt: string;
  updatedAt: string;
}
