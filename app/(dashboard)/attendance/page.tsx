"use client";
import { useCallback, useMemo, useState } from "react";
import { Page } from "@/components/ui/Page";
import { Card, CardHeader } from "@/components/ui/Card";
import StatCard from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { LoadingBlock, ErrorBlock, EmptyState } from "@/components/ui/States";
import { BarSeries, ProgressBar } from "@/components/charts/Charts";
import { api } from "@/lib/api";
import { useApi } from "@/hooks/useApi";
import { useScope } from "@/hooks/useScope";
import { dateShort } from "@/lib/format";
import { attendanceTrend, presentCount, attendedRate } from "@/lib/analytics";
import type { AttendanceEvent } from "@/types/api";

export default function AttendancePage() {
  const { unitId } = useScope();
  const { data, loading, error, refetch } = useApi(
    useCallback(() => (unitId ? api.unitSessions(unitId) : Promise.reject(new Error("No unit"))), [unitId]),
    [unitId]
  );
  const [selected, setSelected] = useState<AttendanceEvent | null>(null);

  const sessions = useMemo(
    () => (data ?? []).slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [data]
  );
  const trend = useMemo(() => attendanceTrend(sessions), [sessions]);

  const totalPresent = sessions.reduce((s, e) => s + presentCount(e), 0);
  const totalMarked = sessions.reduce((s, e) => s + (e.attendees?.length ?? 0), 0);
  const overallRate = totalMarked ? Math.round((totalPresent / totalMarked) * 100) : 0;
  const openCount = sessions.filter((s) => s.status === "OPEN").length;

  const columns: Column<AttendanceEvent>[] = [
    {
      key: "title",
      header: "Session",
      render: (e) => (
        <div>
          <p className="font-medium text-slate-800">{e.title}</p>
          <p className="text-xs text-slate-400">{e.category?.name ?? e.createdByUnit?.name ?? "—"}</p>
        </div>
      ),
    },
    { key: "date", header: "Date", render: (e) => <span className="text-slate-500">{dateShort(e.date)}</span> },
    {
      key: "present",
      header: "Present",
      align: "center",
      render: (e) => (
        <span className="font-semibold text-slate-800">
          {presentCount(e)}
          <span className="text-slate-400 font-normal"> / {e.attendees?.length ?? 0}</span>
        </span>
      ),
    },
    {
      key: "rate",
      header: "Rate",
      width: "140px",
      render: (e) => (
        <div className="flex items-center gap-2">
          <div className="flex-1"><ProgressBar value={attendedRate(e)} color="#7c3aed" /></div>
          <span className="text-xs text-slate-500 w-9 text-right">{attendedRate(e)}%</span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      render: (e) => <Badge tone={e.status === "OPEN" ? "green" : "slate"}>{e.status === "OPEN" ? "Open" : "Closed"}</Badge>,
    },
  ];

  return (
    <Page title="Attendance" subtitle="Session-by-session attendance across your units">
      {loading ? (
        <Card><LoadingBlock /></Card>
      ) : error ? (
        <Card><ErrorBlock message={error} onRetry={refetch} /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
            <StatCard label="Sessions" value={sessions.length} icon="📋" color="#121D55" />
            <StatCard label="Overall rate" value={`${overallRate}%`} icon="✅" color="#7c3aed" />
            <StatCard label="Total present" value={totalPresent} icon="🙋" color="#059669" />
            <StatCard label="Open sessions" value={openCount} icon="🔓" color="#d97706" />
          </div>

          <Card className="mb-5">
            <CardHeader title="Attendance rate trend" subtitle="Present share by month" />
            {trend.some((d) => d.rate > 0) ? (
              <BarSeries data={trend} xKey="month" yKey="rate" color="#7c3aed" format={(v) => `${v}%`} />
            ) : (
              <EmptyState icon="🪑" title="No attendance data yet" />
            )}
          </Card>

          <Card>
            <CardHeader title="Sessions" subtitle={`${sessions.length} total`} />
            <DataTable columns={columns} rows={sessions} keyField={(e) => e.id} onRowClick={setSelected} emptyIcon="📋" emptyTitle="No sessions" />
          </Card>
        </>
      )}

      {selected && (
        <Modal open onClose={() => setSelected(null)} title={selected.title} width={480}>
          <div className="flex items-center gap-2 mb-4 text-sm text-slate-500">
            <Badge tone={selected.status === "OPEN" ? "green" : "slate"}>{selected.status}</Badge>
            <span>{dateShort(selected.date)}</span>
            <span>· {presentCount(selected)}/{selected.attendees?.length ?? 0} present ({attendedRate(selected)}%)</span>
          </div>
          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {(selected.attendees ?? []).map((a, i) => (
              <div key={a.user.id + i} className="flex items-center gap-3 py-2">
                <Avatar name={`${a.user.firstName} ${a.user.lastName}`} src={a.user.profilePic} size={32} />
                <span className="flex-1 text-sm text-slate-700">{a.user.firstName} {a.user.lastName}</span>
                <Badge tone={a.status === "Attended" ? "green" : a.status === "Excused" ? "amber" : "red"}>{a.status}</Badge>
              </div>
            ))}
            {(selected.attendees ?? []).length === 0 && <p className="text-sm text-slate-400 py-4 text-center">No attendees recorded</p>}
          </div>
        </Modal>
      )}
    </Page>
  );
}
