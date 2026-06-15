"use client";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Header from "@/components/layout/Header";
import { apiFetch, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

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

interface DetailedLeadership {
  id: string;
  role: string;
  user: { id: string; firstName: string; lastName: string; email: string };
}

interface DetailedUnit extends Omit<RawUnit, "leaderships"> {
  parent: { id: string; name: string; type: UnitType } | null;
  leaderships: DetailedLeadership[];
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

// ── Shared UI atoms ────────────────────────────────────────────────────────────

function TypeBadge({ type, size = "sm" }: { type: UnitType; size?: "xs" | "sm" | "lg" }) {
  const dims = size === "lg" ? "w-14 h-14 text-xl rounded-2xl" : size === "sm" ? "w-7 h-7 text-xs rounded-lg" : "w-6 h-6 text-xs rounded";
  return (
    <span className={`${dims} flex items-center justify-center text-white font-bold flex-shrink-0`} style={{ background: TYPE_COLOR[type] }}>
      {type === "SHEPHERD" ? "SH" : type.slice(0, 2)}
    </span>
  );
}

function Modal({ title, wide, onClose, children }: { title: string; wide?: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[90vh] overflow-y-auto`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl">
          <h3 className="text-base font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">✕</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function TypePicker({ value, onChange }: { value: UnitType; onChange: (t: UnitType) => void }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {ALL_TYPES.map(t => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          className={`py-2 rounded-xl text-xs font-semibold border transition-all ${value === t ? "text-white border-transparent shadow-sm" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"}`}
          style={value === t ? { background: TYPE_COLOR[t] } : {}}
        >
          {t === "SHEPHERD" ? "SHPD" : t}
        </button>
      ))}
    </div>
  );
}

// ── Tree Node ──────────────────────────────────────────────────────────────────

const INDENT = 18; // px per depth level
const ROW_H = 34;  // px row height — must match the rendered row height

