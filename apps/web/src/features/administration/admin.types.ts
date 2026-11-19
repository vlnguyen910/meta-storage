import type { CreateUserInput, User } from "@metastorage/contracts";
import type { UserRole } from "@metastorage/database/schema/user-enums";
import type { ReactNode } from "react";

type AdminAccountStatus = "ACTIVE" | "INACTIVE";
interface AdminDrawerProps {
  readonly title: string;
  readonly children: ReactNode;
  readonly onClose: () => void;
}

export type AdminDialogProps = AdminDrawerProps;

export interface AdminUserDetailProps {
  readonly userId: string;
  readonly onClose: () => void;
  readonly onEdit: (user: User) => void;
}

export type AdminManagedUser = User & { role: UserRole; status: AdminAccountStatus };

export interface AdminUserCreatorProps {
  readonly onClose: () => void;
  readonly onSave: (input: CreateUserInput) => Promise<void>;
}

export interface AdminUserEditorProps {
  readonly user: AdminManagedUser;
  readonly onClose: () => void;
  readonly onSave: (role: UserRole) => Promise<void>;
}

export interface AdminUserStatusConfirmationProps {
  readonly user: AdminManagedUser | null;
  readonly pending: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

export type AdminUserEditValues = Pick<AdminManagedUser, "role">;

export interface AdminUserFilters {
  readonly search: string;
  readonly role: string;
  readonly status: string;
}

export interface AdminShellProps {
  readonly children: ReactNode;
}
