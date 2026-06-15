"use client";
import { useEffect, useState } from "react";
import Header from "@/components/layout/Header";
import PageHeader from "@/components/ui/PageHeader";
import { FullPageLoader } from "@/components/ui/LoadingSpinner";
import { apiFetch, apiPatch } from "@/lib/api";
import { Report } from "@/types/api";
import { formatDate } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

export default function ReportsPage() {
  const { user } = useAuthStore();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "REVIEWED">("ALL");
  const [reviewing, setReviewing] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.unitId) return;
    apiFetch<Report[]>(`/reports/incoming/${user.unitId}?includeDescendants=true`)
      .then(setReports)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.unitId]);

  const filtered = reports.filter((r) => filter === "ALL" || r.status === filter);

  const markReviewed = async (id: string) => {
    setReviewing(id);
    try {
      await apiPatch(`/reports/${id}/review`, {});
      setReports((prev) => prev.map((r) => r.id === id ? { ...r, status: "REVIEWED" as const } : r));
    } catch {}
    setReviewing(null);
  };

  const pending = reports.filter((r) => r.status === "PENDING").length;

  return (
    <div className="flex flex-col flex-1">
      <Header title="Reports" subtitle="Incoming unit reports" />
      <div className="flex-1 p-6 overflow-y-auto">
        <PageHeader
          title="Reports"
          subtitle={pending > 0 ? `${pending} pending review` : "All caught up"}
        />

        {/* Filter tabs */}
        <div className="flex gap-2 mb-5">
          {(["ALL", "PENDING", "REVIEWED"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                filter === f
                  ? "bg-primary text-white"
                  : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
              }`}
              style={filter === f ? { background: "#121D55" } : {}}
            >
              {f === "ALL" ? "All" : f === "PENDING" ? `Pending (${pending})` : "Reviewed"}
            </button>
          ))}
        </div>

        {loading ? <FullPageLoader /> : (
          <div className="space-y-3">
            {filtered.map((report) => (
              <div key={report.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`w-2 h-2 rounded-full ${report.status === "PENDING" ? "bg-amber-400" : "bg-emerald-400"}`} />
                      <span className="text-xs font-medium text-slate-400">{report.status}</span>
                      {report.unitName && (
                        <>
                          <span className="text-slate-200">·</span>
                          <span className="text-xs text-slate-400">{report.unitName}</span>
                        </>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-slate-800 mb-1">{report.title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed line-clamp-2">{report.content}</p>
                    <p className="text-xs text-slate-300 mt-2">
                      By {report.authorName ?? "Unknown"} · {formatDate(report.createdAt)}
                    </p>
                  </div>
                  {report.status === "PENDING" && (
                    <button
                      onClick={() => markReviewed(report.id)}
                      disabled={reviewing === report.id}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-white transition-opacity disabled:opacity-60 flex-shrink-0"
                      style={{ background: "#121D55" }}
                    >
                      {reviewing === report.id ? "Saving…" : "Mark Reviewed"}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="py-16 text-center text-slate-300 text-sm">
                {filter === "PENDING" ? "No pending reports" : "No reports found"}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
