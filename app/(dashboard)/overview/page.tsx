"use client";
import { useEffect, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
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
import { Member, AttendanceSession, Giving, Report, Announcement } from "@/types/api";

const PRIMARY = "#121D55";

export default function OverviewPage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [givings, setGivings] = useState<Giving[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    if (!user?.unitId) return;
    Promise.all([
      apiFetch<Member[]>("/users").catch(() => [] as Member[]),
      apiFetch<AttendanceSession[]>(`/attendance/unit/${user.unitId}/sessions?includeDescendants=true`).catch(() => [] as AttendanceSession[]),
      apiFetch<{ recentRecords: Array<{ id: string; userId: string; amount: number; type: string; date: string; unitId: string; user: { firstName: string; lastName: string } }> }>(
        `/finances/unit/${user.unitId}/summary?includeDescendants=true`
      ).then((res) => res.recentRecords.map((r) => ({
        id: r.id, memberId: r.userId, memberName: `${r.user.firstName} ${r.user.lastName}`,
        amount: r.amount, type: r.type, date: r.date, unitId: r.unitId,
      } as Giving))).catch(() => [] as Giving[]),
      apiFetch<Report[]>(`/reports/incoming/${user.unitId}?includeDescendants=true`).catch(() => [] as Report[]),
      apiFetch<Announcement[]>("/announcements").catch(() => [] as Announcement[]),
    ]).then(([m, s, g, r, a]) => {
      setMembers(m);
      setSessions(s);
      setGivings(g);
      setReports(r);
      setAnnouncements(a);
    }).finally(() => setLoading(false));
  }, [user?.unitId]);

  const totalMembers = members.length;
  const recentSession = sessions[sessions.length - 1];
  const attendanceRate = recentSession
    ? Math.round((recentSession.totalPresent / (recentSession.totalPresent + recentSession.totalAbsent || 1)) * 100)
    : 0;
  const totalGivings = givings.reduce((sum, g) => sum + g.amount, 0);
  const pendingReports = reports.filter((r) => r.status === "PENDING").length;

  // Attendance chart — last 6 sessions
  const attendanceChart = sessions.slice(-6).map((s) => ({
    name: formatDate(s.date).slice(0, 6),
    Present: s.totalPresent,
    Absent: s.totalAbsent,
  }));

  // Givings chart — by type
  const givingsByType = givings.reduce<Record<string, number>>((acc, g) => {
    acc[g.type] = (acc[g.type] ?? 0) + g.amount;
    return acc;
  }, {});
  const givingsChart = Object.entries(givingsByType).map(([name, value]) => ({ name, value }));
  const PIE_COLORS = [PRIMARY, "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6"];

  // New members by month (last 4)
  const membersByMonth = members.reduce<Record<string, number>>((acc, m) => {
    const mo = new Date(m.createdAt).toLocaleString("en", { month: "short" });
    acc[mo] = (acc[mo] ?? 0) + 1;
    return acc;
  }, {});
  const growthChart = Object.entries(membersByMonth).slice(-4).map(([name, value]) => ({ name, value }));

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
          <StatCard label="Total Members" value={totalMembers} icon="👥" color={PRIMARY} />
          <StatCard label="Attendance Rate" value={`${attendanceRate}%`} icon="✅" color="#10B981"
            delta={attendanceRate >= 70 ? "Good" : "Low"} deltaPositive={attendanceRate >= 70} />
          <StatCard label="Total Givings" value={formatCurrency(totalGivings)} icon="💰" color="#F59E0B" />
          <StatCard label="Pending Reports" value={pendingReports} icon="📋" color="#EF4444"
            delta={pendingReports > 0 ? `${pendingReports} new` : undefined} deltaPositive={false} />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* Attendance chart */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <p className="font-semibold text-slate-700 mb-4">Attendance (Last 6 Sessions)</p>
            {attendanceChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={attendanceChart}>
                  <defs>
                    <linearGradient id="presentGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={PRIMARY} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={PRIMARY} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="Present" stroke={PRIMARY} fill="url(#presentGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="Absent" stroke="#EF4444" fill="transparent" strokeWidth={2} strokeDasharray="4 2" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-slate-300 text-sm">No attendance data yet</div>
            )}
          </div>

          {/* Member growth */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <p className="font-semibold text-slate-700 mb-4">Member Growth</p>
            {growthChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={growthChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <Tooltip />
                  <Bar dataKey="value" fill={PRIMARY} radius={[4, 4, 0, 0]} name="New Members" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-slate-300 text-sm">No growth data yet</div>
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
