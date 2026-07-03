"use client";
import { useCallback, useMemo } from "react";
import { Page } from "@/components/ui/Page";
import { Card, CardHeader } from "@/components/ui/Card";
import StatCard from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { LoadingBlock, ErrorBlock, EmptyState } from "@/components/ui/States";
import { AreaTrend, Donut } from "@/components/charts/Charts";
import { api } from "@/lib/api";
import { useApi } from "@/hooks/useApi";
import { useScope } from "@/hooks/useScope";
import { ghc, dateShort } from "@/lib/format";
import { monthlyFinance, financeByTypeSeries } from "@/lib/analytics";
import type { Finance } from "@/types/api";

const TYPE_TONE: Record<string, "blue" | "green" | "amber" | "purple" | "red" | "slate"> = {
  Tithe: "blue", Offering: "green", Seed: "amber", Partnership: "purple", Special: "red",
};

export default function FinancesPage() {
  const { unitId } = useScope();
  const { data, loading, error, refetch } = useApi(
    useCallback(() => (unitId ? api.unitFinance(unitId) : Promise.reject(new Error("No unit"))), [unitId]),
    [unitId]
  );

  const records = data?.recentRecords ?? [];
  const byType = data?.summary.byType ?? {};
  const total = data?.summary.total ?? 0;

  const givingSeries = useMemo(() => monthlyFinance(records), [records]);
  const typeSeries = useMemo(() => financeByTypeSeries(byType), [byType]);
  const topGivers = useMemo(() => {
    const map = new Map<string, { name: string; pic?: string; total: number }>();
    for (const r of records) {
      const key = r.user?.id ?? r.userId;
      const name = r.user ? `${r.user.firstName} ${r.user.lastName}` : "Unknown";
      const prev = map.get(key) ?? { name, pic: r.user?.profilePic, total: 0 };
      prev.total += r.amount;
      map.set(key, prev);
    }
    return [...map.values()].sort((a, b) => b.total - a.total).slice(0, 5);
  }, [records]);

  const columns: Column<Finance>[] = [
    {
      key: "member",
      header: "Member",
      render: (r) => (
        <div className="flex items-center gap-3">
          <Avatar name={r.user ? `${r.user.firstName} ${r.user.lastName}` : "Unknown"} src={r.user?.profilePic} size={30} />
          <span className="font-medium text-slate-700">{r.user ? `${r.user.firstName} ${r.user.lastName}` : "—"}</span>
        </div>
      ),
    },
    { key: "type", header: "Type", render: (r) => <Badge tone={TYPE_TONE[r.type] ?? "slate"}>{r.type}</Badge> },
    { key: "unit", header: "Unit", render: (r) => <span className="text-slate-500">{r.unit?.name ?? "—"}</span> },
    { key: "date", header: "Date", render: (r) => <span className="text-slate-500">{dateShort(r.date)}</span> },
    { key: "amount", header: "Amount", align: "right", render: (r) => <span className="font-semibold text-slate-800">{ghc(r.amount)}</span> },
  ];

  return (
    <Page title="Finances" subtitle="Contributions across your units">
      {loading ? (
        <Card><LoadingBlock /></Card>
      ) : error ? (
        <Card><ErrorBlock message={error} onRetry={refetch} /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
            <StatCard label="Total received" value={ghc(total)} icon="💰" color="#059669" />
            <StatCard label="Transactions" value={records.length} icon="🧾" color="#121D55" />
            <StatCard label="Giving types" value={Object.keys(byType).length} icon="🏷️" color="#7c3aed" />
            <StatCard
              label="Top type"
              value={typeSeries[0]?.name ?? "—"}
              sub={typeSeries[0] ? ghc(typeSeries[0].value) : undefined}
              icon="⭐"
              color="#d97706"
            />
          </div>

          <div className="grid lg:grid-cols-3 gap-5 mb-5">
            <Card className="lg:col-span-2">
              <CardHeader title="Giving trend" subtitle="Monthly totals" />
              {givingSeries.some((d) => d.total > 0) ? (
                <AreaTrend data={givingSeries} xKey="month" yKey="total" color="#059669" format={ghc} />
              ) : (
                <EmptyState icon="💸" title="No records" />
              )}
            </Card>
            <Card>
              <CardHeader title="By type" />
              {typeSeries.length ? <Donut data={typeSeries} format={ghc} /> : <EmptyState icon="📊" title="No data" />}
            </Card>
          </div>

          <div className="grid lg:grid-cols-3 gap-5">
            <Card className="lg:col-span-2">
              <CardHeader title="Recent transactions" subtitle={`${records.length} most recent`} />
              <DataTable columns={columns} rows={records} keyField={(r) => r.id} emptyIcon="🧾" emptyTitle="No transactions" />
            </Card>
            <Card>
              <CardHeader title="Top givers" subtitle="By total contributed" />
              {topGivers.length === 0 ? (
                <EmptyState icon="🤝" title="No givers yet" />
              ) : (
                <div className="space-y-3">
                  {topGivers.map((g, i) => (
                    <div key={g.name + i} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-300 w-4">{i + 1}</span>
                      <Avatar name={g.name} src={g.pic} size={30} />
                      <span className="flex-1 text-sm text-slate-700 truncate">{g.name}</span>
                      <span className="text-sm font-semibold text-slate-800">{ghc(g.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </Page>
  );
}
