"use client";
import { useCallback, useState } from "react";
import { Page } from "@/components/ui/Page";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { LoadingBlock, ErrorBlock, EmptyState } from "@/components/ui/States";
import { api } from "@/lib/api";
import { useApi } from "@/hooks/useApi";
import { dateShort } from "@/lib/format";
import type { AnnouncementType } from "@/types/api";

const TYPE_TONE: Record<string, "slate" | "blue" | "amber"> = { general: "slate", event: "blue", goal: "amber" };

export default function AnnouncementsPage() {
  const { data, loading, error, refetch } = useApi(useCallback(() => api.announcements(), []), []);
  const [creating, setCreating] = useState(false);

  return (
    <Page
      title="Announcements"
      subtitle={`${data?.length ?? 0} published`}
      action={
        <button onClick={() => setCreating(true)} className="px-4 py-2 rounded-xl bg-[#121D55] text-white text-sm font-medium hover:bg-[#1e2f7a]">
          + New announcement
        </button>
      }
    >
      {loading ? (
        <Card><LoadingBlock /></Card>
      ) : error ? (
        <Card><ErrorBlock message={error} onRetry={refetch} /></Card>
      ) : (data?.length ?? 0) === 0 ? (
        <Card><EmptyState icon="📢" title="No announcements yet" hint="Post one to reach your congregation." /></Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {data!.map((a) => (
            <Card key={a.id}>
              {a.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.imageUrl} alt="" className="w-full h-36 object-cover rounded-xl mb-3" />
              )}
              <div className="flex items-center justify-between mb-2">
                <Badge tone={TYPE_TONE[a.type ?? "general"]}>{a.type ?? "general"}</Badge>
                <button
                  onClick={async () => {
                    if (confirm("Delete this announcement?")) {
                      await api.deleteAnnouncement(a.id);
                      refetch();
                    }
                  }}
                  className="text-slate-300 hover:text-red-500 text-sm"
                >
                  🗑️
                </button>
              </div>
              <p className="font-semibold text-slate-800 mb-1">{a.title}</p>
              <p className="text-sm text-slate-500 line-clamp-3">{a.content}</p>
              <p className="text-xs text-slate-400 mt-3">
                {a.createdByUnit?.name ?? "Church"} · {dateShort(a.createdAt)}
              </p>
            </Card>
          ))}
        </div>
      )}

      {creating && <CreateModal onClose={() => setCreating(false)} onDone={() => { setCreating(false); refetch(); }} />}
    </Page>
  );
}

function CreateModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState<AnnouncementType>("general");
  const [imageUrl, setImageUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!title.trim() || !content.trim()) {
      setErr("Title and content are required.");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      await api.createAnnouncement({ title: title.trim(), content: content.trim(), type, imageUrl: imageUrl.trim() || undefined, isGeneral: true });
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to publish");
    } finally {
      setSaving(false);
    }
  };

  const field = "w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-[#121D55] focus:ring-2 focus:ring-[#121D55]/10";

  return (
    <Modal open onClose={onClose} title="New announcement">
      <div className="space-y-4">
        <input className={field} placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className={field} rows={5} placeholder="Write your message…" value={content} onChange={(e) => setContent(e.target.value)} />
        <div className="flex gap-3">
          <select className={field} value={type} onChange={(e) => setType(e.target.value as AnnouncementType)}>
            <option value="general">General</option>
            <option value="event">Event</option>
            <option value="goal">Goal</option>
          </select>
          <input className={field} placeholder="Image URL (optional)" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button onClick={submit} disabled={saving} className="w-full py-2.5 rounded-xl bg-[#121D55] text-white text-sm font-medium hover:bg-[#1e2f7a] disabled:opacity-60">
          {saving ? "Publishing…" : "Publish announcement"}
        </button>
      </div>
    </Modal>
  );
}
