"use client";
import { useCallback, useMemo } from "react";
import { Page } from "@/components/ui/Page";
import { Card, CardHeader } from "@/components/ui/Card";
import StatCard from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { LoadingBlock, ErrorBlock, EmptyState } from "@/components/ui/States";
import { api } from "@/lib/api";
import { useApi } from "@/hooks/useApi";
import { useScope } from "@/hooks/useScope";
import { dateLong } from "@/lib/format";
import { presentCount } from "@/lib/analytics";
import type { AttendanceEvent } from "@/types/api";

function EventRow({ e }: { e: AttendanceEvent }) {
  const d = new Date(e.date);
  return (
    <div className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50">
      <div className="w-12 h-12 rounded-xl bg-[#121D55]/5 flex flex-col items-center justify-center flex-shrink-0">
        <span className="text-[10px] font-semibold text-[#121D55] uppercase">{d.toLocaleDateString("en", { month: "short" })}</span>
        <span className="text-lg font-bold text-[#121D55] leading-none">{d.getDate()}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-800 truncate">{e.title}</p>
        <p className="text-xs text-slate-400">
          {dateLong(e.date)} · {e.category?.name ?? e.createdByUnit?.name ?? "—"}
        </p>
      </div>
      {e.status === "OPEN" ? (
        <Badge tone="green">Open</Badge>
      ) : (
        <span className="text-xs text-slate-400">{presentCount(e)} attended</span>
      )}
    </div>
  );
}

export default function EventsPage() {
  const { unitId } = useScope();
  const { data, loading, error, refetch } = useApi(
    useCallback(() => (unitId ? api.unitSessions(unitId) : Promise.reject(new Error("No unit"))), [unitId]),
    [unitId]
  );

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const list = (data ?? []).slice().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return {
      upcoming: list.filter((e) => new Date(e.date).getTime() >= now),
      past: list.filter((e) => new Date(e.date).getTime() < now).reverse(),
    };
  }, [data]);

  return (
    <Page title="Events" subtitle="Services and gatherings across your units">
      {loading ? (
        <Card><LoadingBlock /></Card>
      ) : error ? (
        <Card><ErrorBlock message={error} onRetry={refetch} /></Card>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 mb-5">
            <StatCard label="Total events" value={data?.length ?? 0} icon="📅" color="#121D55" />
            <StatCard label="Upcoming" value={upcoming.length} icon="⏳" color="#059669" />
            <StatCard label="Completed" value={past.length} icon="✅" color="#7c3aed" />
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            <Card>
              <CardHeader title="Upcoming" subtitle={`${upcoming.length} scheduled`} />
              {upcoming.length === 0 ? (
                <EmptyState icon="📅" title="Nothing scheduled" />
              ) : (
                <div className="space-y-1">{upcoming.map((e) => <EventRow key={e.id} e={e} />)}</div>
              )}
            </Card>
            <Card>
              <CardHeader title="Past events" subtitle={`${past.length} completed`} />
              {past.length === 0 ? (
                <EmptyState icon="🕐" title="No past events" />
              ) : (
                <div className="space-y-1 max-h-[520px] overflow-y-auto">{past.map((e) => <EventRow key={e.id} e={e} />)}</div>
              )}
            </Card>
          </div>
        </>
      )}
    </Page>
  );
}
