"use client";
import { useEffect, useState, useCallback, useMemo, useRef, WheelEvent } from "react";
import { motion, AnimatePresence, useSpring, useTransform } from "framer-motion";
import {
  Church, MapPin, GitBranch, Users, Network, Grid3X3, Leaf,
  Plus, Scissors, Layers, MoveRight, Trash2, Search, ChevronDown, ChevronUp,
  X, Check, AlertTriangle, RefreshCw, UserCircle2, Building2, ArrowRightLeft,
  ChevronRight, Maximize2, Minimize2, ZoomIn, ZoomOut, Target, Focus,
  Crosshair, CornerUpLeft, Eye, EyeOff, Filter,
} from "lucide-react";
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

const TYPE_ICON: Record<UnitType, React.ElementType> = {
  CHURCH: Church, ZONE: MapPin, BRANCH: GitBranch,
  MC: Network, BC: Grid3X3, CELL: Layers, SHEPHERD: Leaf,
};

const ALL_TYPES: UnitType[] = ["CHURCH", "ZONE", "BRANCH", "MC", "BC", "CELL", "SHEPHERD"];

interface RawUnit {
  id: string; name: string; type: UnitType;
  parentId?: string | null; ancestors: string[];
  memberships: { id: string }[];
  leaderships: { id: string; role: string; userId: string }[];
}
interface OrgUnit extends RawUnit { children: OrgUnit[]; }
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
    if (unit.parentId && map.has(unit.parentId)) map.get(unit.parentId)!.children.push(unit);
    else roots.push(unit);
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
    const r = findInTree(u.children, id);
    if (r) return r;
  }
  return null;
}

function getAncestorIds(units: OrgUnit[], targetId: string): string[] {
  for (const u of units) {
    if (u.id === targetId) return [u.id];
    const path = getAncestorIds(u.children, targetId);
    if (path.length) return [u.id, ...path];
  }
  return [];
}

// ── Motion variants ────────────────────────────────────────────────────────────

const scaleIn = {
  initial: { opacity: 0, scale: 0.88, y: 6 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.88, y: -6 },
};

const drawerV = {
  closed: { x: "100%", opacity: 0 },
  open:   { x: 0, opacity: 1 },
};

// ── TypePicker ─────────────────────────────────────────────────────────────────

