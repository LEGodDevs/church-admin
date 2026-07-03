"use client";
import { useCallback, useMemo, useState } from "react";
import { Page } from "@/components/ui/Page";
import { Card } from "@/components/ui/Card";
import { Badge, UNIT_TONE } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Modal } from "@/components/ui/Modal";
import { LoadingBlock, ErrorBlock, EmptyState } from "@/components/ui/States";
import { api } from "@/lib/api";
import { useApi } from "@/hooks/useApi";
import { ROLE_LABELS } from "@/types/auth";
import type { Unit, UnitPerson, UnitType } from "@/types/api";

const UNIT_ICON: Record<string, string> = {
  CHURCH: "⛪", ZONE: "🗺️", BRANCH: "🏛️", MC: "💎", BC: "🔷", CELL: "👥", SHEPHERD: "🧑‍🌾", ADMIN: "🛡️",
};
const TYPES: (UnitType | "ALL")[] = ["ALL", "ZONE", "BRANCH", "MC", "BC", "CELL", "SHEPHERD"];

export default function UnitsPage() {
  const { data, loading, error, refetch } = useApi(useCallback(() => api.units(), []), []);
  const [filter, setFilter] = useState<UnitType | "ALL">("ALL");
  const [selected, setSelected] = useState<Unit | null>(null);

  const units = useMemo(() => {
    const list = data ?? [];
    return filter === "ALL" ? list : list.filter((u) => u.type === filter);
  }, [data, filter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const u of data ?? []) c[u.type] = (c[u.type] ?? 0) + 1;
    return c;
  }, [data]);

  return (
    <Page title="Units" subtitle={`${data?.length ?? 0} organizational units`}>
      {loading ? (
        <Card><LoadingBlock /></Card>
      ) : error ? (
        <Card><ErrorBlock message={error} onRetry={refetch} /></Card>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-5">
            {TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                  filter === t ? "bg-[#121D55] text-white border-[#121D55]" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {t === "ALL" ? "All" : t}
                {t !== "ALL" && counts[t] ? <span className="ml-1.5 opacity-60">{counts[t]}</span> : null}
              </button>
            ))}
          </div>

          {units.length === 0 ? (
            <Card><EmptyState icon="🏛️" title="No units" /></Card>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {units.map((u) => {
                const leader = u.leaderships?.[0]?.user;
                return (
                  <button
                    key={u.id}
                    onClick={() => setSelected(u)}
                    className="text-left bg-white rounded-2xl border border-slate-200/70 shadow-sm hover:shadow-md hover:border-[#121D55]/30 transition-all p-5"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-lg">
                        {UNIT_ICON[u.type] ?? "🏢"}
                      </div>
                      <Badge tone={UNIT_TONE[u.type] ?? "slate"}>{u.type}</Badge>
                    </div>
                    <p className="font-semibold text-slate-800 mb-0.5 truncate">{u.name}</p>
                    <p className="text-xs text-slate-400 mb-3">
                      {u.parent ? `Under ${u.parent.name}` : "Top level"}
                    </p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">{u.memberships?.length ?? 0} members</span>
                      {leader ? (
                        <span className="flex items-center gap-1.5 text-slate-500">
                          <Avatar name={`${leader.firstName} ${leader.lastName}`} src={leader.profilePic} size={20} />
                          <span className="truncate max-w-24">{leader.firstName}</span>
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300 italic">No leader</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {selected && <UnitDetail unit={selected} onClose={() => setSelected(null)} />}
    </Page>
  );
}

function UnitDetail({ unit, onClose }: { unit: Unit; onClose: () => void }) {
  const { data, loading } = useApi(useCallback(() => api.unitMembersLeaders(unit.id), [unit.id]), [unit.id]);
  const Person = ({ p }: { p: UnitPerson }) => (
    <div className="flex items-center gap-3 py-2">
      <Avatar name={p.name} src={p.profilePic} size={32} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
        {p.email && <p className="text-xs text-slate-400 truncate">{p.email}</p>}
      </div>
      {p.role && <Badge tone="navy">{ROLE_LABELS[p.role as keyof typeof ROLE_LABELS] ?? p.role}</Badge>}
    </div>
  );
  return (
    <Modal open onClose={onClose} title={unit.name} width={480}>
      <div className="flex items-center gap-2 mb-4">
        <Badge tone={UNIT_TONE[unit.type] ?? "slate"}>{unit.type}</Badge>
        {unit.parent && <span className="text-xs text-slate-400">under {unit.parent.name}</span>}
      </div>
      {loading ? (
        <LoadingBlock />
      ) : (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Leaders ({data?.leaders.length ?? 0})</p>
          {data?.leaders.length ? (
            <div className="divide-y divide-slate-100 mb-4">{data.leaders.map((p) => <Person key={p.id} p={p} />)}</div>
          ) : (
            <p className="text-sm text-slate-400 italic mb-4">No leaders</p>
          )}
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Members ({data?.members.length ?? 0})</p>
          {data?.members.length ? (
            <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">{data.members.map((p) => <Person key={p.id} p={p} />)}</div>
          ) : (
            <p className="text-sm text-slate-400 italic">No members</p>
          )}
        </>
      )}
    </Modal>
  );
}
