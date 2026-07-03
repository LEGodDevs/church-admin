"use client";
import { useCallback } from "react";
import Link from "next/link";
import { Page } from "@/components/ui/Page";
import { Card, CardHeader } from "@/components/ui/Card";
import StatCard from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { LoadingBlock, ErrorBlock, EmptyState } from "@/components/ui/States";
import { AreaTrend, Donut, BarSeries, MultiLine, Gauge, CHART_COLORS } from "@/components/charts/Charts";
import { api } from "@/lib/api";
import { useApi } from "@/hooks/useApi";
import { useScope } from "@/hooks/useScope";
import { ghc, num, dateShort } from "@/lib/format";
import {
  monthlyFinance, financeByTypeSeries, attendanceTrend, evangelismTrend, memberGrowth,
} from "@/lib/analytics";
import type {
  AdminDashboard, GeneralDashboard, FinanceSummary, AttendanceEvent, EvangelismRecord, Member, Report,
} from "@/types/api";

interface Bundle {
  admin: AdminDashboard | null;
  unit: GeneralDashboard | null;
  finance: FinanceSummary | null;
  sessions: AttendanceEvent[];
  evangelism: EvangelismRecord[];
  members: Member[];
  reports: Report[];
}

export default function OverviewPage() {
  const { unitId, unitName, isAdmin, user } = useScope();

  const load = useCallback(async (): Promise<Bundle> => {
    if (!unitId) throw new Error("No unit assigned to your account.");
    const settle = <T,>(p: Promise<T>, fb: T): Promise<T> => p.catch(() => fb);
    const [admin, unit, finance, sessions, evangelism, members, reports] = await Promise.all([
      isAdmin ? settle(api.adminDashboard(), null) : Promise.resolve(null),
      !isAdmin ? settle(api.unitDashboard(unitId), null) : Promise.resolve(null),
      settle(api.unitFinance(unitId), null),
      settle(api.unitSessions(unitId), []),
      settle(api.evangelism(unitId), []),
      isAdmin ? settle(api.users(), []) : Promise.resolve([]),
      settle(api.incomingReports(unitId), []),
    ]);
    return { admin, unit, finance, sessions, evangelism, members, reports };
  }, [unitId, isAdmin]);

  const { data, loading, error, refetch } = useApi(load, [unitId, isAdmin]);

  if (loading) return <Page title="Overview"><LoadingBlock /></Page>;
  if (error) return <Page title="Overview"><ErrorBlock message={error} onRetry={refetch} /></Page>;
  if (!data) return null;

  const { admin, unit, finance, sessions, evangelism, members, reports } = data;

  // Normalize KPIs across admin vs unit dashboards
  const totalMembers = admin?.totalMembers ?? unit?.totalMembers ?? 0;
  const monthlyGiving = admin?.monthlyGiving ?? unit?.totalFinances ?? finance?.summary.total ?? 0;
  const attendanceRate = admin?.attendanceRate ?? 0;
  const soulsWon = evangelism.reduce((s, e) => s + (e.soulsWon || 0), 0) || unit?.totalSoulsWon || 0;
  const firstTimers = admin?.firstTimersThisMonth ?? 0;
  const upcoming = unit?.upcomingEvents ?? sessions.filter((s) => new Date(s.date) > new Date()).length;

  const givingSeries = monthlyFinance(finance?.recentRecords ?? []);
  const typeSeries = financeByTypeSeries(finance?.summary.byType ?? {});
  const attSeries = attendanceTrend(sessions);
  const evaSeries = evangelismTrend(evangelism);
  const growthSeries = memberGrowth(members);

  const recentReports = admin?.recentReports ?? reports.slice(0, 5);

  return (
    <Page
      title={`Welcome, ${user?.firstName ?? "Leader"}`}
      subtitle={isAdmin ? "Church-wide performance at a glance" : `${unitName ?? "Your unit"} · performance overview`}
      action={
        <Link href="/organogram" className="px-4 py-2 rounded-xl bg-[#121D55] text-white text-sm font-medium hover:bg-[#1e2f7a]">
          View Organogram →
        </Link>
      }
    >
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard label="Total Members" value={num(totalMembers)} icon="👥" color="#121D55"
          sub={isAdmin ? `${num(admin?.newMembersThisMonth ?? 0)} new this month` : undefined} />
        <StatCard label="Monthly Giving" value={ghc(monthlyGiving)} icon="💰" color="#059669" />
        <StatCard label="Attendance Rate" value={`${attendanceRate}%`} icon="✅" color="#7c3aed" />
        <StatCard label="Souls Won" value={num(soulsWon)} icon="🌍" color="#d97706"
          sub={`${num(firstTimers)} first-timers this month`} />
      </div>

      {/* Charts row 1 */}
      <div className="grid lg:grid-cols-3 gap-5 mb-5">
        <Card className="lg:col-span-2">
          <CardHeader title="Giving trend" subtitle="Total contributions over the last 6 months" />
          {givingSeries.some((d) => d.total > 0) ? (
            <AreaTrend data={givingSeries} xKey="month" yKey="total" color="#059669" format={(v) => ghc(v)} />
          ) : (
            <EmptyState icon="💸" title="No giving records yet" />
          )}
        </Card>
        <Card>
          <CardHeader title="Giving by type" subtitle="Distribution this period" />
          {typeSeries.length > 0 ? (
            <Donut data={typeSeries} format={(v) => ghc(v)} />
          ) : (
            <EmptyState icon="📊" title="No data" />
          )}
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid lg:grid-cols-3 gap-5 mb-5">
        <Card>
          <CardHeader title="Attendance rate" subtitle="Present share by month" />
          {attSeries.some((d) => d.rate > 0) ? (
            <BarSeries data={attSeries} xKey="month" yKey="rate" color="#7c3aed" format={(v) => `${v}%`} />
          ) : (
            <EmptyState icon="🪑" title="No attendance yet" />
          )}
        </Card>
        <Card>
          <CardHeader title="Evangelism" subtitle="Souls won vs people reached" />
          {evaSeries.some((d) => d.reached > 0 || d.souls > 0) ? (
            <MultiLine
              data={evaSeries}
              xKey="month"
              lines={[
                { key: "reached", label: "Reached", color: CHART_COLORS[1] },
                { key: "souls", label: "Souls won", color: CHART_COLORS[3] },
              ]}
            />
          ) : (
            <EmptyState icon="🌱" title="No outreach records" />
          )}
        </Card>
        {isAdmin ? (
          <Card>
            <CardHeader title="Membership growth" subtitle="Cumulative members" />
            <AreaTrend data={growthSeries} xKey="month" yKey="total" color="#121D55" />
          </Card>
        ) : (
          <Card>
            <CardHeader title="Attendance health" subtitle="Overall present rate" />
            <Gauge value={attendanceRate} label="present" color="#7c3aed" />
          </Card>
        )}
      </div>

      {/* Bottom: quick counts + recent reports */}
      <div className="grid lg:grid-cols-3 gap-5">
        <Card>
          <CardHeader title="At a glance" />
          <div className="space-y-3">
            {[
              { label: "Upcoming events", value: num(upcoming), icon: "📅" },
              { label: "Zones", value: num(admin?.totalZones ?? unit?.totalSubUnits ?? 0), icon: "🗺️" },
              { label: "Branches", value: num(admin?.totalBranches ?? 0), icon: "🏛️" },
              { label: "People reached", value: num(evangelism.reduce((s, e) => s + (e.peopleReached || 0), 0)), icon: "📣" },
            ].map((r) => (
              <div key={r.label} className="flex items-center justify-between">
                <span className="text-sm text-slate-500 flex items-center gap-2">
                  <span>{r.icon}</span>
                  {r.label}
                </span>
                <span className="text-sm font-semibold text-slate-800">{r.value}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Recent reports"
            subtitle="Latest submissions from your units"
            action={<Link href="/reports" className="text-xs font-medium text-[#121D55] hover:underline">View all</Link>}
          />
          {recentReports.length === 0 ? (
            <EmptyState icon="📋" title="No reports yet" />
          ) : (
            <div className="divide-y divide-slate-100">
              {recentReports.map((r) => (
                <div key={r.id} className="flex items-center justify-between py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{r.title}</p>
                    <p className="text-xs text-slate-400">{r.unit?.name ?? "—"} · {dateShort(r.submittedAt)}</p>
                  </div>
                  <Badge tone={r.status === "reviewed" ? "green" : "amber"}>{r.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </Page>
  );
}
