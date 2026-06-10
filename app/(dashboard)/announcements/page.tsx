"use client";
import { useEffect, useState } from "react";
import Header from "@/components/layout/Header";
import PageHeader from "@/components/ui/PageHeader";
import { FullPageLoader } from "@/components/ui/LoadingSpinner";
import { apiFetch, apiPost, apiDelete } from "@/lib/api";
import { Announcement } from "@/types/api";
import { useAuthStore } from "@/stores/auth-store";
import { formatDate } from "@/lib/utils";

export default function AnnouncementsPage() {
  const { user } = useAuthStore();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Announcement[]>("/announcements")
      .then(setAnnouncements)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setSubmitting(true);
    try {
      const newAnn = await apiPost<Announcement>("/announcements", {
        title: title.trim(),
        content: content.trim(),
        targetRoles: ["MEMBER", "SHEPHERD", "CELL_LEADER", "MC_HEAD", "BC_HEAD", "BRANCH_HEAD", "ZONE_LEADER", "BISHOP", "ADMIN"],
      });
      setAnnouncements((prev) => [newAnn, ...prev]);
      setTitle("");
      setContent("");
      setShowForm(false);
    } catch {}
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this announcement?")) return;
    setDeleting(id);
    try {
      await apiDelete(`/announcements/${id}`);
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    } catch {}
    setDeleting(null);
  };

  return (
    <div className="flex flex-col flex-1">
      <Header title="Announcements" subtitle="Publish updates to your congregation" />
      <div className="flex-1 p-6 overflow-y-auto">
        <PageHeader
          title="Announcements"
          subtitle={`${announcements.length} total`}
          action={
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold"
              style={{ background: "#121D55" }}
            >
              {showForm ? "Cancel" : "+ New Announcement"}
            </button>
          }
        />

        {/* Create form */}
        {showForm && (
          <form onSubmit={handleCreate} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 mb-5">
            <p className="font-semibold text-slate-700 mb-4">New Announcement</p>
            <div className="space-y-3">
              <input
                type="text"
                required
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-700 outline-none focus:border-blue-400"
              />
              <textarea
                required
                rows={4}
                placeholder="Write your announcement…"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-700 outline-none focus:border-blue-400 resize-none"
              />
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-60"
                style={{ background: "#121D55" }}
              >
                {submitting ? "Publishing…" : "Publish Announcement"}
              </button>
            </div>
          </form>
        )}

        {loading ? <FullPageLoader /> : (
          <div className="space-y-3">
            {announcements.map((a) => (
              <div key={a.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-lg flex-shrink-0">📢</div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-slate-800 mb-1">{a.title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">{a.content}</p>
                    <p className="text-xs text-slate-300 mt-2">
                      {a.authorName ?? "You"} · {formatDate(a.createdAt)}
                    </p>
                  </div>
                  {(user?.id === a.authorId || ["BISHOP", "ADMIN"].includes(user?.role ?? "")) && (
                    <button
                      onClick={() => handleDelete(a.id)}
                      disabled={deleting === a.id}
                      className="text-slate-300 hover:text-red-400 transition-colors text-sm flex-shrink-0 disabled:opacity-40"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            ))}
            {announcements.length === 0 && (
              <div className="py-16 text-center text-slate-300 text-sm">No announcements yet. Create the first one!</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
