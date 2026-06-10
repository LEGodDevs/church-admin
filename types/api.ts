export interface Member {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  role: string;
  unitId?: string;
  unitName?: string;
  profileImage?: string;
  createdAt: string;
}

export interface Unit {
  id: string;
  name: string;
  type: "ZONE" | "BRANCH" | "BC" | "MC" | "CELL";
  parentId?: string;
  leaderId?: string;
  memberCount?: number;
}

export interface AttendanceSession {
  id: string;
  date: string;
  type: string;
  totalPresent: number;
  totalAbsent: number;
  unitId: string;
  unitName?: string;
}

export interface Report {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName?: string;
  unitId: string;
  unitName?: string;
  status: "PENDING" | "REVIEWED";
  createdAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName?: string;
  targetRoles: string[];
  createdAt: string;
}

export interface Giving {
  id: string;
  memberId: string;
  memberName?: string;
  amount: number;
  type: string;
  date: string;
  unitId: string;
}

export interface DashboardStats {
  totalMembers: number;
  presentThisWeek: number;
  absentThisWeek: number;
  attendanceRate: number;
  totalGivings: number;
  pendingReports: number;
  newMembersThisMonth: number;
  activeUnits: number;
}

export interface ChartPoint {
  label: string;
  value: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
