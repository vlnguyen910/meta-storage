import type { UserRole, UserStatus } from "@metastorage/database/schema/user-enums";

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

export interface CustomerRegistrationMonth {
  month: string;
  count: number;
}

export interface CustomerRegistrationStats {
  year: number;
  years: number[];
  items: CustomerRegistrationMonth[];
  summary: {
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    unassignedFacilityUsers: number;
  };
}
