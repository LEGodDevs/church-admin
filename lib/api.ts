import type {
  Member, Unit, UnitPerson, AttendanceEvent, Report, Announcement,
  FinanceSummary, AdminDashboard, GeneralDashboard, OrgNode,
  EvangelismRecord, FirstTimer, FollowUp, Goal, TrainingCategory,
  PodcastSeries, FMWPOVideo, Theme, MissionVision,
} from "@/types/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("auth_token");
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 401) {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    document.cookie = "auth_token=; path=/; max-age=0";
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `HTTP ${res.status}`);
  }
  // some endpoints (e.g. review) return empty bodies
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const apiPost = <T>(path: string, body?: unknown): Promise<T> =>
  apiFetch<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });
export const apiPut = <T>(path: string, body?: unknown): Promise<T> =>
  apiFetch<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined });
export const apiPatch = <T>(path: string, body?: unknown): Promise<T> =>
  apiFetch<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined });
export const apiDelete = (path: string): Promise<void> =>
  apiFetch<void>(path, { method: "DELETE" });

// ─────────────────────────────────────────────────────────────
// Resource helpers (typed, grouped by domain)
// ─────────────────────────────────────────────────────────────

export const api = {
  // Analytics
  adminDashboard: () => apiFetch<AdminDashboard>("/analytics/admin/dashboard"),
  unitDashboard: (unitId: string) => apiFetch<GeneralDashboard>(`/analytics/${unitId}/dashboard`),

  // Users / members
  users: () => apiFetch<Member[]>("/users"),
  user: (id: string) => apiFetch<Member>(`/users/${id}`),

  // Units
  units: () => apiFetch<Unit[]>("/organizational-units"),
  unit: (id: string) => apiFetch<Unit>(`/organizational-units/${id}`),
  unitMembersLeaders: (id: string) =>
    apiFetch<{ leaders: UnitPerson[]; members: UnitPerson[] }>(`/organizational-units/${id}/members-leaders`),
  unitChildren: (id: string) => apiFetch<Unit[]>(`/organizational-units/${id}/children`),

  // Organogram — /hierarchy/tree returns the populated nested tree
  fullTree: () => apiFetch<OrgNode>("/hierarchy/tree"),
  tree: () => apiFetch<OrgNode>("/hierarchy/tree"),

  // Attendance
  unitSessions: (unitId: string, includeDescendants = true) =>
    apiFetch<AttendanceEvent[]>(`/attendance/unit/${unitId}/sessions?includeDescendants=${includeDescendants}`),

  // Finances
  unitFinance: (unitId: string, includeDescendants = true) =>
    apiFetch<FinanceSummary>(`/finances/unit/${unitId}/summary?includeDescendants=${includeDescendants}`),

  // Reports
  incomingReports: (unitId: string, includeDescendants = true) =>
    apiFetch<Report[]>(`/reports/incoming/${unitId}?includeDescendants=${includeDescendants}`),
  reviewReport: (id: string) => apiPatch<void>(`/reports/${id}/review`),

  // Announcements
  announcements: () => apiFetch<Announcement[]>("/announcements"),
  createAnnouncement: (body: {
    title: string; content: string; type?: string; imageUrl?: string; isGeneral?: boolean; visibleToRoles?: string[];
  }) => apiPost<Announcement>("/announcements", body),
  deleteAnnouncement: (id: string) => apiDelete(`/announcements/${id}`),

  // Evangelism
  evangelism: (unitId: string) =>
    apiFetch<EvangelismRecord[]>(`/evangelism/unit/${unitId}?includeDescendants=true`),
  firstTimers: (unitId: string) =>
    apiFetch<FirstTimer[]>(`/evangelism/first-timers/unit/${unitId}?includeDescendants=true`),
  followUps: (unitId: string) =>
    apiFetch<FollowUp[]>(`/follow-ups/unit/${unitId}`),

  // Goals
  goalsAssignedByMe: () => apiFetch<Goal[]>("/goals/assigned-by/me"),
  goalsAssignedToMe: () => apiFetch<Goal[]>("/goals/assigned-to/me"),

  // Learning
  learningCategories: () => apiFetch<TrainingCategory[]>("/learning/categories"),
  podcasts: () => apiFetch<PodcastSeries[]>("/learning/podcasts"),
  fmwpo: () => apiFetch<FMWPOVideo[]>("/learning/fmwpo"),

  // Church config
  theme: () => apiFetch<Theme>("/church/theme"),
  missionVision: () => apiFetch<MissionVision>("/church/mission-vision"),
  setTheme: (body: Theme) => apiPatch<Theme>("/church/theme", body),
  setMissionVision: (body: MissionVision) => apiPatch<MissionVision>("/church/mission-vision", body),
};
