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
import type { OrgNode, UnitPerson } from "@/types/api";

const UNIT_ICON: Record<string, string> = {
  CHURCH: "⛪", ZONE: "🗺️", BRANCH: "🏛️", MC: "💎", BC: "🔷", CELL: "👥", SHEPHERD: "🧑‍🌾", ADMIN: "🛡️",
};

function flatten(node: OrgNode | null): OrgNode[] {
  if (!node) return [];
  return [node, ...(node.children ?? []).flatMap(flatten)];
}

function leaderOf(node: OrgNode): string | null {
  const l = node.leaderships?.[0];
  return l?.user ? `${l.user.firstName} ${l.user.lastName}` : null;
}

function NodeCard({
  node,
  collapsed,
  onToggle,
  onSelect,
}: {
  node: OrgNode;
  collapsed: boolean;
  onToggle: () => void;
  onSelect: () => void;
}) {
  const leader = leaderOf(node);
  const childCount = node.children?.length ?? 0;
  return (
    <div className="inline-flex flex-col items-center">
      <button
        onClick={onSelect}
        className="w-52 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-[#121D55]/40 transition-all px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-base">{UNIT_ICON[node.type] ?? "🏢"}</span>
          <span className="font-semibold text-sm text-slate-800 truncate flex-1">{node.name}</span>
        </div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <Badge tone={UNIT_TONE[node.type] ?? "slate"}>{node.type}</Badge>
          {childCount > 0 && <span className="text-[11px] text-slate-400">{childCount} sub-unit{childCount !== 1 ? "s" : ""}</span>}
        </div>
        <div className="flex items-center gap-2">
          {leader ? (
            <>
              <Avatar name={leader} src={node.leaderships?.[0]?.user?.profilePic} size={22} />
              <span className="text-xs text-slate-500 truncate">{leader}</span>
            </>
          ) : (
            <span className="text-xs text-slate-300 italic">No leader assigned</span>
          )}
        </div>
      </button>
      {childCount > 0 && (
        <button
          onClick={onToggle}
          className="mt-1.5 w-6 h-6 rounded-full bg-white border border-slate-300 text-slate-500 text-xs flex items-center justify-center hover:bg-slate-50 z-10"
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? "+" : "−"}
        </button>
      )}
    </div>
  );
}

function TreeNode({
  node,
  collapsedSet,
  toggle,
  onSelect,
}: {
  node: OrgNode;
  collapsedSet: Set<string>;
  toggle: (id: string) => void;
  onSelect: (n: OrgNode) => void;
}) {
  const collapsed = collapsedSet.has(node.id);
  const kids = node.children ?? [];
  return (
    <li>
      <NodeCard node={node} collapsed={collapsed} onToggle={() => toggle(node.id)} onSelect={() => onSelect(node)} />
      {kids.length > 0 && !collapsed && (
        <ul>
          {kids.map((c) => (
            <TreeNode key={c.id} node={c} collapsedSet={collapsedSet} toggle={toggle} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function OrganogramPage() {
  const { data: tree, loading, error, refetch } = useApi(useCallback(() => api.fullTree(), []), []);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<OrgNode | null>(null);

  const nodes = useMemo(() => flatten(tree), [tree]);
  const typeCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const n of nodes) c[n.type] = (c[n.type] ?? 0) + 1;
    return c;
  }, [nodes]);

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const collapseAll = () => setCollapsed(new Set(nodes.filter((n) => (n.children?.length ?? 0) > 0).map((n) => n.id)));
  const expandAll = () => setCollapsed(new Set());

  return (
    <Page
      title="Organogram"
      subtitle="Interactive map of the church leadership structure"
      action={
        <div className="flex gap-2">
          <button onClick={expandAll} className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Expand all
          </button>
          <button onClick={collapseAll} className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Collapse all
          </button>
        </div>
      }
    >
      {loading ? (
        <Card><LoadingBlock label="Building the tree…" /></Card>
      ) : error ? (
        <Card><ErrorBlock message={error} onRetry={refetch} /></Card>
      ) : !tree ? (
        <Card><EmptyState icon="🗂️" title="No hierarchy found" /></Card>
      ) : (
        <>
          {/* Type summary */}
          <div className="flex flex-wrap gap-3 mb-5">
            {Object.entries(typeCounts).map(([type, count]) => (
              <div key={type} className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
                <span>{UNIT_ICON[type] ?? "🏢"}</span>
                <span className="text-sm font-semibold text-slate-800">{count}</span>
                <span className="text-xs text-slate-400">{type}</span>
              </div>
            ))}
          </div>

          {/* Chart */}
          <Card padded={false} className="p-6 overflow-x-auto">
            <div className="org-tree min-w-fit">
              <ul>
                <TreeNode node={tree} collapsedSet={collapsed} toggle={toggle} onSelect={setSelected} />
              </ul>
            </div>
          </Card>
        </>
      )}

      {selected && <UnitDetail node={selected} onClose={() => setSelected(null)} />}
    </Page>
  );
}

function UnitDetail({ node, onClose }: { node: OrgNode; onClose: () => void }) {
  const { data, loading } = useApi(useCallback(() => api.unitMembersLeaders(node.id), [node.id]), [node.id]);
  const leaders = data?.leaders ?? [];
  const members = data?.members ?? [];

  const Person = ({ p }: { p: UnitPerson }) => (
    <div className="flex items-center gap-3 py-2">
      <Avatar name={p.name} src={p.profilePic} size={34} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
        {p.email && <p className="text-xs text-slate-400 truncate">{p.email}</p>}
      </div>
      {p.role && <Badge tone="navy">{ROLE_LABELS[p.role as keyof typeof ROLE_LABELS] ?? p.role}</Badge>}
    </div>
  );

  return (
    <Modal open onClose={onClose} title={node.name} width={480}>
      <div className="flex items-center gap-2 mb-4">
        <Badge tone={UNIT_TONE[node.type] ?? "slate"}>{node.type}</Badge>
        <span className="text-xs text-slate-400">{node.children?.length ?? 0} sub-units</span>
      </div>
      {loading ? (
        <LoadingBlock />
      ) : (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
            Leaders ({leaders.length})
          </p>
          {leaders.length ? (
            <div className="divide-y divide-slate-100 mb-4">{leaders.map((p) => <Person key={p.id} p={p} />)}</div>
          ) : (
            <p className="text-sm text-slate-400 italic mb-4">No leaders assigned</p>
          )}
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
            Members ({members.length})
          </p>
          {members.length ? (
            <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">{members.map((p) => <Person key={p.id} p={p} />)}</div>
          ) : (
            <p className="text-sm text-slate-400 italic">No members</p>
          )}
        </>
      )}
    </Modal>
  );
}
