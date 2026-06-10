"use client";
import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import Header from "@/components/layout/Header";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import { FullPageLoader } from "@/components/ui/LoadingSpinner";
import { apiFetch } from "@/lib/api";
import { AttendanceSession } from "@/types/api";
import { formatDate, formatPercent } from "@/lib/utils";

const PRIMARY = "#121D55";

export default function AttendancePage() {
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<AttendanceSession[]>("/attendance/sessions")
      .then(setSessions)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const latest = sessions[sessions.length - 1];
  const avgPresent = sessions.length
    ? Math.round(sessions.reduce((s, r) => s + r.totalPresent, 0) / sessions.length)
    : 0;
  const avgRate = sessions.length
    ? sessions.reduce((s, r) => s + r.totalPresent / (r.totalPresent + r.totalAbsent || 1), 0) / sessions.length * 100
    : 0;

  const chartData = sessions.slice(-8).map((s) => ({
    name: formatDate(s.date).slice(0, 6),
    Present: s.totalPresent,
    Absent: s.totalAbsent,
    Rate: Math.round(s.totalPresent / (s.totalPresent + s.totalAbsent || 1) * 100),
  }));

  return (
    <div className="flex flex-col flex-1">
      <Header title="Attendance" subtitle="Session records and trends" />
      <div className="flex-1 p-6 overflow-y-auto">
        <PageHeader title="Attendance Records" subtitle={`${sessions.length} sessions recorded`} />

        {loading ? <FullPageLoader /> : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatCard label="Total Sessions" value={sessions.length} icon="📅" color={PRIMARY} />
              <StatCard label="Last Session Present" value={latest?.totalPresent ?? 0} icon="✅" color="#10B981" />
              <StatCard label="Avg. Attendance" value={avgPresent} icon="👥" color="#3B82F6" />
              <StatCard label="Avg. Rate" value={formatPercent(avgRate)} icon="📈" color="#F59E0B"
                delta={avgRate >= 70 ? "Healthy" : "Low"} deltaPositive={avgRate >= 70} />
            </div>

            {/* Chart */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 mb-6">
              <p className="font-semibold text-slate-700 mb-4">Attendance per Session</p>
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
                    {["Date", "Type", "Present", "Absent", "Rate"].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide px-5 py-3.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sessions.slice().reverse().map((s) => {
                    const rate = Math.round(s.totalPresent / (s.totalPresent + s.totalAbsent || 1) * 100);
                    return (
                      <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="px-5 py-3.5 text-sm text-slate-700">{formatDate(s.date)}</td>
                        <td className="px-5 py-3.5">
                          <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-600 text-xs font-medium">{s.type}</span>
                        </td>
                        <td className="px-5 py-3.5 text-sm font-semibold text-emerald-600">{s.totalPresent}</td>
                        <td className="px-5 py-3.5 text-sm text-red-400">{s.totalAbsent}</td>
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
                    <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-300 text-sm">No sessions recorded yet</td></tr>
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
