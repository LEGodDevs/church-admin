"use client";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Header from "@/components/layout/Header";
import { apiFetch, apiPost, apiPatch, apiDelete } from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────────

type UnitType = "CHURCH" | "ZONE" | "BRANCH" | "MC" | "BC" | "CELL" | "SHEPHERD";

const CHILD_TYPE: Partial<Record<UnitType, UnitType>> = {
  CHURCH: "ZONE", ZONE: "BRANCH", BRANCH: "MC", MC: "BC", BC: "CELL", CELL: "SHEPHERD",
};

const TYPE_COLOR: Record<UnitType, string> = {
  CHURCH: "#EF4444", ZONE: "#06B6D4", BRANCH: "#EC4899",
  MC: "#F59E0B", BC: "#8B5CF6", CELL: "#3B82F6", SHEPHERD: "#10B981",
};

const TYPE_LABEL: Record<UnitType, string> = {
  CHURCH: "Church", ZONE: "Zone", BRANCH: "Branch",
  MC: "Mini-Center", BC: "Business Center", CELL: "Cell", SHEPHERD: "Shepherd",
};

const ALL_TYPES: UnitType[] = ["CHURCH", "ZONE", "BRANCH", "MC", "BC", "CELL", "SHEPHERD"];

interface RawUnit {
  id: string;
  name: string;
  type: UnitType;
  parentId?: string | null;
  ancestors: string[];
  memberships: { id: string }[];
  leaderships: { id: string; role: string; userId: string }[];
}

interface OrgUnit extends RawUnit {
  children: OrgUnit[];
}

interface DetailedUnit extends Omit<RawUnit, "leaderships"> {
  parent: { id: string; name: string; type: UnitType } | null;
  leaderships: { id: string; role: string; user: { id: string; firstName: string; lastName: string; email: string } }[];
}

// ── Tree helpers ───────────────────────────────────────────────────────────────

function buildTree(flat: RawUnit[]): OrgUnit[] {
  const map = new Map<string, OrgUnit>();
  flat.forEach(u => map.set(u.id, { ...u, children: [] }));
  const roots: OrgUnit[] = [];
  map.forEach(unit => {
    if (unit.parentId && map.has(unit.parentId)) {
      map.get(unit.parentId)!.children.push(unit);
    } else {
      roots.push(unit);
    }
  });
  const sort = (units: OrgUnit[]): OrgUnit[] =>
    units.sort((a, b) => a.name.localeCompare(b.name)).map(u => ({ ...u, children: sort(u.children) }));
  return sort(roots);
}

function flattenTree(unit: OrgUnit): OrgUnit[] {
  return [unit, ...unit.children.flatMap(flattenTree)];
}

function findInTree(units: OrgUnit[], id: string): OrgUnit | null {
  for (const u of units) {
    if (u.id === id) return u;
    const found = findInTree(u.children, id);
    if (found) return found;
  }
  return null;
}

// ── Shared atoms ───────────────────────────────────────────────────────────────

function TypePicker({ value, onChange }: { value: UnitType; onChange: (t: UnitType) => void }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {ALL_TYPES.map(t => (
        <button key={t} type="button" onClick={() => onChange(t)}
          className={`py-2 rounded-xl text-xs font-semibold border transition-all ${value === t ? "text-white border-transparent" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"}`}
          style={value === t ? { background: TYPE_COLOR[t] } : {}}>
          {t === "SHEPHERD" ? "SHPD" : t}
        </button>
      ))}
    </div>
  );
}