function TypePicker({ value, onChange }: { value: UnitType; onChange: (t: UnitType) => void }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {ALL_TYPES.map(t => {
        const Icon = TYPE_ICON[t];
        const on = value === t;
        return (
          <motion.button key={t} type="button" onClick={() => onChange(t)} whileTap={{ scale: 0.94 }}
            className={`flex flex-col items-center gap-1.5 py-2.5 rounded-xl text-[11px] font-bold border-2 transition-colors ${on ? "border-transparent text-white" : "bg-white border-slate-100 text-slate-500 hover:border-slate-200"}`}
            style={on ? { background: TYPE_COLOR[t], boxShadow: `0 4px 14px ${TYPE_COLOR[t]}55` } : {}}>
            <Icon size={13} />
            {t === "SHEPHERD" ? "SHPD" : t === "MC" ? "M-CTR" : t === "BC" ? "B-CTR" : t}
          </motion.button>
        );
      })}
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function Modal({ title, icon: Icon, wide, onClose, children }: {
  title: string; icon?: React.ElementType; wide?: boolean; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
        <div className="absolute inset-0 bg-slate-900/65 backdrop-blur-sm" />
        <motion.div
          className={`relative bg-white rounded-2xl shadow-2xl w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[90vh] overflow-hidden flex flex-col`}
          variants={scaleIn} initial="initial" animate="animate" exit="exit"
          transition={{ type: "spring", stiffness: 420, damping: 32 }}
          onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 shrink-0">
            {Icon && <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center text-slate-500"><Icon size={17} /></div>}
            <h3 className="text-[15px] font-semibold text-slate-800 flex-1">{title}</h3>
            <motion.button onClick={onClose} whileHover={{ rotate: 90, scale: 1.1 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100">
              <X size={15} />
            </motion.button>
          </div>
          <div className="p-6 overflow-y-auto flex-1">{children}</div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── ActionBtn ─────────────────────────────────────────────────────────────────

function ActionBtn({ icon: Icon, label, sublabel, onClick, danger, disabled, accent }: {
  icon: React.ElementType; label: string; sublabel?: string; onClick: () => void;
  danger?: boolean; disabled?: boolean; accent?: string;
}) {
  return (
    <motion.button type="button" onClick={onClick} disabled={disabled}
      whileHover={{ x: 3 }} whileTap={{ scale: 0.97 }}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
        danger ? "bg-red-50 border-red-100 text-red-600 hover:bg-red-100" : "bg-slate-50 border-slate-100 text-slate-700 hover:bg-slate-100"
      }`}>
      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: danger ? "#fee2e2" : accent ? `${accent}18` : "#f1f5f9" }}>
        <Icon size={14} style={{ color: danger ? "#ef4444" : accent ?? "#64748b" }} />
      </div>
      <div className="flex-1 text-left leading-tight">
        <p className="font-semibold">{label}</p>
        {sublabel && <p className="text-[10px] text-slate-400 mt-0.5">{sublabel}</p>}
      </div>
      <ChevronRight size={13} className="text-slate-300" />
    </motion.button>
  );
}

// ── OrgCard ───────────────────────────────────────────────────────────────────

type CardMode = "normal" | "source" | "target" | "dimmed" | "path";

function OrgCard({ unit, mode, onClick }: { unit: OrgUnit; mode: CardMode; onClick: () => void }) {
  const color = TYPE_COLOR[unit.type];
  const Icon = TYPE_ICON[unit.type] ?? Building2;
  const leader = unit.leaderships[0];
  const isSelected = mode === "path";
  const isSource  = mode === "source";
  const isTarget  = mode === "target";
  const isDimmed  = mode === "dimmed";

  const boxShadow = isSelected
    ? `0 12px 32px -4px ${color}55, 0 0 0 3px white, 0 0 0 5px ${color}bb`
    : isSource
    ? `0 0 0 3px white, 0 0 0 5px ${color}, 0 8px 24px ${color}44`
    : isTarget
    ? `0 0 0 3px white, 0 0 0 5px #3b82f6, 0 8px 24px #3b82f640`
    : "0 2px 10px rgba(0,0,0,.07), 0 0 0 1px rgba(0,0,0,.04)";

  const bg = isSelected
    ? `linear-gradient(145deg, ${color}ee, ${color})`
    : isSource
    ? `linear-gradient(145deg, ${color}22, ${color}10)`
    : isTarget
    ? "linear-gradient(145deg, #eff6ff, #dbeafe)"
    : "white";

  return (
    <motion.div
      layout
      onClick={onClick}
      animate={{
        opacity: isDimmed ? 0.22 : 1,
        scale: isSource ? 1.06 : isTarget ? 1.03 : isSelected ? 1.05 : 1,
        y: isSelected || isSource ? -2 : 0,
      }}
      whileHover={isDimmed ? {} : { y: -3, scale: (isSource || isSelected) ? undefined : 1.03 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 480, damping: 36 }}
      className="relative overflow-hidden cursor-pointer rounded-2xl"
      style={{ width: 168, background: bg, boxShadow }}
    >
      {/* Top stripe */}
      <div className="h-1.5 w-full" style={{ background: color }} />

      {/* Source / target indicator badge */}
      {isSource && (
        <div className="absolute top-3 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold text-white" style={{ background: color }}>
          <Crosshair size={8} /> MOVING
        </div>
      )}
      {isTarget && (
        <motion.div className="absolute top-3 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold text-blue-600 bg-blue-100"
          animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 1.2, repeat: Infinity }}>
          <Target size={8} /> DROP HERE
        </motion.div>
      )}

      {/* Icon + type label */}
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: isSelected ? "rgba(255,255,255,.22)" : `${color}20` }}>
          <Icon size={12} style={{ color: isSelected ? "white" : color }} />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider truncate"
          style={{ color: isSelected ? "rgba(255,255,255,.75)" : color }}>
          {TYPE_LABEL[unit.type]}
        </span>
      </div>

      {/* Name */}
      <p className={`px-3 text-[13px] font-bold leading-snug ${isSelected ? "text-white" : "text-slate-800"}`}
        style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {unit.name}
      </p>

      {/* Leader */}
      {leader && (
        <div className={`flex items-center gap-1.5 px-3 mt-1.5 ${isSelected ? "text-white/60" : "text-slate-400"}`}>
          <UserCircle2 size={10} />
          <p className="text-[10px] truncate">{leader.role}</p>
        </div>
      )}

      {/* Counts */}
      <div className={`flex items-center gap-3 px-3 pb-3 mt-1 text-[10px] ${isSelected ? "text-white/50" : "text-slate-400"}`}>
        {unit.memberships.length > 0 && (
          <span className="flex items-center gap-1"><Users size={9} />{unit.memberships.length}</span>
        )}
        {unit.children.length > 0 && (
          <span className="flex items-center gap-1"><Network size={9} />{unit.children.length}</span>
        )}
      </div>

      {/* Selected shimmer sweep */}
      {isSelected && (
        <motion.div className="absolute inset-0 pointer-events-none"
          animate={{ x: ["-100%", "200%"] }} transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", repeatDelay: 1 }}
          style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,.15), transparent)", width: "60%" }} />
      )}
    </motion.div>
  );
}

// ── OrgTree (recursive) ────────────────────────────────────────────────────────

