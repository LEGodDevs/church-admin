// ─────────────────────────────────────────────────────────────
// Core entities — mirror of the ChurchAPI (NestJS + Prisma) models
// ─────────────────────────────────────────────────────────────

export type UnitType = "CHURCH" | "ZONE" | "BRANCH" | "MC" | "BC" | "CELL" | "SHEPHERD" | "ADMIN";

export interface Member {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phoneNumber?: string;
  profilePic?: string;
  occupation?: string;
  maritalStatus?: string;
  dob?: string;
  createdAt?: string;
  leaderships?: { role: string; unitId: string; unit?: { name: string } }[];
  memberships?: { unitId: string; unit?: { name: string } }[];
}

export interface Unit {
  id: string;
  name: string;
  type: UnitType;
  parentId?: string;
  parent?: { id: string; name: string; type: UnitType };
  children?: Unit[];
  memberships?: { id: string }[];
  leaderships?: { role: string; user?: { firstName: string; lastName: string; profilePic?: string } }[];
}

// Flat member/leader row from /organizational-units/:id/members-leaders
export interface UnitPerson {
  id: string;
  name: string;
  email?: string;
  profilePic?: string | null;
  role?: string;
  unitId?: string;
  unitName?: string;
  unitType?: string;
}

export interface EventAttendee {
  status: string;
  user: { id: string; firstName: string; lastName: string; profilePic?: string };
}

export interface AttendanceEvent {
  id: string;
  title: string;
  description?: string;
  date: string;
  status: string;
  createdByUnitId?: string;
  createdByUnit?: { name: string; type: string };
  category?: { name: string };
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

export type AnnouncementType = "general" | "event" | "goal";

export interface Announcement {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  createdByUnitId?: string;
  createdByUnit?: { name: string; type: string };
  visibleToRoles?: string[];
  isGeneral?: boolean;
  imageUrl?: string;
  type?: AnnouncementType;
}

export type FinanceType = "Tithe" | "Partnership" | "Seed" | "Special" | "Offering";

export interface Finance {
  id: string;
  amount: number;
  date: string;
  type: FinanceType | string;
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

export interface GivingTarget {
  id: string;
  userId: string;
  givingType: string;
  year: number;
  directTarget: number;
  subGivings?: { id: string; title: string; description?: string; yearTarget: number }[];
}

export interface Goal {
  id: string;
  title: string;
  description?: string;
  category?: string;
  color?: string;
  progress?: number;
  completed?: boolean;
  dueDate?: string;
  assignerId?: string;
  assigneeId?: string;
  assigner?: { firstName: string; lastName: string };
  assignee?: { firstName: string; lastName: string };
}

export interface EvangelismRecord {
  id: string;
  period: string;
  date: string;
  soulsWon: number;
  peopleReached: number;
  submitterId: string;
  submitter?: { firstName: string; lastName: string };
  unitId: string;
  unit?: { name: string };
}

export interface FirstTimer {
  id: string;
  name: string;
  email?: string;
  phoneNumber?: string;
  date: string;
  recordedById: string;
  recordedBy?: { firstName: string; lastName: string };
  unitId: string;
  unit?: { name: string };
}

export interface FollowUp {
  id: string;
  date: string;
  note: string;
  status: "pending" | "completed" | "cancelled" | string;
  type: string;
  targetId: string;
  targetName?: string;
  recordedBy?: { firstName: string; lastName: string };
  unit?: { name: string };
}

// Learning content
export interface TrainingCategory {
  id: string;
  title: string;
  order?: number;
  videos: TrainingVideo[];
}
export interface TrainingVideo {
  id: string;
  title: string;
  author: string;
  thumbnail: string;
  duration?: string;
  views?: string;
  videoUrl?: string;
}
export interface PodcastSeries {
  id: string;
  title: string;
  episodes: PodcastEpisode[];
}
export interface PodcastEpisode {
  id: string;
  title: string;
  author: string;
  thumbnail: string;
  duration?: string;
  audioUrl?: string;
}
export interface FMWPOVideo {
  id: string;
  title: string;
  date: string;
  thumbnail: string;
  duration?: string;
  videoUrl?: string;
}

// Church config
export interface Theme {
  primaryColor?: string;
  name?: string;
  [key: string]: unknown;
}
export interface MissionVision {
  mission?: string;
  vision?: string;
}

// Hierarchy / organogram tree node
export interface OrgNode {
  id: string;
  name: string;
  type: UnitType;
  leaderships?: { role: string; user?: { firstName: string; lastName: string; profilePic?: string } }[];
  children?: OrgNode[];
}

// ─────────────────────────────────────────────────────────────
// Dashboard analytics shapes
// ─────────────────────────────────────────────────────────────

export interface AdminDashboard {
  totalMembers: number;
  totalZones: number;
  totalBranches: number;
  monthlyGiving: number;
  attendanceRate: number;
  newMembersThisMonth: number;
  firstTimersThisMonth: number;
  recentReports?: {
    id: string;
    title: string;
    status: string;
    submittedAt?: string;
    unit?: { name: string };
  }[];
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