function TreeNode({
  unit, depth, isLast, ancestorHasMore, selectedId, onSelect, expandedIds, onToggle, searchQuery,
}: {
  unit: OrgUnit; depth: number; isLast: boolean; ancestorHasMore: boolean[];
  selectedId: string | null; onSelect: (u: OrgUnit) => void;
  expandedIds: Set<string>; onToggle: (id: string) => void; searchQuery: string;
}) {
  const isExpanded = expandedIds.has(unit.id);
  const isSelected = selectedId === unit.id;

  const matchesSelf = !searchQuery || unit.name.toLowerCase().includes(searchQuery.toLowerCase());
  const hasMatch = searchQuery ? flattenTree(unit).some(u => u.name.toLowerCase().includes(searchQuery.toLowerCase())) : true;
  if (!hasMatch) return null;

  const visibleChildren = isExpanded
    ? unit.children.filter(c => !searchQuery || flattenTree(c).some(u => u.name.toLowerCase().includes(searchQuery.toLowerCase())))
    : [];

  return (
    <div>
      {/* ── Row ── */}
      <div
        className="relative flex items-center cursor-pointer select-none group"
        style={{ height: ROW_H, paddingRight: 8 }}
        onClick={() => onSelect(unit)}
      >
        {/* ── Tree lines ── */}
        {depth > 0 && (
          <>
            {/* Vertical lines for each ancestor level */}
            {ancestorHasMore.map((hasMore, i) => hasMore ? (
              <div
                key={i}
                className="absolute pointer-events-none"
                style={{
                  left: i * INDENT + 9,
                  top: 0, bottom: 0,
                  width: 1,
                  background: "#e2e8f0",
                }}
              />
            ) : null)}

            {/* Elbow connector for this node */}
            {/* Vertical part (top half + continues down if not last) */}
            <div
              className="absolute pointer-events-none"
              style={{
                left: (depth - 1) * INDENT + 9,
                top: 0,
                height: isLast ? ROW_H / 2 : ROW_H,
                width: 1,
                background: "#e2e8f0",
              }}
            />
            {/* Horizontal part */}
            <div
              className="absolute pointer-events-none"
              style={{
                left: (depth - 1) * INDENT + 9,
                top: ROW_H / 2 - 0.5,
                width: INDENT - 2,
                height: 1,
                background: "#e2e8f0",
              }}
            />
          </>
        )}

        {/* ── Row content ── */}
        <div
          className={`relative flex items-center gap-1.5 flex-1 mx-1 px-2 rounded-lg transition-all ${isSelected ? "bg-slate-900" : "group-hover:bg-slate-100"}`}
          style={{ height: ROW_H - 6, marginLeft: depth * INDENT }}
        >
          {/* Expand toggle */}
          <button
            type="button"
            onClick={e => { e.stopPropagation(); if (unit.children.length) onToggle(unit.id); }}
            className={`w-4 h-4 rounded flex items-center justify-center text-[10px] flex-shrink-0 transition-colors ${
              unit.children.length === 0
                ? "opacity-0 pointer-events-none"
                : isSelected ? "text-white/50 hover:text-white" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            {isExpanded ? "▾" : "▸"}
          </button>

          {/* Type badge */}
          <TypeBadge type={unit.type} size="sm" />

          {/* Name */}
          <span className={`flex-1 text-[13px] font-medium truncate ${
            matchesSelf && searchQuery ? "text-blue-600" : isSelected ? "text-white" : "text-slate-700"
          }`}>
            {unit.name}
          </span>

          {/* Member count pill */}
          {unit.memberships.length > 0 && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${
              isSelected ? "bg-white/20 text-white/80" : "bg-slate-100 text-slate-400"
            }`}>
              {unit.memberships.length}
            </span>
          )}

          {/* Child count indicator when collapsed */}
          {!isExpanded && unit.children.length > 0 && (
            <span className={`text-[10px] flex-shrink-0 ${isSelected ? "text-white/40" : "text-slate-300"}`}>
              +{unit.children.length}
            </span>
          )}
        </div>
      </div>

      {/* ── Children ── */}
      {visibleChildren.map((child, i) => (
        <TreeNode
          key={child.id}
          unit={child}
          depth={depth + 1}
          isLast={i === visibleChildren.length - 1}
          ancestorHasMore={[...ancestorHasMore, !isLast]}
          selectedId={selectedId}
          onSelect={onSelect}
          expandedIds={expandedIds}
          onToggle={onToggle}
          searchQuery={searchQuery}
        />
      ))}
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
  useAuthStore(); // ensure hydrated

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

  // Create state
  const [cName, setCName] = useState("");
  const [cType, setCType] = useState<UnitType>("ZONE");

  // Split state
  const [spNameA, setSpNameA] = useState("");
  const [spNameB, setSpNameB] = useState("");
  const [spGroupA, setSpGroupA] = useState<Set<string>>(new Set());

  // Group state
  const [grName, setGrName] = useState("");
  const [grType, setGrType] = useState<UnitType>("BC");
  const [grSelected, setGrSelected] = useState<Set<string>>(new Set());

  // Move state
  const [mvTargetId, setMvTargetId] = useState("");

  // ── Data loading ─────────────────────────────────────────────────────────────

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
    } catch {
      // silently ignore; use tree data fallback
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // ── Derived state ─────────────────────────────────────────────────────────────

  const tree = useMemo(() => buildTree(allUnits), [allUnits]);

  const selectedTreeUnit = useMemo(
    () => (selectedId ? findInTree(tree, selectedId) : null),
    [tree, selectedId]
  );

  const selectedRaw = useMemo(
    () => (selectedId ? allUnits.find(u => u.id === selectedId) ?? null : null),
    [allUnits, selectedId]
  );

  // ── Selection ─────────────────────────────────────────────────────────────────

  const handleSelect = useCallback((unit: OrgUnit) => {
    setSelectedId(unit.id);
    setIsEditing(false);
    setDetailUnit(null);
    loadDetail(unit.id);
    setExpandedIds(prev => {
      if (!prev.has(unit.id) && unit.children.length > 0) return new Set([...prev, unit.id]);
      return prev;
    });
  }, [loadDetail]);

  const handleToggle = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  // ── Create ────────────────────────────────────────────────────────────────────

  const openCreate = (parentId: string | null, suggested: UnitType) => {
    setCName("");
    setCType(suggested);
    setActiveModal({ kind: "create", parentId, suggested });
  };

  const handleCreate = async () => {
    if (!cName.trim() || activeModal?.kind !== "create") return;
    setSaving(true);
    setErrorMsg("");
    try {
      const created = await apiPost<{ id: string }>("/organizational-units", {
        name: cName.trim(),
        type: cType,
        ...(activeModal.parentId ? { parentId: activeModal.parentId } : {}),
      });
      setActiveModal(null);
      await loadUnits();
      // Expand the parent so the new unit is visible
      if (activeModal.parentId) {
        setExpandedIds(prev => new Set([...prev, activeModal.parentId!]));
      }
      setSelectedId(created.id);
      loadDetail(created.id);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Failed to create unit.");
    } finally {
      setSaving(false);
    }
  };

  // ── Rename ────────────────────────────────────────────────────────────────────

  const handleRename = async () => {
    if (!selectedId || !editName.trim()) return;
    setSaving(true);
    setErrorMsg("");
    try {
      await apiPatch(`/organizational-units/${selectedId}`, { name: editName.trim() });
      setIsEditing(false);
      await loadUnits();
      loadDetail(selectedId);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Rename failed.");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!selectedTreeUnit || selectedTreeUnit.children.length > 0) return;
    if (!confirm(`Delete "${selectedTreeUnit.name}"? This cannot be undone.`)) return;
    setSaving(true);
    setErrorMsg("");
    try {
      await apiDelete(`/organizational-units/${selectedId}`);
      setSelectedId(null);
      setDetailUnit(null);
      await loadUnits();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setSaving(false);
    }
  };

  // ── Split ─────────────────────────────────────────────────────────────────────

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
    setSaving(true);
    setErrorMsg("");
    try {
      const [newA, newB] = await Promise.all([
        apiPost<{ id: string }>("/organizational-units", { name: spNameA.trim(), type: unit.type, parentId: unit.parentId }),
        apiPost<{ id: string }>("/organizational-units", { name: spNameB.trim(), type: unit.type, parentId: unit.parentId }),
      ]);

      const childrenA = unit.children.filter(c => spGroupA.has(c.id));
      const childrenB = unit.children.filter(c => !spGroupA.has(c.id));

      await Promise.all([
        ...childrenA.map(c => apiPost(`/organizational-units/${newA.id}/children`, { childId: c.id })),
        ...childrenB.map(c => apiPost(`/organizational-units/${newB.id}/children`, { childId: c.id })),
      ]);

      await apiDelete(`/organizational-units/${unit.id}`);
      setActiveModal(null);
      setSelectedId(newA.id);
      await loadUnits();
      loadDetail(newA.id);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Split failed.");
    } finally {
      setSaving(false);
    }
  };

  // ── Group into new sub-unit ───────────────────────────────────────────────────

  const openGroup = () => {
    if (!selectedTreeUnit || selectedTreeUnit.children.length < 2) return;
    const suggestedType = CHILD_TYPE[selectedTreeUnit.children[0]?.type ?? selectedTreeUnit.type] ?? selectedTreeUnit.children[0]?.type ?? "CELL";
    setGrName("");
    setGrType(suggestedType as UnitType);
    setGrSelected(new Set());
    setActiveModal({ kind: "group", unit: selectedTreeUnit });
  };

  const handleGroup = async () => {
    if (activeModal?.kind !== "group") return;
    const { unit } = activeModal;
    if (!grName.trim() || grSelected.size === 0) return;
    setSaving(true);
    setErrorMsg("");
    try {
      const newParent = await apiPost<{ id: string }>("/organizational-units", {
        name: grName.trim(), type: grType, parentId: unit.id,
      });
      await Promise.all(
        [...grSelected].map(childId => apiPost(`/organizational-units/${newParent.id}/children`, { childId }))
      );
      setActiveModal(null);
      setExpandedIds(prev => new Set([...prev, unit.id, newParent.id]));
      setSelectedId(newParent.id);
      await loadUnits();
      loadDetail(newParent.id);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Group failed.");
    } finally {
      setSaving(false);
    }
  };

  // ── Move ──────────────────────────────────────────────────────────────────────

  const openMove = () => {
    if (!selectedTreeUnit) return;
    setMvTargetId("");
    setActiveModal({ kind: "move", unit: selectedTreeUnit });
  };

  const handleMove = async () => {
    if (activeModal?.kind !== "move" || !mvTargetId) return;
    setSaving(true);
    setErrorMsg("");
    try {
      await apiPost(`/organizational-units/${mvTargetId}/children`, { childId: activeModal.unit.id });
      setActiveModal(null);
      setExpandedIds(prev => new Set([...prev, mvTargetId]));
      await loadUnits();
      loadDetail(activeModal.unit.id);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Move failed.");
    } finally {
      setSaving(false);
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────────

  const color = selectedTreeUnit ? TYPE_COLOR[selectedTreeUnit.type] : "#121D55";
  const suggestedChild = selectedTreeUnit ? CHILD_TYPE[selectedTreeUnit.type] ?? null : null;
  const leader = detailUnit?.leaderships[0] ?? null;

  // Units eligible to be a new parent in the move modal
  const moveTargets = useMemo(() => {
    if (!activeModal || activeModal.kind !== "move") return [];
    const unit = activeModal.unit;
    return allUnits
      .filter(u => u.id !== unit.id && !unit.ancestors.includes(u.id) && u.id !== unit.parentId)
      .sort((a, b) => {
        const typeOrder = ALL_TYPES.indexOf(a.type) - ALL_TYPES.indexOf(b.type);
        return typeOrder !== 0 ? typeOrder : a.name.localeCompare(b.name);
      });
  }, [activeModal, allUnits]);

  const totalUnits = allUnits.length;
  const typeCount = useMemo(() => {
    const c: Partial<Record<UnitType, number>> = {};
    allUnits.forEach(u => { c[u.type] = (c[u.type] ?? 0) + 1; });
    return c;
  }, [allUnits]);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ maxHeight: "calc(100vh - 64px)" }}>
      <Header title="Units" subtitle={`${totalUnits} units · organizational tree`} />

      {errorMsg && (
        <div className="mx-6 mt-3 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm flex items-center gap-2">
          <span className="flex-1">{errorMsg}</span>
          <button onClick={() => setErrorMsg("")} className="text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* Type summary strip */}
      <div className="px-6 pt-3 pb-2 flex gap-2 flex-wrap">
        {ALL_TYPES.filter(t => typeCount[t]).map(t => (
          <div key={t} className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-white" style={{ background: TYPE_COLOR[t] }}>
            {TYPE_LABEL[t]}: {typeCount[t]}
          </div>
        ))}
        <button
          onClick={() => openCreate(null, "CHURCH")}
          className="ml-auto px-3 py-1 rounded-full text-xs font-medium bg-slate-900 text-white hover:bg-slate-700 transition-colors"
        >
          + New root unit
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* ── LEFT: Tree panel ── */}
        <div className="w-72 flex-shrink-0 border-r border-slate-100 flex flex-col overflow-hidden bg-slate-50/60">
          {/* Search + controls */}
          <div className="p-3 space-y-2 border-b border-slate-100">
            <input
              type="text"
              placeholder="Search units…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/10"
            />
            <div className="flex text-xs text-slate-400">
              <button onClick={() => setExpandedIds(new Set(allUnits.map(u => u.id)))} className="flex-1 hover:text-slate-600 py-0.5">Expand all</button>
              <span className="text-slate-200 self-center">|</span>
              <button
                onClick={() => setExpandedIds(new Set(tree.map(r => r.id)))}
                className="flex-1 hover:text-slate-600 py-0.5"
              >
                Collapse
              </button>
            </div>
          </div>

          {/* Tree */}
          <div className="flex-1 overflow-y-auto p-2">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-slate-300 text-sm">Loading…</div>
            ) : tree.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-slate-300 text-sm mb-3">No units yet</p>
                <button onClick={() => openCreate(null, "CHURCH")} className="text-xs text-blue-600 hover:underline">Create first unit</button>
              </div>
            ) : (
              tree.map((root, i) => (
                <TreeNode
                  key={root.id} unit={root} depth={0}
                  isLast={i === tree.length - 1}
                  ancestorHasMore={[]}
                  selectedId={selectedId} onSelect={handleSelect}
                  expandedIds={expandedIds} onToggle={handleToggle}
                  searchQuery={searchQuery}
                />
              ))
            )}
          </div>
        </div>

        {/* ── RIGHT: Detail panel ── */}
        <div className="flex-1 overflow-y-auto">
          {!selectedTreeUnit ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3">
              <p className="text-5xl opacity-20">🏛️</p>
              <p className="text-slate-400 text-sm">Select a unit from the tree to view details</p>
            </div>
          ) : (
            <div className="p-6 max-w-3xl space-y-6">

              {/* ── Header ── */}
              <div className="flex items-start gap-4">
                <TypeBadge type={selectedTreeUnit.type} size="lg" />
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <div className="flex gap-2 items-center">
                      <input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setIsEditing(false); }}
                        className="flex-1 text-xl font-bold text-slate-800 border-b-2 border-blue-500 outline-none bg-transparent pb-0.5"
                        autoFocus
                      />
                      <button onClick={handleRename} disabled={saving} className="px-3 py-1.5 rounded-xl bg-blue-600 text-white text-sm font-medium disabled:opacity-60">Save</button>
                      <button onClick={() => setIsEditing(false)} className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 text-sm">✕</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-slate-800 truncate">{selectedTreeUnit.name}</h2>
                      <button onClick={() => { setEditName(selectedTreeUnit.name); setIsEditing(true); }} className="text-slate-300 hover:text-slate-500 transition-colors text-lg leading-none" title="Rename">✎</button>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: color }}>
                      {TYPE_LABEL[selectedTreeUnit.type]}
                    </span>
                    {selectedRaw && <span className="text-xs text-slate-400">👥 {selectedRaw.memberships.length} members</span>}
                    {selectedTreeUnit.children.length > 0 && <span className="text-xs text-slate-400">🏢 {selectedTreeUnit.children.length} direct sub-units</span>}
                    {selectedTreeUnit.ancestors.length > 0 && <span className="text-xs text-slate-400">Depth {selectedTreeUnit.ancestors.length}</span>}
                  </div>
                </div>
              </div>

              {/* ── Leader card ── */}
              {detailLoading ? (
                <div className="h-16 bg-slate-50 rounded-xl animate-pulse" />
              ) : leader ? (
                <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0" style={{ background: color }}>
                    {leader.user.firstName[0]}{leader.user.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700">{leader.user.firstName} {leader.user.lastName}</p>
                    <p className="text-xs text-slate-400 truncate">{leader.role} · {leader.user.email}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-4 border border-dashed border-slate-200">
                  <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center text-slate-400 flex-shrink-0">👤</div>
                  <p className="text-sm text-slate-400">No leader assigned</p>
                </div>
              )}

              {/* ── Parent breadcrumb ── */}
              {detailUnit?.parent && (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>Under:</span>
                  <button
                    onClick={() => {
                      const parent = allUnits.find(u => u.id === detailUnit.parent!.id);
                      if (parent) handleSelect({ ...parent, children: [] });
                    }}
                    className="flex items-center gap-1.5 text-slate-600 hover:text-blue-600 transition-colors font-medium"
                  >
                    <TypeBadge type={detailUnit.parent.type} size="xs" />
                    {detailUnit.parent.name}
                  </button>
                </div>
              )}

              {/* ── Actions ── */}
              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Actions</p>
                <div className="flex flex-wrap gap-2">
                  {suggestedChild && (
                    <button
                      onClick={() => openCreate(selectedTreeUnit.id, suggestedChild)}
                      className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
                      style={{ background: color }}
                    >
                      + Add {TYPE_LABEL[suggestedChild]}
                    </button>
                  )}

                  {selectedTreeUnit.children.length >= 2 && (
                    <button
                      onClick={openSplit}
                      className="px-4 py-2 rounded-xl text-sm font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
                    >
                      ✂ Split unit
                    </button>
                  )}

                  {selectedTreeUnit.children.length >= 2 && (
                    <button
                      onClick={openGroup}
                      className="px-4 py-2 rounded-xl text-sm font-semibold bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-colors"
                    >
                      ⊞ Group into new sub-unit
                    </button>
                  )}

                  {selectedTreeUnit.parentId && (
                    <button
                      onClick={openMove}
                      className="px-4 py-2 rounded-xl text-sm font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                    >
                      ↗ Move to…
                    </button>
                  )}

                  {selectedTreeUnit.children.length === 0 && (
                    <button
                      onClick={handleDelete}
                      disabled={saving}
                      className="px-4 py-2 rounded-xl text-sm font-semibold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors disabled:opacity-60"
                    >
                      🗑 Delete
                    </button>
                  )}
                </div>

                {/* Hint for non-leaf units */}
                {selectedTreeUnit.children.length > 0 && (
                  <p className="text-xs text-slate-400 mt-2">
                    To delete this unit, first move or delete its {selectedTreeUnit.children.length} sub-unit{selectedTreeUnit.children.length > 1 ? "s" : ""}.
                  </p>
                )}
              </div>

              {/* ── Children grid ── */}
              {selectedTreeUnit.children.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    Sub-units ({selectedTreeUnit.children.length})
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedTreeUnit.children.map(child => (
                      <button
                        key={child.id}
                        onClick={() => handleSelect(child)}
                        className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-100 text-left transition-colors group"
                      >
                        <TypeBadge type={child.type} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-700 truncate group-hover:text-slate-900">{child.name}</p>
                          <p className="text-xs text-slate-400">
                            {TYPE_LABEL[child.type]}
                            {child.children.length > 0 && ` · ${child.children.length} sub-units`}
                            {child.memberships.length > 0 && ` · ${child.memberships.length}m`}
                          </p>
                        </div>
                        <span className="text-slate-300 group-hover:text-slate-500 text-sm">›</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════ MODALS ═══════════════════ */}

      {/* Create */}
      {activeModal?.kind === "create" && (
        <Modal title={activeModal.parentId ? `Add child unit` : "Create root unit"} onClose={() => setActiveModal(null)}>
          <div className="space-y-5">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">Unit name</label>
              <input
                value={cName}
                onChange={e => setCName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleCreate()}
                placeholder="e.g. North Zone"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/10"
                autoFocus
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-2">Unit type</label>
              <TypePicker value={cType} onChange={setCType} />
              {activeModal.parentId && cType !== activeModal.suggested && (
                <p className="text-xs text-amber-500 mt-2">
                  Suggested for this level: <strong>{activeModal.suggested}</strong>. You can override.
                </p>
              )}
            </div>
            <button
              onClick={handleCreate}
              disabled={saving || !cName.trim()}
              className="w-full py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-60 transition-opacity"
              style={{ background: TYPE_COLOR[cType] }}
            >
              {saving ? "Creating…" : `Create ${TYPE_LABEL[cType]}`}
            </button>
          </div>
        </Modal>
      )}

      {/* Split */}
      {activeModal?.kind === "split" && (
        <Modal title={`Split "${activeModal.unit.name}"`} wide onClose={() => setActiveModal(null)}>
          <div className="space-y-5">
            <p className="text-sm text-slate-500">
              Two new <strong>{TYPE_LABEL[activeModal.unit.type]}</strong> units will be created under the same parent.
              Assign each sub-unit to a group — the original will be removed.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Group A</label>
                <input
                  value={spNameA}
                  onChange={e => setSpNameA(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-amber-400"
                  placeholder="Name for Group A"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Group B</label>
                <input
                  value={spNameB}
                  onChange={e => setSpNameB(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-amber-400"
                  placeholder="Name for Group B"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-600">Assign sub-units</p>
                <div className="flex gap-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full inline-block bg-amber-400" /> A: {spGroupA.size}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full inline-block bg-slate-300" /> B: {activeModal.unit.children.length - spGroupA.size}
                  </span>
                </div>
              </div>
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {activeModal.unit.children.map(child => {
                  const inA = spGroupA.has(child.id);
                  return (
                    <button
                      type="button"
                      key={child.id}
                      onClick={() => setSpGroupA(prev => {
                        const next = new Set(prev);
                        next.has(child.id) ? next.delete(child.id) : next.add(child.id);
                        return next;
                      })}
                      className={`w-full flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${inA ? "border-amber-300 bg-amber-50" : "border-slate-200 hover:border-slate-300"}`}
                    >
                      <TypeBadge type={child.type} size="xs" />
                      <span className="text-sm text-slate-700 flex-1">{child.name}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${inA ? "bg-amber-400" : "bg-slate-300"}`}>
                        {inA ? "A" : "B"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              onClick={handleSplit}
              disabled={saving || !spNameA.trim() || !spNameB.trim()}
              className="w-full py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-60 bg-amber-500 hover:bg-amber-600 transition-colors"
            >
              {saving ? "Splitting…" : "Confirm Split"}
            </button>
          </div>
        </Modal>
      )}

      {/* Group */}
      {activeModal?.kind === "group" && (
        <Modal title={`Group sub-units of "${activeModal.unit.name}"`} wide onClose={() => setActiveModal(null)}>
          <div className="space-y-5">
            <p className="text-sm text-slate-500">
              Select children to move into a new sub-unit. The selected units become children of the new unit.
            </p>

            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">New group name</label>
              <input
                value={grName}
                onChange={e => setGrName(e.target.value)}
                placeholder="e.g. East BC Cluster"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-purple-400"
                autoFocus
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 block mb-2">Type of new group</label>
              <TypePicker value={grType} onChange={setGrType} />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-600">Select sub-units to move</p>
                <span className="text-xs text-slate-400">{grSelected.size} of {activeModal.unit.children.length} selected</span>
              </div>
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {activeModal.unit.children.map(child => {
                  const sel = grSelected.has(child.id);
                  return (
                    <button
                      type="button"
                      key={child.id}
                      onClick={() => setGrSelected(prev => {
                        const next = new Set(prev);
                        next.has(child.id) ? next.delete(child.id) : next.add(child.id);
                        return next;
                      })}
                      className={`w-full flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${sel ? "border-purple-300 bg-purple-50" : "border-slate-200 hover:border-slate-300"}`}
                    >
                      <input type="checkbox" readOnly checked={sel} className="w-4 h-4 accent-purple-600 pointer-events-none flex-shrink-0" />
                      <TypeBadge type={child.type} size="xs" />
                      <span className="text-sm text-slate-700 flex-1">{child.name}</span>
                      {child.memberships.length > 0 && <span className="text-xs text-slate-400">{child.memberships.length}m</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              onClick={handleGroup}
              disabled={saving || !grName.trim() || grSelected.size === 0}
              className="w-full py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-60 bg-purple-600 hover:bg-purple-700 transition-colors"
            >
              {saving ? "Creating…" : `Create group with ${grSelected.size} unit${grSelected.size !== 1 ? "s" : ""}`}
            </button>
          </div>
        </Modal>
      )}

      {/* Move */}
      {activeModal?.kind === "move" && (
        <Modal title={`Move "${activeModal.unit.name}" to…`} wide onClose={() => setActiveModal(null)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Select a new parent. The unit and all its descendants will be reparented there.
            </p>

            <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
              {moveTargets.map(u => {
                const expectedChild = CHILD_TYPE[u.type];
                const compatible = !expectedChild || expectedChild === activeModal.unit.type;
                return (
                  <button
                    type="button"
                    key={u.id}
                    onClick={() => setMvTargetId(u.id)}
                    className={`w-full flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                      mvTargetId === u.id ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <TypeBadge type={u.type} size="xs" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-700">{u.name}</p>
                      <p className="text-xs text-slate-400">{TYPE_LABEL[u.type]}</p>
                    </div>
                    {!compatible && (
                      <span className="text-xs text-amber-500 flex-shrink-0">⚠ type mismatch</span>
                    )}
                    {mvTargetId === u.id && <span className="text-blue-500">✓</span>}
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleMove}
              disabled={saving || !mvTargetId}
              className="w-full py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-60 bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              {saving ? "Moving…" : "Confirm Move"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
