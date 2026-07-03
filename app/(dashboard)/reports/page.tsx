"use client";
import { useCallback, useMemo, useState } from "react";
import { Page } from "@/components/ui/Page";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import { Modal } from "@/components/ui/Modal";
import { LoadingBlock, ErrorBlock, EmptyState } from "@/components/ui/States";
import { api } from "@/lib/api";
import { useApi } from "@/hooks/useApi";
import { useScope } from "@/hooks/useScope";
import { dateShort } from "@/lib/format";
import type { Report } from "@/types/api";

type Tab = "all" | "submitted" | "reviewed";

export default function ReportsPage() {
  const { unitId } = useScope();
  const { data, loading, error, refetch } = useApi(
    useCallback(() => (unitId ? api.incomingReports(unitId) : Promise.reject(new Error("No unit"))), [unitId]),
    [unitId]
  );
  const [tab, setTab] = useState<Tab>("all");
  const [selected, setSelected] = useState<Report | null>(null);
  const [reviewing, setReviewing] = useState(false);

  const reports = useMemo(() => data ?? [], [data]);
  const filtered = tab === "all" ? reports : reports.filter((r) => r.status === tab);
  const submitted = reports.filter((r) => r.status === "submitted").length;

  const review = async (r: Report) => {
    setReviewing(true);
    try {
      await api.reviewReport(r.id);
      setSelected(null);
      refetch();
    } finally {
      setReviewing(false);
    }
  };

  return (
    <Page title="Reports" subtitle={`${reports.length} incoming · ${submitted} awaiting review`}>
      <Card>
        <div className="mb-4">
          <Tabs
            active={tab}
            onChange={setTab}
            tabs={[
              { key: "all", label: "All", count: reports.length },
              { key: "submitted", label: "Awaiting", count: submitted },
              { key: "reviewed", label: "Reviewed", count: reports.length - submitted },
            ]}
          />
        </div>
        {loading ? (
          <LoadingBlock />
        ) : error ? (
          <ErrorBlock message={error} onRetry={refetch} />
        ) : filtered.length === 0 ? (
          <EmptyState icon="📋" title="No reports here" />
        ) : (
          <div className="space-y-3">
            {filtered.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelected(r)}
                className="w-full text-left flex items-start justify-between gap-4 p-4 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-800 truncate">{r.title}</p>
                  <p className="text-sm text-slate-500 line-clamp-1 mt-0.5">{r.content}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {r.unit?.name ?? "—"}
                    {r.author && ` · ${r.author.firstName} ${r.author.lastName}`}
                    {` · ${dateShort(r.submittedAt)}`}
                  </p>
                </div>
                <Badge tone={r.status === "reviewed" ? "green" : "amber"}>{r.status}</Badge>
              </button>
            ))}
          </div>
        )}
      </Card>

      {selected && (
        <Modal open onClose={() => setSelected(null)} title={selected.title} width={560}>
          <div className="flex items-center gap-2 mb-4 text-sm text-slate-500">
            <Badge tone={selected.status === "reviewed" ? "green" : "amber"}>{selected.status}</Badge>
            <span>{selected.unit?.name}</span>
            {selected.author && <span>· {selected.author.firstName} {selected.author.lastName}</span>}
            <span>· {dateShort(selected.submittedAt)}</span>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{selected.content}</p>
          {selected.status === "submitted" && (
            <button
              onClick={() => review(selected)}
              disabled={reviewing}
              className="mt-5 w-full py-2.5 rounded-xl bg-[#121D55] text-white text-sm font-medium hover:bg-[#1e2f7a] disabled:opacity-60"
            >
              {reviewing ? "Marking…" : "Mark as reviewed"}
            </button>
          )}
        </Modal>
      )}
    </Page>
  );
}