function OrgTree({
  unit, depth, selectedId, expandedIds, onSelect, onToggle, searchQuery,
  moveSourceId, moveTargetIds, onMoveTarget, focusPath, staggerIndex = 0,
}: {
  unit: OrgUnit; depth: number; selectedId: string | null;
  expandedIds: Set<string>; onSelect: (u: OrgUnit) => void; onToggle: (id: string) => void;
  searchQuery: string; moveSourceId: string | null; moveTargetIds: Set<string> | null;
  onMoveTarget: (u: OrgUnit) => void; focusPath: Set<string>; staggerIndex?: number;
}) {
  const isExpanded = expandedIds.has(unit.id);
  const color = TYPE_COLOR[unit.type];

  // Card mode logic
  let mode: CardMode = "normal";
  if (moveSourceId) {
    if (unit.id === moveSourceId)               mode = "source";
    else if (moveTargetIds?.has(unit.id))       mode = "target";
    else                                         mode = "dimmed";
  } else if (selectedId === unit.id)            mode = "path";
  else if (searchQuery && !unit.name.toLowerCase().includes(searchQuery.toLowerCase())) mode = "dimmed";

  // Search filter
  const hasMatch = searchQuery
    ? flattenTree(unit).some(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : true;
  if (!hasMatch) return null;

  const visibleChildren = isExpanded
    ? unit.children.filter(c =>
        !searchQuery || flattenTree(c).some(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : [];

  const handleClick = () => {
    if (moveSourceId && moveTargetIds?.has(unit.id)) onMoveTarget(unit);
    else if (!moveSourceId) onSelect(unit);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: staggerIndex * 0.04, type: "spring", stiffness: 400, damping: 30 }}
      className="flex flex-col items-center"
      style={{ minWidth: 168 }}
    >
      {/* Card */}
      <div className="relative">
        <OrgCard unit={unit} mode={mode} onClick={handleClick} />

        {/* Expand toggle */}
        {unit.children.length > 0 && !moveSourceId && (
          <motion.button type="button" onClick={e => { e.stopPropagation(); onToggle(unit.id); }}
            whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.85 }}
            className="absolute -bottom-4 left-1/2 -translate-x-1/2 z-10 w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-md"
            style={{ boxShadow: `0 2px 12px rgba(0,0,0,.1), 0 0 0 1px rgba(0,0,0,.04)` }}>
            <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ type: "spring", stiffness: 400, damping: 28 }}>
              <ChevronDown size={12} className="text-slate-500" />
            </motion.div>
            {/* Child count badge */}
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-white flex items-center justify-center text-[8px] font-black shadow"
              style={{ background: color }}>
              {unit.children.length}
            </span>
          </motion.button>
        )}
      </div>

      {/* Children */}
      <AnimatePresence initial={false}>
        {visibleChildren.length > 0 && (
          <motion.div key="children"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
            className="flex flex-col items-center overflow-hidden"
          >
            {/* Vertical stem colored by parent */}
            <div className="w-px" style={{ height: 28, background: `${color}60` }} />

            {/* Children row */}
            <div className="flex items-start">
              {visibleChildren.map((child, i) => {
                const isFirst = i === 0;
                const isLast  = i === visibleChildren.length - 1;
                const isOnly  = visibleChildren.length === 1;
                const childColor = TYPE_COLOR[child.type] ?? "#e2e8f0";

                return (
                  <div key={child.id} className="relative flex flex-col items-center" style={{ paddingLeft: 16, paddingRight: 16 }}>
                    {/* Horizontal bridge colored by this child's type */}
                    {!isOnly && (
                      <div className="absolute" style={{
                        top: 0, height: 1,
                        left: isFirst ? "50%" : 0,
                        right: isLast ? "50%" : 0,
                        background: `${color}50`,
                      }} />
                    )}
                    {/* Vertical drop in child's color */}
                    <div className="w-px" style={{ height: 20, background: `${childColor}60` }} />
                    <OrgTree
                      unit={child} depth={depth + 1} selectedId={selectedId}
                      expandedIds={expandedIds} onSelect={onSelect} onToggle={onToggle}
                      searchQuery={searchQuery} moveSourceId={moveSourceId}
                      moveTargetIds={moveTargetIds} onMoveTarget={onMoveTarget}
                      focusPath={focusPath} staggerIndex={i}
                    />
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Types for active modal ─────────────────────────────────────────────────────

type ActiveModal =
  | { kind: "create"; parentId: string | null; suggested: UnitType }
  | { kind: "split";  unit: OrgUnit }
  | { kind: "group";  unit: OrgUnit }
  | { kind: "rename"; unit: OrgUnit };

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function UnitsPage() {
  const [allUnits, setAllUnits]     = useState<RawUnit[]>([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [errorMsg, setErrorMsg]     = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const initialDone = useRef(false);

  // Selection & detail
  const [selectedId, setSelectedId]     = useState<string | null>(null);
  const [detailUnit, setDetailUnit]     = useState<DetailedUnit | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Canvas controls
  const [zoom, setZoom]         = useState(1);
  const [focusId, setFocusId]   = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const canvasRef = useRef<HTMLDivElement>(null);

  // Move mode
  const [moveSource, setMoveSource] = useState<OrgUnit | null>(null);

  // Modals
  const [activeModal, setActiveModal] = useState<ActiveModal | null>(null);
  const [cName, setCName]       = useState("");
  const [cType, setCType]       = useState<UnitType>("ZONE");
  const [spNameA, setSpNameA]   = useState("");
  const [spNameB, setSpNameB]   = useState("");
  const [spGroupA, setSpGroupA] = useState<Set<string>>(new Set());
  const [grName, setGrName]     = useState("");
  const [grType, setGrType]     = useState<UnitType>("BC");
  const [grSelected, setGrSelected] = useState<Set<string>>(new Set());

  // ── Data ─────────────────────────────────────────────────────────────────────

  const loadUnits = useCallback(async () => {
    setLoading(true); setErrorMsg("");
    try {
      const data = await apiFetch<RawUnit[]>("/organizational-units");
      setAllUnits(data);
      if (!initialDone.current) {
        setExpandedIds(new Set(buildTree(data).map(r => r.id)));
        initialDone.current = true;
      }
    } catch { setErrorMsg("Failed to load units."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadUnits(); }, [loadUnits]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true); setDetailUnit(null);
    try { setDetailUnit(await apiFetch<DetailedUnit>(`/organizational-units/${id}`)); }
    catch { /* silent */ }
    finally { setDetailLoading(false); }
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────────

  const tree = useMemo(() => buildTree(allUnits), [allUnits]);

  const displayTree = useMemo(() => {
    if (!focusId) return tree;
    const node = findInTree(tree, focusId);
    return node ? [node] : tree;
  }, [tree, focusId]);

  const selectedTreeUnit = useMemo(() => selectedId ? findInTree(tree, selectedId) : null, [tree, selectedId]);
  const selectedRaw      = useMemo(() => allUnits.find(u => u.id === selectedId) ?? null, [allUnits, selectedId]);

  const typeCount = useMemo(() => {
    const c: Partial<Record<UnitType, number>> = {};
    allUnits.forEach(u => { c[u.type] = (c[u.type] ?? 0) + 1; });
    return c;
  }, [allUnits]);

  // Ancestors of selected node (for breadcrumb / path highlight)
  const selectedPath = useMemo(() =>
    selectedId ? new Set(getAncestorIds(tree, selectedId)) : new Set<string>(),
    [tree, selectedId]
  );

  // Breadcrumb from root to focused/selected
  const breadcrumb = useMemo(() => {
    const targetId = focusId ?? selectedId;
    if (!targetId) return [];
    const path = getAncestorIds(tree, targetId);
    return path.map(id => allUnits.find(u => u.id === id)).filter(Boolean) as RawUnit[];
  }, [tree, focusId, selectedId, allUnits]);

  // Valid move targets for move mode
  const moveTargetIds = useMemo(() => {
    if (!moveSource) return null;
    const descendants = new Set(flattenTree(moveSource as OrgUnit).map(u => u.id));
    return new Set(allUnits.filter(u =>
      u.id !== moveSource.id &&
      !descendants.has(u.id) &&
      u.id !== moveSource.parentId
    ).map(u => u.id));
  }, [moveSource, allUnits]);

  const leader    = detailUnit?.leaderships[0] ?? null;
  const color     = selectedTreeUnit ? TYPE_COLOR[selectedTreeUnit.type] : "#121D55";
  const TypeIcon  = selectedTreeUnit ? TYPE_ICON[selectedTreeUnit.type] : Building2;
  const suggested = selectedTreeUnit ? CHILD_TYPE[selectedTreeUnit.type] ?? null : null;

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const handleSelect = useCallback((unit: OrgUnit) => {
    setSelectedId(unit.id);
    loadDetail(unit.id);
  }, [loadDetail]);

  const handleToggle = useCallback((id: string) => {
    setExpandedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  const handleZoom = (delta: number) => {
    setZoom(z => Math.min(1.6, Math.max(0.4, Math.round((z + delta) * 10) / 10)));
  };

  const handleWheel = useCallback((e: WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      handleZoom(e.deltaY < 0 ? 0.1 : -0.1);
    }
  }, []);

  const handleMoveTarget = async (target: OrgUnit) => {
    if (!moveSource) return;
    setSaving(true); setErrorMsg("");
    try {
      await apiPost(`/organizational-units/${target.id}/children`, { childId: moveSource.id });
      setMoveSource(null);
      setExpandedIds(prev => new Set([...prev, target.id]));
      await loadUnits();
      loadDetail(moveSource.id);
    } catch (e) { setErrorMsg(e instanceof Error ? e.message : "Move failed."); setMoveSource(null); }
    finally { setSaving(false); }
  };

  // CRUD
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
      setActiveModal(null); await loadUnits();
      if (activeModal.parentId) setExpandedIds(prev => new Set([...prev, activeModal.parentId!]));
      setSelectedId(created.id); loadDetail(created.id);
    } catch (e) { setErrorMsg(e instanceof Error ? e.message : "Failed."); }
    finally { setSaving(false); }
  };

  const handleRename = async (newName: string) => {
    if (!selectedId || !newName.trim()) return;
    setSaving(true); setErrorMsg("");
    try {
      await apiPatch(`/organizational-units/${selectedId}`, { name: newName.trim() });
      setActiveModal(null); await loadUnits(); loadDetail(selectedId);
    } catch (e) { setErrorMsg(e instanceof Error ? e.message : "Rename failed."); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!selectedTreeUnit || selectedTreeUnit.children.length > 0) return;
    if (!confirm(`Delete "${selectedTreeUnit.name}"?`)) return;
    setSaving(true); setErrorMsg("");
    try {
      await apiDelete(`/organizational-units/${selectedId}`);
      setSelectedId(null); setDetailUnit(null); await loadUnits();
    } catch (e) { setErrorMsg(e instanceof Error ? e.message : "Delete failed."); }
    finally { setSaving(false); }
  };

  const openSplit = () => {
    if (!selectedTreeUnit || selectedTreeUnit.children.length < 2) return;
    setSpNameA(`${selectedTreeUnit.name} A`);
    setSpNameB(`${selectedTreeUnit.name} B`);
    setSpGroupA(new Set(selectedTreeUnit.children.slice(0, Math.ceil(selectedTreeUnit.children.length / 2)).map(c => c.id)));
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
      setActiveModal(null); setSelectedId(newA.id); await loadUnits(); loadDetail(newA.id);
    } catch (e) { setErrorMsg(e instanceof Error ? e.message : "Split failed."); }
    finally { setSaving(false); }
  };

  const openGroup = () => {
    if (!selectedTreeUnit || selectedTreeUnit.children.length < 2) return;
    const s = CHILD_TYPE[selectedTreeUnit.children[0]?.type ?? selectedTreeUnit.type] ?? "CELL";
    setGrName(""); setGrType(s as UnitType); setGrSelected(new Set());
    setActiveModal({ kind: "group", unit: selectedTreeUnit });
  };

  const handleGroup = async () => {
    if (activeModal?.kind !== "group") return;
    const { unit } = activeModal;
    if (!grName.trim() || grSelected.size === 0) return;
    setSaving(true); setErrorMsg("");
    try {
      const np = await apiPost<{ id: string }>("/organizational-units", { name: grName.trim(), type: grType, parentId: unit.id });
      await Promise.all([...grSelected].map(childId => apiPost(`/organizational-units/${np.id}/children`, { childId })));
      setActiveModal(null);
      setExpandedIds(prev => new Set([...prev, unit.id, np.id]));
      setSelectedId(np.id); await loadUnits(); loadDetail(np.id);
    } catch (e) { setErrorMsg(e instanceof Error ? e.message : "Group failed."); }
    finally { setSaving(false); }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full" style={{ maxHeight: "calc(100vh - 64px)" }}>
      <Header title="Org Chart" subtitle={`${allUnits.length} units · ${Object.keys(typeCount).length} levels`} />

      {/* ── Error toast ── */}
      <AnimatePresence>
        {errorMsg && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="mx-6 mt-3 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm flex items-center gap-2.5 shrink-0">
            <AlertTriangle size={14} className="shrink-0 text-red-400" />
            <span className="flex-1">{errorMsg}</span>
            <button onClick={() => setErrorMsg("")}><X size={13} className="text-red-300 hover:text-red-500" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Move Mode Banner ── */}
      <AnimatePresence>
        {moveSource && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="mx-6 mt-3 px-4 py-3 rounded-xl border flex items-center gap-3 shrink-0"
            style={{ background: `${TYPE_COLOR[moveSource.type]}10`, borderColor: `${TYPE_COLOR[moveSource.type]}40` }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{ background: TYPE_COLOR[moveSource.type] }}>
              {(() => { const I = TYPE_ICON[moveSource.type]; return <I size={14} />; })()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-700">Moving <span style={{ color: TYPE_COLOR[moveSource.type] }}>{moveSource.name}</span></p>
              <p className="text-xs text-slate-400">Click any highlighted card to move this branch there</p>
            </div>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={() => setMoveSource(null)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50">
              <X size={11} /> Cancel
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Toolbar ── */}
      <div className="px-6 py-3 flex items-center gap-2 border-b border-slate-100 bg-white/80 backdrop-blur-sm shrink-0 flex-wrap">

        {/* Breadcrumb / focus path */}
        {breadcrumb.length > 1 ? (
          <div className="flex items-center gap-1 text-xs text-slate-400 min-w-0 flex-1 overflow-hidden">
            {focusId && (
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setFocusId(null); setSelectedId(null); setDetailUnit(null); }}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 mr-1 shrink-0">
                <CornerUpLeft size={11} /> Exit focus
              </motion.button>
            )}
            {breadcrumb.map((u, i) => {
              const UIcon = TYPE_ICON[u.type as UnitType];
              return (
                <span key={u.id} className="flex items-center gap-1 shrink-0">
                  {i > 0 && <ChevronRight size={10} className="text-slate-300" />}
                  <button onClick={() => { setSelectedId(u.id); loadDetail(u.id); }}
                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded-lg transition-colors ${u.id === selectedId ? "font-bold text-slate-700" : "hover:bg-slate-100"}`}>
                    <UIcon size={10} style={{ color: TYPE_COLOR[u.type as UnitType] }} />
                    <span className="max-w-24 truncate">{u.name}</span>
                  </button>
                </span>
              );
            })}
          </div>
        ) : (
          /* Type pills */
          <div className="flex gap-1.5 flex-1 flex-wrap">
            {ALL_TYPES.filter(t => typeCount[t]).map(t => {
              const TIcon = TYPE_ICON[t];
              return (
                <div key={t} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold text-white"
                  style={{ background: TYPE_COLOR[t], boxShadow: `0 2px 6px ${TYPE_COLOR[t]}44` }}>
                  <TIcon size={9} />
                  {TYPE_LABEL[t]} <span className="opacity-75 ml-0.5">{typeCount[t]}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Search */}
        <div className="relative shrink-0">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input type="text" placeholder="Search…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-sm rounded-xl border border-slate-200 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 w-40 transition-all" />
          <AnimatePresence>
            {searchQuery && (
              <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                <X size={11} className="text-slate-400 hover:text-slate-700" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Expand / Collapse */}
        <div className="flex gap-1 shrink-0">
          <motion.button whileTap={{ scale: 0.93 }} onClick={() => setExpandedIds(new Set(allUnits.map(u => u.id)))}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-500 bg-slate-50 border border-slate-100 hover:bg-slate-100">
            <Maximize2 size={11} /> All
          </motion.button>
          <motion.button whileTap={{ scale: 0.93 }} onClick={() => setExpandedIds(new Set(tree.map(r => r.id)))}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-500 bg-slate-50 border border-slate-100 hover:bg-slate-100">
            <Minimize2 size={11} /> Collapse
          </motion.button>
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-1 bg-slate-50 border border-slate-100 rounded-xl px-1 shrink-0">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleZoom(-0.1)}
            className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-200">
            <ZoomOut size={13} />
          </motion.button>
          <span className="text-xs font-bold text-slate-500 w-9 text-center">{Math.round(zoom * 100)}%</span>
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleZoom(0.1)}
            className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-200">
            <ZoomIn size={13} />
          </motion.button>
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => setZoom(1)}
            className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 text-[10px] font-bold">
            1:1
          </motion.button>
        </div>

        {/* Refresh */}
        <motion.button whileTap={{ scale: 0.9 }} onClick={loadUnits}
          className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 border border-slate-100">
          <motion.div animate={loading ? { rotate: 360 } : {}} transition={loading ? { duration: 1, repeat: Infinity, ease: "linear" } : {}}>
            <RefreshCw size={13} />
          </motion.div>
        </motion.button>

        {/* New unit */}
        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          onClick={() => openCreate(null, "CHURCH")}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-lg shrink-0"
          style={{ background: "linear-gradient(135deg, #1e3a8a, #121D55)", boxShadow: "0 4px 14px rgba(18,29,85,.35)" }}>
          <Plus size={14} /> New unit
        </motion.button>
      </div>

      {/* ── Canvas + Drawer ── */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* Chart canvas */}
        <div ref={canvasRef}
          className="flex-1 overflow-auto"
          style={{ background: "radial-gradient(circle, #cbd5e1 1px, transparent 1px)", backgroundSize: "28px 28px", backgroundColor: "#f1f5f9" }}
          onWheel={handleWheel}
          onClick={() => { if (!moveSource) { setSelectedId(null); setDetailUnit(null); } }}
        >
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}>
                  <RefreshCw size={28} className="text-slate-300" />
                </motion.div>
                <p className="text-sm font-medium">Loading org chart…</p>
              </motion.div>
            ) : tree.length === 0 ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center h-full gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white shadow-md flex items-center justify-center">
                  <Church size={28} className="text-slate-300" />
                </div>
                <p className="text-slate-400 text-sm font-medium">No units yet</p>
                <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  onClick={() => openCreate(null, "CHURCH")}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
                  style={{ background: "linear-gradient(135deg, #1e3a8a, #121D55)", boxShadow: "0 4px 14px rgba(18,29,85,.35)" }}>
                  <Plus size={14} /> Create Church
                </motion.button>
              </motion.div>
            ) : (
              <motion.div key="tree" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
                className="flex gap-16 justify-start items-start p-12 min-w-max pb-20"
                style={{ transform: `scale(${zoom})`, transformOrigin: "top left", transition: "transform 0.2s ease" }}
                onClick={e => e.stopPropagation()}>
                {displayTree.map(root => (
                  <OrgTree key={root.id} unit={root} depth={0}
                    selectedId={selectedId} expandedIds={expandedIds}
                    onSelect={handleSelect} onToggle={handleToggle}
                    searchQuery={searchQuery} moveSourceId={moveSource?.id ?? null}
                    moveTargetIds={moveTargetIds} onMoveTarget={handleMoveTarget}
                    focusPath={selectedPath} staggerIndex={0}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Detail Drawer ── */}
        <AnimatePresence>
          {selectedTreeUnit && !moveSource && (
            <motion.aside key="drawer" variants={drawerV} initial="closed" animate="open" exit="closed"
              transition={{ type: "spring", stiffness: 340, damping: 34 }}
              className="w-80 shrink-0 bg-white border-l border-slate-100 overflow-y-auto"
              style={{ boxShadow: "-6px 0 32px rgba(0,0,0,.08)" }}>
              <div className="p-6 space-y-5">

                {/* Close */}
                <div className="flex justify-end">
                  <motion.button whileHover={{ rotate: 90 }} transition={{ type: "spring", stiffness: 400, damping: 22 }}
                    onClick={() => { setSelectedId(null); setDetailUnit(null); }}
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                    <X size={16} />
                  </motion.button>
                </div>

                {/* Hero */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center text-center gap-3">
                  <motion.div layoutId={`hero-${selectedTreeUnit.id}`}
                    className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl"
                    style={{ background: `linear-gradient(145deg, ${color}dd, ${color})`, boxShadow: `0 8px 28px ${color}44` }}>
                    <TypeIcon size={26} className="text-white" />
                  </motion.div>

                  <div>
                    <p className="text-lg font-bold text-slate-800 leading-tight">{selectedTreeUnit.name}</p>
                    <span className="inline-flex items-center gap-1.5 mt-1.5 text-xs font-bold px-3 py-1 rounded-full text-white"
                      style={{ background: `linear-gradient(135deg, ${color}cc, ${color})` }}>
                      <TypeIcon size={10} /> {TYPE_LABEL[selectedTreeUnit.type]}
                    </span>
                  </div>

                  {/* Stats row */}
                  {selectedRaw && (
                    <div className="flex gap-3 w-full">
                      {[
                        { label: "Members", val: selectedRaw.memberships.length },
                        { label: "Sub-units", val: selectedTreeUnit.children.length },
                        { label: "Depth", val: selectedTreeUnit.ancestors.length },
                      ].map(s => (
                        <div key={s.label} className="flex-1 bg-slate-50 rounded-xl py-2 px-1 border border-slate-100">
                          <p className="text-base font-bold text-slate-700">{s.val}</p>
                          <p className="text-[10px] text-slate-400 font-medium">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>

                {/* Leader */}
                {detailLoading ? (
                  <div className="h-16 rounded-xl bg-slate-50 animate-pulse border border-slate-100" />
                ) : leader ? (
                  <div className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-100 bg-slate-50/60">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0"
                      style={{ background: `linear-gradient(145deg, ${color}cc, ${color})`, boxShadow: `0 4px 12px ${color}44` }}>
                      {leader.user.firstName[0]}{leader.user.lastName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-700 truncate">{leader.user.firstName} {leader.user.lastName}</p>
                      <p className="text-[10px] text-slate-400 truncate">{leader.role}</p>
                      <p className="text-[10px] text-slate-400 truncate">{leader.user.email}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-3.5 rounded-xl border border-dashed border-slate-200">
                    <UserCircle2 size={26} className="text-slate-200 shrink-0" />
                    <p className="text-xs text-slate-400">No leader assigned</p>
                  </div>
                )}

                {/* Parent breadcrumb */}
                {detailUnit?.parent && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-500">
                    <ChevronUp size={11} className="text-slate-300 shrink-0" />
                    <span className="text-slate-400">Parent:</span>
                    <span className="font-semibold text-slate-600 truncate">{detailUnit.parent.name}</span>
                    <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
                      style={{ background: TYPE_COLOR[detailUnit.parent.type] }}>
                      {TYPE_LABEL[detailUnit.parent.type]}
                    </span>
                  </div>
                )}

                <div className="h-px bg-slate-100" />

                {/* Actions */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-1 mb-3">Actions</p>

                  {suggested && (
                    <ActionBtn icon={Plus} label={`Add ${TYPE_LABEL[suggested]}`}
                      sublabel="Create a child unit under this one"
                      accent={color} onClick={() => openCreate(selectedTreeUnit.id, suggested)} />
                  )}

                  <ActionBtn icon={Eye} label="Focus this branch"
                    sublabel="Zoom in — show only this subtree"
                    accent="#6366f1"
                    onClick={() => { setFocusId(selectedId); setExpandedIds(new Set(flattenTree(selectedTreeUnit).map(u => u.id))); }} />

                  <ActionBtn icon={Scissors} label="Split unit"
                    sublabel={`Divide into 2 — requires ≥2 children (${selectedTreeUnit.children.length})`}
                    accent="#f59e0b"
                    onClick={openSplit}
                    disabled={selectedTreeUnit.children.length < 2} />

                  <ActionBtn icon={Layers} label="Group children"
                    sublabel={`Bundle selected children under a new unit`}
                    accent="#8b5cf6"
                    onClick={openGroup}
                    disabled={selectedTreeUnit.children.length < 2} />

                  {selectedTreeUnit.parentId && (
                    <ActionBtn icon={ArrowRightLeft} label="Move branch"
                      sublabel="Click a destination on the chart"
                      accent="#3b82f6"
                      onClick={() => { setMoveSource(selectedTreeUnit); setSelectedId(null); setDetailUnit(null); }} />
                  )}

                  <ActionBtn icon={svg => (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  )} label="Rename"
                    sublabel="Change the name of this unit"
                    onClick={() => setActiveModal({ kind: "rename", unit: selectedTreeUnit })} />

                  {selectedTreeUnit.children.length === 0 && (
                    <ActionBtn icon={Trash2} label="Delete unit"
                      sublabel="Permanently remove this leaf unit"
                      onClick={handleDelete} disabled={saving} danger />
                  )}
                </div>

                {selectedTreeUnit.children.length > 0 && (
                  <p className="text-[10px] text-slate-300 text-center leading-snug">
                    Remove all {selectedTreeUnit.children.length} sub-unit{selectedTreeUnit.children.length > 1 ? "s" : ""} first to enable delete.
                  </p>
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* ══ MODALS ══ */}

      {activeModal?.kind === "create" && (
        <Modal title={activeModal.parentId ? "Add child unit" : "Create root unit"} icon={Plus} onClose={() => setActiveModal(null)}>
          <div className="space-y-5">
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-2">Unit name</label>
              <input value={cName} onChange={e => setCName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleCreate()}
                placeholder="e.g. North Zone" autoFocus
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all" />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-2.5">Type</label>
              <TypePicker value={cType} onChange={setCType} />
              {activeModal.parentId && cType !== activeModal.suggested && (
                <p className="text-xs text-amber-500 mt-2 flex items-center gap-1.5">
                  <AlertTriangle size={11} /> Suggested: <strong>{activeModal.suggested}</strong>
                </p>
              )}
            </div>
            <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }} onClick={handleCreate} disabled={saving || !cName.trim()}
              className="w-full py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: `linear-gradient(135deg, ${TYPE_COLOR[cType]}ee, ${TYPE_COLOR[cType]})`, boxShadow: `0 6px 20px ${TYPE_COLOR[cType]}44` }}>
              {saving ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><RefreshCw size={14} /></motion.div> : <Plus size={14} />}
              {saving ? "Creating…" : `Create ${TYPE_LABEL[cType]}`}
            </motion.button>
          </div>
        </Modal>
      )}

      {activeModal?.kind === "rename" && (
        <RenameModal unit={activeModal.unit} onClose={() => setActiveModal(null)} onSave={handleRename} saving={saving} />
      )}

      {activeModal?.kind === "split" && (
        <Modal title={`Split "${activeModal.unit.name}"`} icon={Scissors} wide onClose={() => setActiveModal(null)}>
          <div className="space-y-5">
            <p className="text-sm text-slate-500 leading-relaxed">Two sibling units will be created at the same level and children redistributed. The original is removed.</p>
            <div className="grid grid-cols-2 gap-3">
              {[["Group A name", spNameA, setSpNameA], ["Group B name", spNameB, setSpNameB]].map(([label, val, set]) => (
                <div key={label as string}>
                  <label className="text-xs font-semibold text-slate-600 block mb-1.5">{label as string}</label>
                  <input value={val as string} onChange={e => (set as (v: string) => void)(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100" />
                </div>
              ))}
            </div>
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-xs font-semibold text-slate-600">Assign children (toggle A / B)</p>
                <div className="flex gap-3 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />A: {spGroupA.size}</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300" />B: {activeModal.unit.children.length - spGroupA.size}</span>
                </div>
              </div>
              <div className="space-y-1.5 max-h-56 overflow-y-auto rounded-xl border border-slate-100 p-2">
                {activeModal.unit.children.map(child => {
                  const inA = spGroupA.has(child.id);
                  const CI = TYPE_ICON[child.type];
                  return (
                    <motion.button type="button" key={child.id} whileTap={{ scale: 0.98 }}
                      onClick={() => setSpGroupA(prev => { const n = new Set(prev); n.has(child.id) ? n.delete(child.id) : n.add(child.id); return n; })}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all ${inA ? "border-amber-200 bg-amber-50" : "border-slate-100 hover:bg-slate-50"}`}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0" style={{ background: TYPE_COLOR[child.type] }}>
                        <CI size={12} />
                      </div>
                      <span className="text-sm text-slate-700 flex-1 text-left">{child.name}</span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full text-white ${inA ? "bg-amber-400" : "bg-slate-300"}`}>{inA ? "A" : "B"}</span>
                    </motion.button>
                  );
                })}
              </div>
            </div>
            <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }} onClick={handleSplit}
              disabled={saving || !spNameA.trim() || !spNameB.trim()}
              className="w-full py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600">
              {saving ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><RefreshCw size={14} /></motion.div> : <Scissors size={14} />}
              {saving ? "Splitting…" : "Confirm Split"}
            </motion.button>
          </div>
        </Modal>
      )}

      {activeModal?.kind === "group" && (
        <Modal title={`Group children of "${activeModal.unit.name}"`} icon={Layers} wide onClose={() => setActiveModal(null)}>
          <div className="space-y-5">
            <p className="text-sm text-slate-500 leading-relaxed">Selected children move under a new intermediate unit you name.</p>
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-2">New group name</label>
              <input value={grName} onChange={e => setGrName(e.target.value)} placeholder="e.g. East BC Cluster" autoFocus
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-2.5">Type</label>
              <TypePicker value={grType} onChange={setGrType} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-xs font-semibold text-slate-600">Select children to move</p>
                <span className="text-[11px] text-slate-400 font-medium">{grSelected.size} selected</span>
              </div>
              <div className="space-y-1.5 max-h-56 overflow-y-auto rounded-xl border border-slate-100 p-2">
                {activeModal.unit.children.map(child => {
                  const sel = grSelected.has(child.id);
                  const CI = TYPE_ICON[child.type];
                  return (
                    <motion.button type="button" key={child.id} whileTap={{ scale: 0.98 }}
                      onClick={() => setGrSelected(prev => { const n = new Set(prev); n.has(child.id) ? n.delete(child.id) : n.add(child.id); return n; })}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all ${sel ? "border-violet-200 bg-violet-50" : "border-slate-100 hover:bg-slate-50"}`}>
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${sel ? "bg-violet-500 border-violet-500" : "border-slate-200 bg-white"}`}>
                        {sel && <Check size={11} className="text-white" />}
                      </div>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0" style={{ background: TYPE_COLOR[child.type] }}>
                        <CI size={12} />
                      </div>
                      <span className="text-sm text-slate-700 flex-1">{child.name}</span>
                      {child.memberships.length > 0 && <span className="text-[10px] text-slate-400 flex items-center gap-1"><Users size={9} />{child.memberships.length}</span>}
                    </motion.button>
                  );
                })}
              </div>
            </div>
            <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }} onClick={handleGroup}
              disabled={saving || !grName.trim() || grSelected.size === 0}
              className="w-full py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg, #8b5cf6, #7c3aed)", boxShadow: "0 6px 20px #8b5cf644" }}>
              {saving ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><RefreshCw size={14} /></motion.div> : <Layers size={14} />}
              {saving ? "Creating…" : `Create group (${grSelected.size} units)`}
            </motion.button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Rename Modal (inline component) ───────────────────────────────────────────

function RenameModal({ unit, onClose, onSave, saving }: {
  unit: OrgUnit; onClose: () => void; onSave: (name: string) => void; saving: boolean;
}) {
  const [name, setName] = useState(unit.name);
  const color = TYPE_COLOR[unit.type];
  const Icon = TYPE_ICON[unit.type];
  return (
    <Modal title="Rename unit" icon={Icon} onClose={onClose}>
      <div className="space-y-5">
        <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: color }}>
            <Icon size={14} />
          </div>
          <div>
            <p className="text-xs text-slate-400">Renaming</p>
            <p className="text-sm font-semibold text-slate-700">{unit.name}</p>
          </div>
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-700 block mb-2">New name</label>
          <input value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") onSave(name); if (e.key === "Escape") onClose(); }}
            autoFocus
            className="w-full px-4 py-3 rounded-xl border-2 text-sm font-semibold outline-none transition-all"
            style={{ borderColor: color, boxShadow: `0 0 0 3px ${color}15` }} />
        </div>
        <div className="flex gap-2">
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => onSave(name)} disabled={saving || !name.trim() || name === unit.name}
            className="flex-1 py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: color, boxShadow: `0 4px 14px ${color}44` }}>
            {saving ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><RefreshCw size={14} /></motion.div> : <Check size={14} />}
            {saving ? "Saving…" : "Save"}
          </motion.button>
          <motion.button whileTap={{ scale: 0.97 }} onClick={onClose}
            className="px-5 py-3 rounded-xl text-sm font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200">
            Cancel
          </motion.button>
        </div>
      </div>
    </Modal>
  );
}
