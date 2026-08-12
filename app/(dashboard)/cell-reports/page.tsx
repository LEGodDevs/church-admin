"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import Header from "@/components/layout/Header";
import PageHeader from "@/components/ui/PageHeader";
import { FullPageLoader } from "@/components/ui/LoadingSpinner";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import type {
  CellReportCompliance, CellReportComplianceRow, CellReportTrendPoint,
} from "@/types/api";

/**
 * Cell health, week by week.
 *
 * This is the question leadership actually opens the product to ask — which
 * cells met, which didn't, and whether attendance is going the right way — and
 * it only became answerable once cell reports carried numbers instead of prose.
 */

/** Sunday of the week containing `d`, matching the server's normalisation. */
function weekEndingFor(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  x.setUTCDate(x.getUTCDate() + ((7 - x.getUTCDay()) % 7));
  return x;
}

function fmtWeek(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function fmtMoney(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export default function CellReportsPage() {
  const { user } = useAuthStore();
  const [weekOffset, setWeekOffset] = useState(0);
  const [compliance, setCompliance] = useState<CellReportCompliance | null>(null);
  const [trend, setTrend] = useState<CellReportTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "reported" | "missing">("all");

  const week = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + weekOffset * 7);
    return weekEndingFor(d);
  }, [weekOffset]);

  const load = useCallback(async () => {
    if (!user?.unitId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const [c, t] = await Promise.all([
        apiFetch<CellReportCompliance>(
          `/cell-reports/unit/${user.unitId}/compliance?week=${encodeURIComponent(week.toISOString())}`,
        ),
        apiFetch<CellReportTrendPoint[]>(
          `/cell-reports/unit/${user.unitId}/trend?weeks=12`,
        ).catch(() => [] as CellReportTrendPoint[]),
      ]);
      setCompliance(c);
      setTrend(t);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load cell reports");
    } finally {
      setLoading(false);
    }
  }, [user?.unitId, week]);

  useEffect(() => { load(); }, [load]);

  const rows: CellReportComplianceRow[] = useMemo(() => {
    const all = compliance?.units ?? [];
    if (filter === "reported") return all.filter((r) => r.reported);
    if (filter === "missing") return all.filter((r) => !r.reported);
    return all;
  }, [compliance, filter]);

  if (loading) return <FullPageLoader />;

  if (!user?.unitId) {
    return (
      <div className="flex flex-col flex-1">
        <Header title="Cell Reports" subtitle="Weekly cell health" />
        <div className="flex-1 p-6">
          <div className="bg-white rounded-2xl p-8 border border-slate-100 text-center">
            <p className="text-slate-500 text-sm">
              You aren&apos;t attached to a unit yet, so there are no cells to report on.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const rate = compliance?.complianceRate ?? 0;
  const rateColor = rate >= 80 ? "#059669" : rate >= 50 ? "#B45309" : "#BE123C";

  return (
    <div className="flex flex-col flex-1">
      <Header title="Cell Reports" subtitle="Which cells met, and how they're doing" />
      <div className="flex-1 p-6 overflow-y-auto">
        <PageHeader
          title="Cell Reports"
          subtitle={`Week ending ${week.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}`}
        />

        {/* Week navigation */}
        <div className="flex items-center gap-2 mb-5">
          <button
            onClick={() => setWeekOffset((w) => w - 1)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
          >
            ← Previous week
          </button>
          <button
            onClick={() => setWeekOffset(0)}
            disabled={weekOffset === 0}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            This week
          </button>
          <button
            onClick={() => setWeekOffset((w) => w + 1)}
            disabled={weekOffset >= 0}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            Next week →
          </button>
        </div>

        {error && (
          <div className="mb-5 px-4 py-3 rounded-xl bg-rose-50 border border-rose-100 text-sm text-rose-700">
            {error}
          </div>
        )}

        {/* Headline numbers */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Reported
            </p>
            <p className="text-2xl font-bold tabular-nums" style={{ color: rateColor }}>
              {compliance?.reported ?? 0}
              <span className="text-slate-300 text-lg"> / {compliance?.expected ?? 0}</span>
            </p>
            <div className="h-1.5 rounded-full bg-slate-100 mt-2 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${rate}%`, background: rateColor }} />
            </div>
          </div>
          {[
            ["Attendance", compliance ? `${compliance.totals.membersPresent}` : "0", `${compliance?.totals.membersAbsent ?? 0} absent`],
            ["Visitors", `${compliance?.totals.visitors ?? 0}`, `${compliance?.totals.soulsWon ?? 0} souls won`],
            ["Offering", fmtMoney(compliance?.totals.offering ?? 0), "across reporting cells"],
          ].map(([label, value, sub]) => (
            <div key={label} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                {label}
              </p>
              <p className="text-2xl font-bold text-slate-800 tabular-nums">{value}</p>
              <p className="text-[11px] text-slate-400 mt-1">{sub}</p>
            </div>
          ))}
        </div>

        {/* Trend */}
        {trend.length > 1 && (
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm mb-6">
            <p className="font-semibold text-slate-700 text-sm mb-4">
              Attendance rate, last 12 weeks
            </p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 4, right: 8, bottom: 4, left: -18 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis
                    dataKey="weekEnding"
                    tickFormatter={fmtWeek}
                    tick={{ fontSize: 11, fill: "#94A3B8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#94A3B8" }}
                    axisLine={false}
                    tickLine={false}
                    domain={[0, 100]}
                  />
                  <Tooltip
                    labelFormatter={(v) => `Week ending ${fmtWeek(String(v))}`}
                    formatter={(v) => [`${v}%`, "Attendance"]}
                    contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 12 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="attendanceRate"
                    stroke="#0D6E68"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "#0D6E68" }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Per-cell table */}
        <div className="flex items-center gap-2 mb-3">
          {(["all", "reported", "missing"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                filter === f
                  ? "bg-slate-800 text-white border-transparent"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
              }`}
            >
              {f === "all" ? "All cells" : f === "reported" ? "Reported" : `Not reported (${compliance?.missing ?? 0})`}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {["Cell", "Status", "Present", "Absent", "Visitors", "Offering", "Filed by"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.unitId} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-700">{r.unitName}</p>
                      <p className="text-[11px] text-slate-400">
                        {r.unitType} · {r.memberCount} member{r.memberCount === 1 ? "" : "s"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          r.reported
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-rose-50 text-rose-700"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${r.reported ? "bg-emerald-500" : "bg-rose-500"}`} />
                        {r.reported ? "Reported" : "Missing"}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">{r.membersPresent ?? "—"}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">{r.membersAbsent ?? "—"}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">{r.visitors ?? "—"}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">
                      {r.offering != null ? fmtMoney(r.offering) : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-[13px]">{r.submittedBy ?? "—"}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-400 text-sm">
                      {compliance?.expected === 0
                        ? "There are no cells beneath your unit yet."
                        : "Nothing matches that filter."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
