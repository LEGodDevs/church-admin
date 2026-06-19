export interface Member {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  profilePic?: string;
  createdAt: string;
}

export type UnitType = "CHURCH" | "ZONE" | "BRANCH" | "MC" | "BC" | "CELL" | "SHEPHERD";

export interface Unit {
  id: string;
  name: string;
  type: UnitType;
  parentId?: string;
  parent?: { id: string; name: string; type: UnitType };
  children?: Unit[];
  memberships?: { id: string }[];
  leaderships?: { role: string; user?: { firstName: string; lastName: string } }[];
}

export interface EventAttendee {
  status: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    profilePic?: string;
  };
}

export interface AttendanceEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  status: string;
  createdByUnitId: string;
  createdByUnit?: { name: string; type: string };
  _count?: { attendees: number };
  attendees?: EventAttendee[];
}

export interface Report {
  id: string;
  title: string;
  content: string;
  authorId: string;
  author?: { id: string; firstName: string; lastName: string };
  unitId: string;
  unit?: { id: string; name: string; type: string };
  status: "submitted" | "reviewed";
  dueDate?: string;
  submittedAt?: string;
  reviewedAt?: string;
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

export type FinanceType = "Tithe" | "Partnership" | "Seed" | "Special" | "Offering";

export interface Finance {
  id: string;
  amount: number;
  date: string;
  type: FinanceType;
  userId: string;
  user?: { id: string; firstName: string; lastName: string; profilePic?: string };
  unitId: string;
  unit?: { id: string; name: string; type: string };
}

export interface FinanceSummary {
  unitId: string;
  summary: { total: number; byType: Record<string, number> };
  recentRecords: Finance[];
}

export interface AdminDashboard {
  totalMembers: number;
  totalZones: number;
  totalBranches: number;
  monthlyGiving: number;
  attendanceRate: number;
  newMembersThisMonth: number;
  firstTimersThisMonth: number;
}

export interface GeneralDashboard {
  totalMembers: number;
  totalFinances: number;
  totalSoulsWon: number;
  totalPeopleReached: number;
  upcomingEvents: number;
  childUnitCount: number;
  totalCellGroups: number;
  totalSubUnits: number;
  unitType: string;
}
