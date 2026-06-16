"use client";
import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import Header from "@/components/layout/Header";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import { FullPageLoader } from "@/components/ui/LoadingSpinner";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { AttendanceEvent } from "@/types/api";
import { formatDate, formatPercent } from "@/lib/utils";

const PRIMARY = "#121D55";

export default function AttendancePage() {
  const { user } = useAuthStore();
  const [sessions, setSessions] = useState<AttendanceEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.unitId) { setLoading(false); return; }
    apiFetch<AttendanceEvent[]>(`/attendance/unit/${user.unitId}/sessions?includeDescendants=true`)
      .then(setSessions)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const getPresent = (s: AttendanceEvent) =>
    (s.attendees ?? []).filter((a) => a.status === "Attended").length;
  const getTotal = (s: AttendanceEvent) => s._count?.attendees ?? (s.attendees?.length ?? 0);

  const latest = sessions[0];
  const latestPresent = latest ? getPresent(latest) : 0;
  const latestTotal = latest ? getTotal(latest) : 0;

  const avgRate = sessions.length
    ? sessions.reduce((sum, s) => {
        const total = getTotal(s);
        return sum + (total > 0 ? getPresent(s) / total : 0);
      }, 0) / sessions.length * 100
    : 0;

  const avgPresent = sessions.length
    ? Math.round(sessions.reduce((sum, s) => sum + getPresent(s), 0) / sessions.length)
    : 0;

  const chartData = sessions.slice(0, 8).slice().reverse().map((s) => {
    const present = getPresent(s);
    const total = getTotal(s);
    return {
      name: formatDate(s.date).slice(0, 6),
      Present: present,
      Absent: Math.max(total - present, 0),
      Rate: total > 0 ? Math.round((present / total) * 100) : 0,
    };
  });

  return (
    <div className="flex flex-col flex-1">
      <Header title="Attendance" subtitle="Session records and trends" />
      <div className="flex-1 p-6 overflow-y-auto">
        <PageHeader title="Attendance Records" subtitle={`${sessions.length} session${sessions.length !== 1 ? "s" : ""} recorded`} />

        {loading ? <FullPageLoader /> : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatCard label="Total Sessions" value={sessions.length} icon="📅" color={PRIMARY} />
              <StatCard label="Last Session Present" value={latestPresent} icon="✅" color="#10B981"
                delta={latestTotal > 0 ? `of ${latestTotal} total` : undefined} deltaPositive />
              <StatCard label="Avg. Attendance" value={avgPresent} icon="👥" color="#3B82F6" />
              <StatCard label="Avg. Rate" value={formatPercent(avgRate)} icon="📈" color="#F59E0B"
                delta={avgRate >= 70 ? "Healthy" : "Low"} deltaPositive={avgRate >= 70} />
            </div>

            {/* Chart */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 mb-6">
              <p className="font-semibold text-slate-700 mb-4">Attendance per Session (Last 8)</p>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <Tooltip />
                    <Bar dataKey="Present" fill={PRIMARY} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Absent" fill="#FCA5A5" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-48 flex items-center justify-center text-slate-300 text-sm">No data yet</div>
              )}
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    {["Date", "Title", "Unit", "Present", "Total", "Rate"].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide px-5 py-3.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => {
                    const present = getPresent(s);
                    const total = getTotal(s);
                    const rate = total > 0 ? Math.round((present / total) * 100) : 0;
                    return (
                      <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="px-5 py-3.5 text-sm text-slate-700 whitespace-nowrap">{formatDate(s.date)}</td>
                        <td className="px-5 py-3.5 text-sm text-slate-700 max-w-48 truncate">{s.title}</td>
                        <td className="px-5 py-3.5">
                          {s.createdByUnit && (
                            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-600 text-xs font-medium">
                              {s.createdByUnit.name}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-sm font-semibold text-emerald-600">{present}</td>
                        <td className="px-5 py-3.5 text-sm text-slate-500">{total}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden" style={{ maxWidth: 60 }}>
                              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${rate}%` }} />
                            </div>
                            <span className="text-xs text-slate-500">{rate}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {sessions.length === 0 && (
                    <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-300 text-sm">No sessions recorded yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
