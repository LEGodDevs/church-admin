"use client";
import { useCallback, useMemo, useState } from "react";
import { Page } from "@/components/ui/Page";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, ROLE_TONE } from "@/components/ui/Badge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { LoadingBlock, ErrorBlock } from "@/components/ui/States";
import { api } from "@/lib/api";
import { useApi } from "@/hooks/useApi";
import { ROLE_LABELS } from "@/types/auth";
import { dateShort } from "@/lib/format";
import type { Member } from "@/types/api";

function roleOf(m: Member): string | null {
  return m.leaderships?.[0]?.role ?? null;
}

export default function MembersPage() {
  const { data, loading, error, refetch } = useApi(useCallback(() => api.users(), []), []);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Member | null>(null);

  const rows = useMemo(() => {
    const list = data ?? [];
    const query = q.trim().toLowerCase();
    if (!query) return list;
    return list.filter(
      (m) =>
        `${m.firstName} ${m.lastName}`.toLowerCase().includes(query) ||
        (m.email ?? "").toLowerCase().includes(query) ||
        (m.phoneNumber ?? "").includes(query)
    );
  }, [data, q]);

  const leaders = (data ?? []).filter((m) => roleOf(m)).length;

  const columns: Column<Member>[] = [
    {
      key: "name",
      header: "Member",
      render: (m) => (
        <div className="flex items-center gap-3">
          <Avatar name={`${m.firstName} ${m.lastName}`} src={m.profilePic} size={34} />
          <div>
            <p className="font-medium text-slate-800">{m.firstName} {m.lastName}</p>
            <p className="text-xs text-slate-400">{m.email ?? "—"}</p>
          </div>
        </div>
      ),
    },
    { key: "phone", header: "Phone", render: (m) => <span className="text-slate-500">{m.phoneNumber ?? "—"}</span> },
    {
      key: "role",
      header: "Role",
      render: (m) => {
        const r = roleOf(m);
        return r ? (
          <Badge tone={ROLE_TONE[r] ?? "slate"}>{ROLE_LABELS[r as keyof typeof ROLE_LABELS] ?? r}</Badge>
        ) : (
          <Badge tone="slate">Member</Badge>
        );
      },
    },
    { key: "occupation", header: "Occupation", render: (m) => <span className="text-slate-500">{m.occupation ?? "—"}</span> },
  ];

  return (
    <Page title="Members" subtitle={`${data?.length ?? 0} people · ${leaders} leaders`}>
      <Card>
        <div className="mb-4">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, email or phone…"
            className="w-full max-w-md px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-[#121D55] focus:ring-2 focus:ring-[#121D55]/10"
          />
        </div>
        {loading ? (
          <LoadingBlock />
        ) : error ? (
          <ErrorBlock message={error} onRetry={refetch} />
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            keyField={(m) => m.id}
            onRowClick={setSelected}
            emptyIcon="👥"
            emptyTitle="No members found"
          />
        )}
      </Card>

      {selected && (
        <Modal open onClose={() => setSelected(null)} title="Member details">
          <div className="flex items-center gap-4 mb-5">
            <Avatar name={`${selected.firstName} ${selected.lastName}`} src={selected.profilePic} size={56} />
            <div>
              <p className="text-lg font-semibold text-slate-800">{selected.firstName} {selected.lastName}</p>
              {roleOf(selected) && (
                <Badge tone={ROLE_TONE[roleOf(selected)!] ?? "slate"}>
                  {ROLE_LABELS[roleOf(selected) as keyof typeof ROLE_LABELS] ?? roleOf(selected)}
                </Badge>
              )}
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            {([
              ["Email", selected.email],
              ["Phone", selected.phoneNumber],
              ["Occupation", selected.occupation],
              ["Marital status", selected.maritalStatus],
              ["Date of birth", selected.dob ? dateShort(selected.dob) : null],
              ["Units", selected.memberships?.map((m) => m.unit?.name).filter(Boolean).join(", ") || null],
            ] as [string, string | null | undefined][]).map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-slate-400">{label}</dt>
                <dd className="text-slate-700 font-medium">{value || "—"}</dd>
              </div>
            ))}
          </dl>
        </Modal>
      )}
    </Page>
  );
}
