"use client";
import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import Header from "@/components/layout/Header";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import { FullPageLoader } from "@/components/ui/LoadingSpinner";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { FinanceSummary } from "@/types/api";
import { formatCurrency, formatDate } from "@/lib/utils";

const COLORS = ["#121D55", "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444"];

export default function FinancesPage() {
  const { user } = useAuthStore();
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.unitId) { setLoading(false); return; }
    apiFetch<FinanceSummary>(`/finances/unit/${user.unitId}/summary?includeDescendants=true`)
      .then(setSummary)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const total = summary?.summary.total ?? 0;
  const records = summary?.recentRecords ?? [];

  const thisMonth = records.filter((r) => {
    const d = new Date(r.date);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).reduce((s, r) => s + r.amount, 0);

  const byTypeChart = summary
    ? Object.entries(summary.summary.byType).map(([name, value]) => ({ name, value }))
    : [];

  const byMonth = records.reduce<Record<string, number>>((acc, r) => {
    const mo = new Date(r.date).toLocaleString("en", { month: "short", year: "2-digit" });
    acc[mo] = (acc[mo] ?? 0) + r.amount;
    return acc;
  }, {});
  const byMonthChart = Object.entries(byMonth).slice(-6).map(([name, value]) => ({ name, value }));

  const memberName = (r: FinanceSummary["recentRecords"][number]) =>
    r.user ? `${r.user.firstName} ${r.user.lastName}` : "—";

  return (
    <div className="flex flex-col flex-1">
      <Header title="Finances" subtitle="Unit giving records" />
      <div className="flex-1 p-6 overflow-y-auto">
        <PageHeader title="Finances" subtitle={`${records.length} giving record${records.length !== 1 ? "s" : ""}`} />

        {loading ? <FullPageLoader /> : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <StatCard label="Total Givings" value={formatCurrency(total)} icon="💰" color="#121D55" />
              <StatCard label="This Month" value={formatCurrency(thisMonth)} icon="📅" color="#10B981" />
              <StatCard label="Giving Types" value={byTypeChart.length} icon="🗂️" color="#F59E0B" />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                <p className="font-semibold text-slate-700 mb-4">Monthly Givings</p>
                {byMonthChart.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={byMonthChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                      <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={(v) => `₵${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v) => typeof v === "number" ? formatCurrency(v) : ""} />
                      <Bar dataKey="value" fill="#121D55" radius={[4, 4, 0, 0]} name="Amount" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-48 flex items-center justify-center text-slate-300 text-sm">No data</div>
                )}
              </div>

              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                <p className="font-semibold text-slate-700 mb-4">Giving by Type</p>
                {byTypeChart.length > 0 ? (
                  <div className="flex items-center gap-4">
                    <PieChart width={130} height={130}>
                      <Pie data={byTypeChart} cx={60} cy={60} innerRadius={38} outerRadius={58} dataKey="value" paddingAngle={2}>
                        {byTypeChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                    </PieChart>
                    <div className="flex-1">
                      {byTypeChart.map((item, i) => (
                        <div key={i} className="flex items-center gap-2 mb-2">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                          <span className="text-xs text-slate-600 flex-1 truncate">{item.name}</span>
                          <span className="text-xs font-semibold text-slate-700">{formatCurrency(item.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="h-48 flex items-center justify-center text-slate-300 text-sm">No data</div>
                )}
              </div>
            </div>

            {/* Recent givings table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <p className="font-semibold text-slate-700">Recent Transactions</p>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    {["Member", "Type", "Amount", "Unit", "Date"].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide px-5 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.slice(0, 20).map((r) => (
                    <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-5 py-3 text-sm text-slate-700">{memberName(r)}</td>
                      <td className="px-5 py-3">
                        <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-600 text-xs font-medium">{r.type}</span>
                      </td>
                      <td className="px-5 py-3 text-sm font-semibold text-slate-800">{formatCurrency(r.amount)}</td>
                      <td className="px-5 py-3 text-sm text-slate-500">{r.unit?.name ?? "—"}</td>
                      <td className="px-5 py-3 text-sm text-slate-400">{formatDate(r.date)}</td>
                    </tr>
                  ))}
                  {records.length === 0 && (
                    <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-300 text-sm">No giving records yet</td></tr>
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