function Modal({ title, wide, onClose, children }: { title: string; wide?: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[90vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl">
          <h3 className="text-base font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors">✕</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ── Org Chart Node Card ────────────────────────────────────────────────────────

function OrgCard({
  unit, selected, dimmed, onClick,
}: {
  unit: OrgUnit; selected: boolean; dimmed: boolean; onClick: () => void;
}) {
  const color = TYPE_COLOR[unit.type] ?? "#94a3b8";
  const leader = unit.leaderships[0];

  return (
    <div
      onClick={onClick}
      className={`relative rounded-2xl cursor-pointer transition-all duration-200 select-none overflow-hidden ${
        dimmed ? "opacity-30" : ""
      } ${selected ? "scale-105" : "shadow-md hover:shadow-xl bg-white border border-slate-100"}`}
      style={selected ? {
        width: 156,
        background: color,
        boxShadow: `0 10px 24px -4px ${color}66, 0 0 0 3px white, 0 0 0 5px ${color}`,
      } : { width: 156 }}
    >
      {/* Colored top band */}
      <div className="h-1.5 w-full" style={{ background: color }} />

      <div className="px-3 py-2.5">
        {/* Type label */}
        <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${selected ? "text-white/70" : "text-slate-400"}`} style={selected ? {} : { color }}>
          {TYPE_LABEL[unit.type] ?? unit.type}
        </p>

        {/* Unit name */}
        <p className={`text-sm font-bold leading-tight break-words ${selected ? "text-white" : "text-slate-800"}`}
          style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {unit.name}
        </p>

        {/* Leader */}
        {leader && (
          <p className={`text-[11px] mt-1.5 truncate ${selected ? "text-white/70" : "text-slate-400"}`}>
            👤 {leader.role}
          </p>
        )}

        {/* Counts */}
        <div className={`flex items-center gap-2 mt-1.5 text-[10px] ${selected ? "text-white/60" : "text-slate-400"}`}>
          {unit.memberships.length > 0 && <span>👥 {unit.memberships.length}</span>}
          {unit.children.length > 0 && <span>🏢 {unit.children.length}</span>}
        </div>
      </div>
    </div>
  );
}

// ── Org Tree (recursive) ───────────────────────────────────────────────────────

function OrgTree({
  unit, selectedId, expandedIds, onSelect, onToggle, searchQuery,
}: {
  unit: OrgUnit; selectedId: string | null; expandedIds: Set<string>;
  onSelect: (u: OrgUnit) => void; onToggle: (id: string) => void; searchQuery: string;
}) {
  const isExpanded = expandedIds.has(unit.id);

  const matchesSelf = !searchQuery || unit.name.toLowerCase().includes(searchQuery.toLowerCase());
  const hasMatch = searchQuery ? flattenTree(unit).some(u => u.name.toLowerCase().includes(searchQuery.toLowerCase())) : true;
  if (!hasMatch) return null;

  const dimmed = !!searchQuery && !matchesSelf;

  const visibleChildren = isExpanded
    ? unit.children.filter(c => !searchQuery || flattenTree(c).some(u => u.name.toLowerCase().includes(searchQuery.toLowerCase())))
    : [];

  return (
    <div className="flex flex-col items-center" style={{ minWidth: 156 }}>
      {/* Card */}
      <div className="relative">
        <OrgCard
          unit={unit}
          selected={selectedId === unit.id}
          dimmed={dimmed}
          onClick={() => onSelect(unit)}
        />
        {/* Expand/collapse toggle */}
        {unit.children.length > 0 && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onToggle(unit.id); }}
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-[10px] text-slate-500 hover:bg-slate-50 hover:border-slate-300 z-10 transition-all"
          >
            {isExpanded ? "▲" : "▼"}
          </button>
        )}
      </div>

      {/* Children branch */}
      {visibleChildren.length > 0 && (
        <div className="flex flex-col items-center">
          {/* Vertical stem from card to horizontal bar */}
          <div className="w-px bg-slate-200" style={{ height: 28 }} />

          {/* Children row */}
          <div className="flex items-start gap-0">
            {visibleChildren.map((child, i) => {
              const isFirst = i === 0;
              const isLast = i === visibleChildren.length - 1;
              const isOnly = visibleChildren.length === 1;

              return (
                <div key={child.id} className="relative flex flex-col items-center" style={{ paddingLeft: 20, paddingRight: 20 }}>
                  {/* Horizontal bar at top */}
                  {!isOnly && (
                    <div
                      className="absolute bg-slate-200"
                      style={{
                        top: 0,
                        left: isFirst ? "50%" : 0,
                        right: isLast ? "50%" : 0,
                        height: 1,
                      }}
                    />
                  )}
                  {/* Vertical drop to child */}
                  <div
                    className="w-px bg-slate-200"
                    style={{ height: 20, position: "relative", zIndex: 1 }}
                  />
                  {/* Recurse */}
                  <OrgTree
                    unit={child}
                    selectedId={selectedId}
                    expandedIds={expandedIds}
                    onSelect={onSelect}
                    onToggle={onToggle}
                    searchQuery={searchQuery}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Modal types ────────────────────────────────────────────────────────────────

type ActiveModal =
  | { kind: "create"; parentId: string | null; suggested: UnitType }
  | { kind: "split"; unit: OrgUnit }
  | { kind: "group"; unit: OrgUnit }
  | { kind: "move"; unit: OrgUnit };

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function UnitsPage() {
  const [allUnits, setAllUnits] = useState<RawUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const initialLoadDone = useRef(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailUnit, setDetailUnit] = useState<DetailedUnit | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [activeModal, setActiveModal] = useState<ActiveModal | null>(null);

  // Create
  const [cName, setCName] = useState("");
  const [cType, setCType] = useState<UnitType>("ZONE");

  // Split
  const [spNameA, setSpNameA] = useState("");
  const [spNameB, setSpNameB] = useState("");
  const [spGroupA, setSpGroupA] = useState<Set<string>>(new Set());

  // Group
  const [grName, setGrName] = useState("");
  const [grType, setGrType] = useState<UnitType>("BC");
  const [grSelected, setGrSelected] = useState<Set<string>>(new Set());

  // Move
  const [mvTargetId, setMvTargetId] = useState("");

  // ── Data ─────────────────────────────────────────────────────────────────────

  const loadUnits = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const data = await apiFetch<RawUnit[]>("/organizational-units");
      setAllUnits(data);
      if (!initialLoadDone.current) {
        const roots = buildTree(data).map(r => r.id);
        setExpandedIds(new Set(roots));
        initialLoadDone.current = true;
      }
    } catch {
      setErrorMsg("Failed to load units.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUnits(); }, [loadUnits]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setDetailUnit(null);
    try {
      const data = await apiFetch<DetailedUnit>(`/organizational-units/${id}`);
      setDetailUnit(data);
    } catch { /* silent */ }
    finally { setDetailLoading(false); }
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────────

  const tree = useMemo(() => buildTree(allUnits), [allUnits]);
  const selectedTreeUnit = useMemo(() => (selectedId ? findInTree(tree, selectedId) : null), [tree, selectedId]);
  const selectedRaw = useMemo(() => (selectedId ? allUnits.find(u => u.id === selectedId) ?? null : null), [allUnits, selectedId]);

  const typeCount = useMemo(() => {
    const c: Partial<Record<UnitType, number>> = {};
    allUnits.forEach(u => { c[u.type] = (c[u.type] ?? 0) + 1; });
    return c;
  }, [allUnits]);

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const handleSelect = useCallback((unit: OrgUnit) => {
    setSelectedId(unit.id);
    setIsEditing(false);
    loadDetail(unit.id);
  }, [loadDetail]);

  const handleToggle = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const openCreate = (parentId: string | null, suggested: UnitType) => {
    setCName(""); setCType(suggested);
    setActiveModal({ kind: "create", parentId, suggested });
  };

  const handleCreate = async () => {
    if (!cName.trim() || activeModal?.kind !== "create") return;
    setSaving(true); setErrorMsg("");
    try {
      const created = await apiPost<{ id: string }>("/organizational-units", {
        name: cName.trim(), type: cType,
        ...(activeModal.parentId ? { parentId: activeModal.parentId } : {}),
      });
      setActiveModal(null);
      await loadUnits();
      if (activeModal.parentId) setExpandedIds(prev => new Set([...prev, activeModal.parentId!]));
      setSelectedId(created.id);
      loadDetail(created.id);
    } catch (e) { setErrorMsg(e instanceof Error ? e.message : "Failed."); }
    finally { setSaving(false); }
  };

  const handleRename = async () => {
    if (!selectedId || !editName.trim()) return;
    setSaving(true); setErrorMsg("");
    try {
      await apiPatch(`/organizational-units/${selectedId}`, { name: editName.trim() });
      setIsEditing(false);
      await loadUnits();
      loadDetail(selectedId);
    } catch (e) { setErrorMsg(e instanceof Error ? e.message : "Rename failed."); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!selectedTreeUnit || selectedTreeUnit.children.length > 0) return;
    if (!confirm(`Delete "${selectedTreeUnit.name}"?`)) return;
    setSaving(true); setErrorMsg("");
    try {
      await apiDelete(`/organizational-units/${selectedId}`);
      setSelectedId(null); setDetailUnit(null);
      await loadUnits();
    } catch (e) { setErrorMsg(e instanceof Error ? e.message : "Delete failed."); }
    finally { setSaving(false); }
  };

  const openSplit = () => {
    if (!selectedTreeUnit || selectedTreeUnit.children.length < 2) return;
    setSpNameA(`${selectedTreeUnit.name} A`);
    setSpNameB(`${selectedTreeUnit.name} B`);
    const half = selectedTreeUnit.children.slice(0, Math.ceil(selectedTreeUnit.children.length / 2)).map(c => c.id);
    setSpGroupA(new Set(half));
    setActiveModal({ kind: "split", unit: selectedTreeUnit });
  };

  const handleSplit = async () => {
    if (activeModal?.kind !== "split") return;
    const { unit } = activeModal;
    if (!spNameA.trim() || !spNameB.trim()) return;
    setSaving(true); setErrorMsg("");
    try {
      const [newA, newB] = await Promise.all([
        apiPost<{ id: string }>("/organizational-units", { name: spNameA.trim(), type: unit.type, parentId: unit.parentId }),
        apiPost<{ id: string }>("/organizational-units", { name: spNameB.trim(), type: unit.type, parentId: unit.parentId }),
      ]);
      await Promise.all([
        ...unit.children.filter(c => spGroupA.has(c.id)).map(c => apiPost(`/organizational-units/${newA.id}/children`, { childId: c.id })),
        ...unit.children.filter(c => !spGroupA.has(c.id)).map(c => apiPost(`/organizational-units/${newB.id}/children`, { childId: c.id })),
      ]);
      await apiDelete(`/organizational-units/${unit.id}`);
      setActiveModal(null); setSelectedId(newA.id);
      await loadUnits(); loadDetail(newA.id);
    } catch (e) { setErrorMsg(e instanceof Error ? e.message : "Split failed."); }
    finally { setSaving(false); }
  };

  const openGroup = () => {
    if (!selectedTreeUnit || selectedTreeUnit.children.length < 2) return;
    const suggested = CHILD_TYPE[selectedTreeUnit.children[0]?.type ?? selectedTreeUnit.type] ?? selectedTreeUnit.children[0]?.type ?? "CELL";
    setGrName(""); setGrType(suggested as UnitType); setGrSelected(new Set());
    setActiveModal({ kind: "group", unit: selectedTreeUnit });
  };

  const handleGroup = async () => {
    if (activeModal?.kind !== "group") return;
    const { unit } = activeModal;
    if (!grName.trim() || grSelected.size === 0) return;
    setSaving(true); setErrorMsg("");
    try {
      const newParent = await apiPost<{ id: string }>("/organizational-units", { name: grName.trim(), type: grType, parentId: unit.id });
      await Promise.all([...grSelected].map(childId => apiPost(`/organizational-units/${newParent.id}/children`, { childId })));
      setActiveModal(null);
      setExpandedIds(prev => new Set([...prev, unit.id, newParent.id]));
      setSelectedId(newParent.id);
      await loadUnits(); loadDetail(newParent.id);
    } catch (e) { setErrorMsg(e instanceof Error ? e.message : "Group failed."); }
    finally { setSaving(false); }
  };

  const openMove = () => {
    if (!selectedTreeUnit) return;
    setMvTargetId("");
    setActiveModal({ kind: "move", unit: selectedTreeUnit });
  };

  const handleMove = async () => {
    if (activeModal?.kind !== "move" || !mvTargetId) return;
    setSaving(true); setErrorMsg("");
    try {
      await apiPost(`/organizational-units/${mvTargetId}/children`, { childId: activeModal.unit.id });
      setActiveModal(null);
      setExpandedIds(prev => new Set([...prev, mvTargetId]));
      await loadUnits(); loadDetail(activeModal.unit.id);
    } catch (e) { setErrorMsg(e instanceof Error ? e.message : "Move failed."); }
    finally { setSaving(false); }
  };

  const moveTargets = useMemo(() => {
    if (!activeModal || activeModal.kind !== "move") return [];
    const unit = activeModal.unit;
    return allUnits
      .filter(u => u.id !== unit.id && !unit.ancestors.includes(u.id) && u.id !== unit.parentId)
      .sort((a, b) => ALL_TYPES.indexOf(a.type) - ALL_TYPES.indexOf(b.type) || a.name.localeCompare(b.name));
  }, [activeModal, allUnits]);

  const color = selectedTreeUnit ? TYPE_COLOR[selectedTreeUnit.type] : "#121D55";
  const suggestedChild = selectedTreeUnit ? CHILD_TYPE[selectedTreeUnit.type] ?? null : null;
  const leader = detailUnit?.leaderships[0] ?? null;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ maxHeight: "calc(100vh - 64px)" }}>
      <Header title="Units" subtitle={`${allUnits.length} units`} />

      {errorMsg && (
        <div className="mx-6 mt-3 px-4 py-2.5 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm flex items-center gap-2">
          <span className="flex-1">{errorMsg}</span>
          <button onClick={() => setErrorMsg("")} className="text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* ── Controls bar ── */}
      <div className="px-6 pt-3 pb-2 flex items-center gap-3 flex-wrap border-b border-slate-100">
        {/* Type count pills */}
        <div className="flex gap-2 flex-wrap flex-1">
          {ALL_TYPES.filter(t => typeCount[t]).map(t => (
            <div key={t} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold text-white" style={{ background: TYPE_COLOR[t] }}>
              {TYPE_LABEL[t]} {typeCount[t]}
            </div>
          ))}
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search units…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="px-3 py-1.5 text-sm rounded-xl border border-slate-200 outline-none focus:border-blue-400 w-44"
        />

        <div className="flex gap-1 text-xs text-slate-400">
          <button onClick={() => setExpandedIds(new Set(allUnits.map(u => u.id)))} className="hover:text-slate-600 px-2 py-1">Expand all</button>
          <span className="text-slate-200 self-center">|</span>
          <button onClick={() => setExpandedIds(new Set(tree.map(r => r.id)))} className="hover:text-slate-600 px-2 py-1">Collapse</button>
        </div>

        <button
          onClick={() => openCreate(null, "CHURCH")}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-700 transition-colors"
        >
          + New unit
        </button>
      </div>

      {/* ── Main: Chart canvas + detail drawer ── */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* Chart canvas */}
        <div
          className="flex-1 overflow-auto p-8"
          style={{ background: "radial-gradient(#e2e8f0 1px, transparent 1px)", backgroundSize: "24px 24px", backgroundColor: "#f8fafc" }}
          onClick={() => { setSelectedId(null); setDetailUnit(null); }}
        >
          {loading ? (
            <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Loading tree…</div>
          ) : tree.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <p className="text-slate-300 text-4xl">🏛️</p>
              <p className="text-slate-400 text-sm">No units yet</p>
              <button onClick={() => openCreate(null, "CHURCH")} className="text-sm text-blue-600 hover:underline">Create first unit</button>
            </div>
          ) : (
            <div className="flex gap-12 justify-start items-start min-w-max pb-8" onClick={e => e.stopPropagation()}>
              {tree.map(root => (
                <OrgTree
                  key={root.id}
                  unit={root}
                  selectedId={selectedId}
                  expandedIds={expandedIds}
                  onSelect={handleSelect}
                  onToggle={handleToggle}
                  searchQuery={searchQuery}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Detail drawer (right panel) ── */}
        <div
          className={`flex-shrink-0 border-l border-slate-100 bg-white overflow-y-auto transition-all duration-300 ${
            selectedTreeUnit ? "w-80" : "w-0 border-l-0"
          }`}
        >
          {selectedTreeUnit && (
            <div className="p-5 space-y-4">
              {/* Close */}
              <div className="flex justify-end">
                <button onClick={() => { setSelectedId(null); setDetailUnit(null); }} className="text-slate-300 hover:text-slate-500 transition-colors text-lg">✕</button>
              </div>

              {/* Unit header */}
              <div className="flex flex-col items-center text-center gap-2">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg" style={{ background: color }}>
                  {selectedTreeUnit.type === "SHEPHERD" ? "SH" : selectedTreeUnit.type.slice(0, 2)}
                </div>

                {isEditing ? (
                  <div className="w-full space-y-2">
                    <input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setIsEditing(false); }}
                      className="w-full px-3 py-2 text-sm font-semibold border-b-2 outline-none text-center"
                      style={{ borderColor: color }}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button onClick={handleRename} disabled={saving} className="flex-1 py-1.5 rounded-xl text-xs font-semibold text-white disabled:opacity-60" style={{ background: color }}>Save</button>
                      <button onClick={() => setIsEditing(false)} className="flex-1 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 text-slate-600">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <p className="text-base font-bold text-slate-800 text-center leading-tight">{selectedTreeUnit.name}</p>
                    <button onClick={() => { setEditName(selectedTreeUnit.name); setIsEditing(true); }} className="text-slate-300 hover:text-slate-500 transition-colors text-sm flex-shrink-0">✎</button>
                  </div>
                )}

                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full text-white" style={{ background: color }}>
                  {TYPE_LABEL[selectedTreeUnit.type] ?? selectedTreeUnit.type}
                </span>

                {selectedRaw && (
                  <div className="flex gap-3 text-xs text-slate-400">
                    {selectedRaw.memberships.length > 0 && <span>👥 {selectedRaw.memberships.length} members</span>}
                    {selectedTreeUnit.children.length > 0 && <span>🏢 {selectedTreeUnit.children.length} sub-units</span>}
                  </div>
                )}
              </div>

              {/* Leader card */}
              {detailLoading ? (
                <div className="h-14 bg-slate-50 rounded-xl animate-pulse" />
              ) : leader ? (
                <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs flex-shrink-0" style={{ background: color }}>
                    {leader.user.firstName[0]}{leader.user.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-700 truncate">{leader.user.firstName} {leader.user.lastName}</p>
                    <p className="text-[10px] text-slate-400 truncate">{leader.role} · {leader.user.email}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-3 border border-dashed border-slate-200">
                  <div className="w-9 h-9 rounded-xl bg-slate-200 flex items-center justify-center text-slate-400 text-lg flex-shrink-0">👤</div>
                  <p className="text-xs text-slate-400">No leader assigned</p>
                </div>
              )}

              {/* Parent link */}
              {detailUnit?.parent && (
                <p className="text-xs text-slate-400 text-center">
                  Under: <span className="font-semibold text-slate-600">{detailUnit.parent.name}</span>
                </p>
              )}

              <div className="border-t border-slate-100" />

              {/* Actions */}
              <div className="space-y-2">
                {suggestedChild && (
                  <button
                    onClick={() => openCreate(selectedTreeUnit.id, suggestedChild)}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
                    style={{ background: color }}
                  >
                    + Add {TYPE_LABEL[suggestedChild]}
                  </button>
                )}

                {selectedTreeUnit.children.length >= 2 && (
                  <button onClick={openSplit} className="w-full py-2.5 rounded-xl text-sm font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors">
                    ✂ Split this unit
                  </button>
                )}

                {selectedTreeUnit.children.length >= 2 && (
                  <button onClick={openGroup} className="w-full py-2.5 rounded-xl text-sm font-semibold bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-colors">
                    ⊞ Group children into new unit
                  </button>
                )}

                {selectedTreeUnit.parentId && (
                  <button onClick={openMove} className="w-full py-2.5 rounded-xl text-sm font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors">
                    ↗ Move branch to…
                  </button>
                )}

                {selectedTreeUnit.children.length === 0 && (
                  <button onClick={handleDelete} disabled={saving} className="w-full py-2.5 rounded-xl text-sm font-semibold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors disabled:opacity-60">
                    🗑 Delete
                  </button>
                )}
              </div>

              {selectedTreeUnit.children.length > 0 && (
                <p className="text-[10px] text-slate-300 text-center">
                  To delete, first remove or move its {selectedTreeUnit.children.length} sub-unit{selectedTreeUnit.children.length > 1 ? "s" : ""}.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ══ MODALS ══ */}

      {activeModal?.kind === "create" && (
        <Modal title={activeModal.parentId ? "Add child unit" : "Create root unit"} onClose={() => setActiveModal(null)}>
          <div className="space-y-5">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">Unit name</label>
              <input value={cName} onChange={e => setCName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleCreate()}
                placeholder="e.g. North Zone" autoFocus
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-2">Type</label>
              <TypePicker value={cType} onChange={setCType} />
              {activeModal.parentId && cType !== activeModal.suggested && (
                <p className="text-xs text-amber-500 mt-2">Suggested: <strong>{activeModal.suggested}</strong> — override is allowed.</p>
              )}
            </div>
            <button onClick={handleCreate} disabled={saving || !cName.trim()}
              className="w-full py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-60"
              style={{ background: TYPE_COLOR[cType] }}>
              {saving ? "Creating…" : `Create ${TYPE_LABEL[cType]}`}
            </button>
          </div>
        </Modal>
      )}

      {activeModal?.kind === "split" && (
        <Modal title={`Split "${activeModal.unit.name}"`} wide onClose={() => setActiveModal(null)}>
          <div className="space-y-5">
            <p className="text-sm text-slate-500">Two new units at the same level will be created. Assign each child — the original is removed.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Group A name</label>
                <input value={spNameA} onChange={e => setSpNameA(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-amber-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Group B name</label>
                <input value={spNameB} onChange={e => setSpNameB(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-amber-400" />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <p className="text-xs font-semibold text-slate-600">Assign sub-units (click to toggle A/B)</p>
                <span className="text-xs text-slate-400">A: {spGroupA.size} · B: {activeModal.unit.children.length - spGroupA.size}</span>
              </div>
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {activeModal.unit.children.map(child => {
                  const inA = spGroupA.has(child.id);
                  return (
                    <button type="button" key={child.id} onClick={() => setSpGroupA(prev => { const n = new Set(prev); n.has(child.id) ? n.delete(child.id) : n.add(child.id); return n; })}
                      className={`w-full flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${inA ? "border-amber-300 bg-amber-50" : "border-slate-200"}`}>
                      <span className="w-6 h-6 rounded text-xs font-bold text-white flex items-center justify-center flex-shrink-0" style={{ background: TYPE_COLOR[child.type] ?? "#94a3b8" }}>
                        {child.type.slice(0, 2)}
                      </span>
                      <span className="text-sm text-slate-700 flex-1">{child.name}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${inA ? "bg-amber-400" : "bg-slate-300"}`}>{inA ? "A" : "B"}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <button onClick={handleSplit} disabled={saving || !spNameA.trim() || !spNameB.trim()}
              className="w-full py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-60 bg-amber-500 hover:bg-amber-600 transition-colors">
              {saving ? "Splitting…" : "Confirm Split"}
            </button>
          </div>
        </Modal>
      )}

      {activeModal?.kind === "group" && (
        <Modal title={`Group children of "${activeModal.unit.name}"`} wide onClose={() => setActiveModal(null)}>
          <div className="space-y-5">
            <p className="text-sm text-slate-500">Selected children will be moved into a new intermediate unit.</p>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">New group name</label>
              <input value={grName} onChange={e => setGrName(e.target.value)} placeholder="e.g. East BC Cluster" autoFocus
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-purple-400" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-2">Type</label>
              <TypePicker value={grType} onChange={setGrType} />
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <p className="text-xs font-semibold text-slate-600">Select children to move</p>
                <span className="text-xs text-slate-400">{grSelected.size} selected</span>
              </div>
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {activeModal.unit.children.map(child => {
                  const sel = grSelected.has(child.id);
                  return (
                    <button type="button" key={child.id} onClick={() => setGrSelected(prev => { const n = new Set(prev); n.has(child.id) ? n.delete(child.id) : n.add(child.id); return n; })}
                      className={`w-full flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${sel ? "border-purple-300 bg-purple-50" : "border-slate-200"}`}>
                      <input type="checkbox" readOnly checked={sel} className="w-4 h-4 accent-purple-600 pointer-events-none flex-shrink-0" />
                      <span className="w-6 h-6 rounded text-xs font-bold text-white flex items-center justify-center flex-shrink-0" style={{ background: TYPE_COLOR[child.type] ?? "#94a3b8" }}>
                        {child.type.slice(0, 2)}
                      </span>
                      <span className="text-sm text-slate-700 flex-1">{child.name}</span>
                      {child.memberships.length > 0 && <span className="text-xs text-slate-400">{child.memberships.length}m</span>}
                    </button>
                  );
                })}
              </div>
            </div>
            <button onClick={handleGroup} disabled={saving || !grName.trim() || grSelected.size === 0}
              className="w-full py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-60 bg-purple-600 hover:bg-purple-700 transition-colors">
              {saving ? "Creating…" : `Create group (${grSelected.size} units)`}
            </button>
          </div>
        </Modal>
      )}

      {activeModal?.kind === "move" && (
        <Modal title={`Move "${activeModal.unit.name}" to…`} wide onClose={() => setActiveModal(null)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-500">This unit and all its descendants will be moved under the selected parent.</p>
            <div className="max-h-72 overflow-y-auto space-y-1.5">
              {moveTargets.map(u => {
                const expected = CHILD_TYPE[u.type];
                const compatible = !expected || expected === activeModal.unit.type;
                return (
                  <button type="button" key={u.id} onClick={() => setMvTargetId(u.id)}
                    className={`w-full flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${mvTargetId === u.id ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:border-slate-300"}`}>
                    <span className="w-6 h-6 rounded text-xs font-bold text-white flex items-center justify-center flex-shrink-0" style={{ background: TYPE_COLOR[u.type] ?? "#94a3b8" }}>
                      {u.type.slice(0, 2)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-700 truncate">{u.name}</p>
                      <p className="text-xs text-slate-400">{TYPE_LABEL[u.type] ?? u.type}</p>
                    </div>
                    {!compatible && <span className="text-xs text-amber-500 flex-shrink-0">⚠ type mismatch</span>}
                    {mvTargetId === u.id && <span className="text-blue-500">✓</span>}
                  </button>
                );
              })}
            </div>
            <button onClick={handleMove} disabled={saving || !mvTargetId}
              className="w-full py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-60 bg-blue-600 hover:bg-blue-700 transition-colors">
              {saving ? "Moving…" : "Move branch"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
