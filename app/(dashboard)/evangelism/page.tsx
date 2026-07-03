"use client";
import { useCallback, useMemo, useState } from "react";
import { Page } from "@/components/ui/Page";
import { Card, CardHeader } from "@/components/ui/Card";
import StatCard from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { LoadingBlock, ErrorBlock, EmptyState } from "@/components/ui/States";
import { MultiLine, CHART_COLORS } from "@/components/charts/Charts";
import { api } from "@/lib/api";
import { useApi } from "@/hooks/useApi";
import { useScope } from "@/hooks/useScope";
import { dateShort } from "@/lib/format";
import { evangelismTrend } from "@/lib/analytics";
import type { EvangelismRecord, FirstTimer, FollowUp } from "@/types/api";

type Tab = "records" | "first-timers" | "follow-ups";

interface Bundle {
  records: EvangelismRecord[];
  firstTimers: FirstTimer[];
  followUps: FollowUp[];
}

export default function EvangelismPage() {
  const { unitId } = useScope();
  const load = useCallback(async (): Promise<Bundle> => {
    if (!unitId) throw new Error("No unit");
    const settle = <T,>(p: Promise<T>, fb: T) => p.catch(() => fb);
    const [records, firstTimers, followUps] = await Promise.all([
      settle(api.evangelism(unitId), []),
      settle(api.firstTimers(unitId), []),
      settle(api.followUps(unitId), []),
    ]);
    return { records, firstTimers, followUps };
  }, [unitId]);

  const { data, loading, error, refetch } = useApi(load, [unitId]);
  const [tab, setTab] = useState<Tab>("records");

  const records = data?.records ?? [];
  const firstTimers = data?.firstTimers ?? [];
  const followUps = data?.followUps ?? [];

  const souls = records.reduce((s, r) => s + (r.soulsWon || 0), 0);
  const reached = records.reduce((s, r) => s + (r.peopleReached || 0), 0);
  const pendingFollowUps = followUps.filter((f) => f.status === "pending").length;
  const trend = useMemo(() => evangelismTrend(records), [records]);

  const recordCols: Column<EvangelismRecord>[] = [
    { key: "period", header: "Period", render: (r) => <Badge tone="slate">{r.period}</Badge> },
    { key: "date", header: "Date", render: (r) => <span className="text-slate-500">{dateShort(r.date)}</span> },
    { key: "unit", header: "Unit", render: (r) => <span className="text-slate-500">{r.unit?.name ?? "—"}</span> },
    { key: "reached", header: "Reached", align: "center", render: (r) => <span className="font-medium">{r.peopleReached}</span> },
    { key: "souls", header: "Souls won", align: "center", render: (r) => <span className="font-semibold text-emerald-600">{r.soulsWon}</span> },
    { key: "by", header: "By", render: (r) => <span className="text-slate-500">{r.submitter ? `${r.submitter.firstName} ${r.submitter.lastName}` : "—"}</span> },
  ];
  const ftCols: Column<FirstTimer>[] = [
    { key: "name", header: "Name", render: (f) => <span className="font-medium text-slate-800">{f.name}</span> },
    { key: "contact", header: "Contact", render: (f) => <span className="text-slate-500">{f.phoneNumber ?? f.email ?? "—"}</span> },
    { key: "date", header: "Date", render: (f) => <span className="text-slate-500">{dateShort(f.date)}</span> },
    { key: "unit", header: "Unit", render: (f) => <span className="text-slate-500">{f.unit?.name ?? "—"}</span> },
    { key: "by", header: "Recorded by", render: (f) => <span className="text-slate-500">{f.recordedBy ? `${f.recordedBy.firstName} ${f.recordedBy.lastName}` : "—"}</span> },
  ];
  const fuCols: Column<FollowUp>[] = [
    { key: "target", header: "Person", render: (f) => <span className="font-medium text-slate-800">{f.targetName ?? "—"}</span> },
    { key: "note", header: "Note", render: (f) => <span className="text-slate-500 line-clamp-1">{f.note}</span> },
    { key: "type", header: "Type", render: (f) => <Badge tone="slate">{f.type}</Badge> },
    { key: "date", header: "Date", render: (f) => <span className="text-slate-500">{dateShort(f.date)}</span> },
    {
      key: "status",
      header: "Status",
      align: "center",
      render: (f) => <Badge tone={f.status === "completed" ? "green" : f.status === "pending" ? "amber" : "slate"}>{f.status}</Badge>,
    },
  ];

  return (
    <Page title="Evangelism" subtitle="Outreach, souls won and follow-ups">
      {loading ? (
        <Card><LoadingBlock /></Card>
      ) : error ? (
        <Card><ErrorBlock message={error} onRetry={refetch} /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
            <StatCard label="Souls won" value={souls} icon="🌍" color="#059669" />
            <StatCard label="People reached" value={reached} icon="📣" color="#121D55" />
            <StatCard label="First-timers" value={firstTimers.length} icon="🙌" color="#7c3aed" />
            <StatCard label="Pending follow-ups" value={pendingFollowUps} icon="📞" color="#d97706" />
          </div>

          <Card className="mb-5">
            <CardHeader title="Outreach trend" subtitle="Souls won vs people reached" />
            {trend.some((d) => d.reached > 0 || d.souls > 0) ? (
              <MultiLine
                data={trend}
                xKey="month"
                lines={[
                  { key: "reached", label: "Reached", color: CHART_COLORS[0] },
                  { key: "souls", label: "Souls won", color: CHART_COLORS[3] },
                ]}
              />
            ) : (
              <EmptyState icon="🌱" title="No outreach records yet" />
            )}
          </Card>

          <Card>
            <div className="mb-4">
              <Tabs
                active={tab}
                onChange={setTab}
                tabs={[
                  { key: "records", label: "Records", count: records.length },
                  { key: "first-timers", label: "First-timers", count: firstTimers.length },
                  { key: "follow-ups", label: "Follow-ups", count: followUps.length },
                ]}
              />
            </div>
            {tab === "records" && <DataTable columns={recordCols} rows={records} keyField={(r) => r.id} emptyIcon="🌍" emptyTitle="No records" />}
            {tab === "first-timers" && <DataTable columns={ftCols} rows={firstTimers} keyField={(f) => f.id} emptyIcon="🙌" emptyTitle="No first-timers" />}
            {tab === "follow-ups" && <DataTable columns={fuCols} rows={followUps} keyField={(f) => f.id} emptyIcon="📞" emptyTitle="No follow-ups" />}
          </Card>
        </>
      )}
    </Page>
  );
}
