export type UserRole =
  | "BISHOP"
  | "ADMIN"
  | "ZONE_LEADER"
  | "BRANCH_HEAD"
  | "BC_HEAD"
  | "MC_HEAD"
  | "CELL_LEADER"
  | "SHEPHERD"
  | "MEMBER";

export const WEB_ROLES: UserRole[] = ["BISHOP", "ADMIN", "ZONE_LEADER", "BRANCH_HEAD"];

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  unitId?: string;
  unitName?: string;
  profileImage?: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  BISHOP: "Bishop",
  ADMIN: "Administrator",
  ZONE_LEADER: "Zone Leader",
  BRANCH_HEAD: "Branch Pastor",
  BC_HEAD: "BC Head",
  MC_HEAD: "MC Head",
  CELL_LEADER: "Cell Leader",
  SHEPHERD: "Shepherd",
  MEMBER: "Member",
};

export const ROLE_COLORS: Record<string, string> = {
  BISHOP: "#7C3AED",
  ADMIN: "#1D4ED8",
  ZONE_LEADER: "#0369A1",
  BRANCH_HEAD: "#047857",
};
