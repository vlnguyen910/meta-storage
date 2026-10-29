import type { User } from "@metastorage/contracts";
import type { UserRole } from "@metastorage/database/schema/user-enums";
import type { ReactNode } from "react";

export type AdminSection = "users" | "assignments" | "login-history" | "activity-logs";
export type AdminAccountStatus = "ACTIVE" | "INACTIVE";
export type AdminOutcome = "SUCCESS" | "FAILED";
export type AdminAction = "ROLE_CHANGED" | "STATUS_CHANGED" | "FACILITIES_CHANGED";

export interface AdminUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: UserRole;
  readonly status: AdminAccountStatus;
  readonly facilityIds: readonly string[];
  readonly lastLoginAt: string | null;
}

export interface AdminFacility {
  readonly id: string;
  readonly name: string;
  readonly address: string;
}

export interface AdminLogin {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly email: string;
  readonly role: UserRole;
  readonly at: string;
  readonly ipMasked: string;
  readonly device: string;
  readonly outcome: AdminOutcome;
}

export interface AdminSnapshot {
  readonly role: UserRole;
  readonly status: AdminAccountStatus;
  readonly facilityIds: readonly string[];
}

export interface AdminAudit {
  readonly id: string;
  readonly actor: string;
  readonly actorRole: UserRole;
  readonly target: string;
  readonly targetId: string;
  readonly action: AdminAction;
  readonly at: string;
  readonly outcome: AdminOutcome;
  readonly facilityIds: readonly string[];
  readonly reason: string;
  readonly before: AdminSnapshot;
  readonly after: AdminSnapshot;
}

export interface AdminMockData {
  readonly users: readonly AdminUser[];
  readonly facilities: readonly AdminFacility[];
  readonly logins: readonly AdminLogin[];
  readonly audits: readonly AdminAudit[];
}

export interface AdminFilters {
  readonly search: string;
  readonly role: string;
  readonly status: string;
  readonly facilityId: string;
  readonly outcome: string;
  readonly action: string;
  readonly date: string;
}

export interface AdminUserDraft {
  role: UserRole;
  status: AdminAccountStatus;
  reason: string;
}

export interface AdminAssignmentDraft {
  facilityIds: string[];
  reason: string;
}

export interface AdminWorkspaceProps {
  readonly section: AdminSection;
}

export interface AdminTableProps {
  readonly title: string;
  readonly headings: readonly string[];
  readonly children: ReactNode;
}

export interface AdminDrawerProps {
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

export interface AdminBadgeProps {
  readonly label: string;
  readonly warning?: boolean;
}

export interface AdminSnapshotProps {
  readonly title: string;
  readonly snapshot: AdminSnapshot;
  readonly facilities: readonly AdminFacility[];
}

export interface AdminAccountChange {
  readonly userId: string;
  readonly action: AdminAction;
  readonly patch: Partial<AdminSnapshot>;
  readonly reason: string;
  readonly actor: string;
}

export interface AdminEditorProps {
  readonly user: AdminUser;
  readonly data: AdminMockData;
  readonly assignment: boolean;
  readonly modal?: boolean;
  readonly pending: boolean;
  readonly onSave: (changes: readonly AdminAccountChange[]) => Promise<void>;
  readonly onClose: () => void;
  readonly actor: string;
}

export interface AdminShellProps {
  readonly children: ReactNode;
}
