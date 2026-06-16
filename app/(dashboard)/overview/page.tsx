"use client";
import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import Header from "@/components/layout/Header";
import StatCard from "@/components/ui/StatCard";
import PageHeader from "@/components/ui/PageHeader";
import { FullPageLoader } from "@/components/ui/LoadingSpinner";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ROLE_LABELS } from "@/types/auth";
import { AdminDashboard, GeneralDashboard, AttendanceEvent, FinanceSummary, Announcement } from "@/types/api";

const PRIMARY = "#121D55";
const PIE_COLORS = [PRIMARY, "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6"];

export default function OverviewPage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [adminStats, setAdminStats] = useState<AdminDashboard | null>(null);
  const [unitStats, setUnitStats] = useState<GeneralDashboard | null>(null);
  const [sessions, setSessions] = useState<AttendanceEvent[]>([]);
  const [financeSummary, setFinanceSummary] = useState<FinanceSummary | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  const isAdmin = user?.role === "BISHOP" || user?.role === "ADMIN";

  useEffect(() => {
    if (!user) return;

    const dashboardRequest = isAdmin
      ? apiFetch<AdminDashboard>("/analytics/admin/dashboard").catch(() => null)
      : user.unitId
        ? apiFetch<GeneralDashboard>(`/analytics/${user.unitId}/dashboard`).catch(() => null)
        : Promise.resolve(null);

    const sessionsRequest = user.unitId
      ? apiFetch<AttendanceEvent[]>(`/attendance/unit/${user.unitId}/sessions?includeDescendants=true`).catch(() => [] as AttendanceEvent[])
      : Promise.resolve([] as AttendanceEvent[]);

    const financeRequest = user.unitId
      ? apiFetch<FinanceSummary>(`/finances/unit/${user.unitId}/summary?includeDescendants=true`).catch(() => null)
      : Promise.resolve(null);

    Promise.all([
      dashboardRequest,
      sessionsRequest,
      financeRequest,
      apiFetch<Announcement[]>("/announcements").catch(() => [] as Announcement[]),
    ]).then(([stats, s, f, a]) => {
      if (isAdmin) setAdminStats(stats as AdminDashboard | null);
      else setUnitStats(stats as GeneralDashboard | null);
      setSessions(s);
      setFinanceSummary(f);
      setAnnouncements(a);
    }).finally(() => setLoading(false));
  }, [user, isAdmin]);

  // Attendance chart — last 6 sessions, oldest to newest
  const attendanceChart = sessions.slice(0, 6).slice().reverse().map((s) => {
    const present = (s.attendees ?? []).filter((a) => a.status === "Attended").length;
    const total = s._count?.attendees ?? (s.attendees?.length ?? 0);
    return {
      name: formatDate(s.date).slice(0, 6),
      Present: present,
      Absent: Math.max(total - present, 0),
    };
  });

  // Giving breakdown by type
  const givingsChart = financeSummary
    ? Object.entries(financeSummary.summary.byType).map(([name, value]) => ({ name, value }))
    : [];

  // Giving trend by month from recent records
  const givingByMonth = (financeSummary?.recentRecords ?? []).reduce<Record<string, number>>((acc, r) => {
    const mo = new Date(r.date).toLocaleString("en", { month: "short" });
    acc[mo] = (acc[mo] ?? 0) + r.amount;
    return acc;
  }, {});
  const givingTrendChart = Object.entries(givingByMonth).slice(-6).map(([name, value]) => ({ name, value }));

  if (loading) return (
    <div className="flex flex-col flex-1">
      <Header title="Overview" subtitle={user ? `${ROLE_LABELS[user.role]} Dashboard` : ""} />
      <FullPageLoader />
    </div>
  );

  return (
    <div className="flex flex-col flex-1">
      <Header title="Overview" subtitle={user ? `${ROLE_LABELS[user.role]} Dashboard${user.unitName ? ` · ${user.unitName}` : ""}` : ""} />
      <div className="flex-1 p-6 overflow-y-auto">
        <PageHeader title="Dashboard Overview" subtitle={`Welcome back${user ? `, ${user.firstName}` : ""}! Here's what's happening.`} />

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {isAdmin ? (
            <>
              <StatCard label="Total Members" value={adminStats?.totalMembers ?? 0} icon="👥" color={PRIMARY} />
              <StatCard label="Attendance Rate" value={`${adminStats?.attendanceRate ?? 0}%`} icon="✅" color="#10B981"
                delta={(adminStats?.attendanceRate ?? 0) >= 70 ? "Good" : "Low"} deltaPositive={(adminStats?.attendanceRate ?? 0) >= 70} />
              <StatCard label="Monthly Giving" value={formatCurrency(adminStats?.monthlyGiving ?? 0)} icon="💰" color="#F59E0B" />
              <StatCard label="New Members" value={adminStats?.newMembersThisMonth ?? 0} icon="🌱" color="#8B5CF6"
                delta={`${adminStats?.firstTimersThisMonth ?? 0} first-timers`} deltaPositive />
            </>
          ) : (
            <>
              <StatCard label="Total Members" value={unitStats?.totalMembers ?? 0} icon="👥" color={PRIMARY} />
              <StatCard label="Total Finances" value={formatCurrency(unitStats?.totalFinances ?? 0)} icon="💰" color="#F59E0B" />
              <StatCard label="Souls Won" value={unitStats?.totalSoulsWon ?? 0} icon="🙏" color="#10B981" />
              <StatCard label="Upcoming Events" value={unitStats?.upcomingEvents ?? 0} icon="📅" color="#3B82F6" />
            </>
          )}
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* Attendance chart */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <p className="font-semibold text-slate-700 mb-4">Attendance (Last 6 Sessions)</p>
            {attendanceChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={attendanceChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <Tooltip />
                  <Bar dataKey="Present" fill={PRIMARY} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Absent" fill="#FCA5A5" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-slate-300 text-sm">No attendance data yet</div>
            )}
          </div>

          {/* Giving trend */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <p className="font-semibold text-slate-700 mb-4">Giving Trend</p>
            {givingTrendChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={givingTrendChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={(v) => `₵${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => typeof v === "number" ? formatCurrency(v) : ""} />
                  <Bar dataKey="value" fill={PRIMARY} radius={[4, 4, 0, 0]} name="Giving" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-slate-300 text-sm">No giving data yet</div>
            )}
          </div>
        </div>

        {/* Givings breakdown + Recent announcements */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Givings breakdown */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <p className="font-semibold text-slate-700 mb-4">Giving Breakdown</p>
            {givingsChart.length > 0 ? (
              <div className="flex items-center gap-6">
                <PieChart width={120} height={120}>
                  <Pie data={givingsChart} cx={55} cy={55} innerRadius={35} outerRadius={55} dataKey="value" paddingAngle={2}>
                    {givingsChart.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                </PieChart>
                <div className="flex-1">
                  {givingsChart.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 mb-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-xs text-slate-600 flex-1">{item.name}</span>
                      <span className="text-xs font-semibold text-slate-700">{formatCurrency(item.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-32 flex items-center justify-center text-slate-300 text-sm">No giving records yet</div>
            )}
          </div>

          {/* Recent announcements */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <p className="font-semibold text-slate-700 mb-4">Recent Announcements</p>
            {announcements.length > 0 ? (
              <div className="space-y-3">
                {announcements.slice(0, 3).map((a) => (
                  <div key={a.id} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-sm flex-shrink-0">📢</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{a.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{formatDate(a.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-32 flex items-center justify-center text-slate-300 text-sm">No announcements yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
