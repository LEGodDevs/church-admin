"use client";
import { useCallback, useMemo } from "react";
import { Page } from "@/components/ui/Page";
import { Card, CardHeader } from "@/components/ui/Card";
import StatCard from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/charts/Charts";
import { LoadingBlock, ErrorBlock, EmptyState } from "@/components/ui/States";
import { api } from "@/lib/api";
import { useApi } from "@/hooks/useApi";
import { dateShort } from "@/lib/format";
import type { Goal } from "@/types/api";

export default function GoalsPage() {
  const load = useCallback(async () => {
    const settle = <T,>(p: Promise<T>, fb: T) => p.catch(() => fb);
    const [assigned, received] = await Promise.all([
      settle(api.goalsAssignedByMe(), [] as Goal[]),
      settle(api.goalsAssignedToMe(), [] as Goal[]),
    ]);
    // merge unique by id
    const map = new Map<string, Goal>();
    [...assigned, ...received].forEach((g) => map.set(g.id, g));
    return [...map.values()];
  }, []);

  const { data, loading, error, refetch } = useApi(load, []);
  const goals = useMemo(() => data ?? [], [data]);

  const completed = goals.filter((g) => g.completed || (g.progress ?? 0) >= 100).length;
  const avgProgress = goals.length ? Math.round(goals.reduce((s, g) => s + (g.progress ?? 0), 0) / goals.length) : 0;

  return (
    <Page title="Goals" subtitle="Goals you have assigned and received">
      {loading ? (
        <Card><LoadingBlock /></Card>
      ) : error ? (
        <Card><ErrorBlock message={error} onRetry={refetch} /></Card>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 mb-5">
            <StatCard label="Total goals" value={goals.length} icon="🎯" color="#121D55" />
            <StatCard label="Completed" value={completed} icon="✅" color="#059669" />
            <StatCard label="Avg. progress" value={`${avgProgress}%`} icon="📈" color="#7c3aed" />
          </div>

          <Card>
            <CardHeader title="All goals" subtitle={`${goals.length} tracked`} />
            {goals.length === 0 ? (
              <EmptyState icon="🎯" title="No goals yet" hint="Goals assigned from the mobile app appear here." />
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {goals.map((g) => {
                  const prog = g.completed ? 100 : g.progress ?? 0;
                  const color = g.color || "#121D55";
                  return (
                    <div key={g.id} className="border border-slate-100 rounded-xl p-4">
                      <div className="flex items-start justify-between mb-2">
                        <p className="font-medium text-slate-800">{g.title}</p>
                        {g.category && <Badge tone="slate">{g.category}</Badge>}
                      </div>
                      {g.description && <p className="text-sm text-slate-500 line-clamp-2 mb-3">{g.description}</p>}
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex-1"><ProgressBar value={prog} color={color} /></div>
                        <span className="text-xs font-semibold text-slate-600 w-9 text-right">{prog}%</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-400 mt-2">
                        <span>
                          {g.assignee ? `To ${g.assignee.firstName} ${g.assignee.lastName}` : g.assigner ? `From ${g.assigner.firstName}` : ""}
                        </span>
                        {g.dueDate && <span>Due {dateShort(g.dueDate)}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </>
      )}
    </Page>
  );
}
