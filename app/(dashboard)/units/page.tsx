"use client";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Church, MapPin, GitBranch, Users, Network, Grid3X3, Leaf,
  Plus, Scissors, Layers, MoveRight, Trash2, Search, ChevronDown,
  ChevronUp, X, Check, AlertTriangle, RefreshCw, ChevronsUpDown,
  UserCircle2, Building2, ArrowRightLeft, ChevronRight,
  Maximize2, Minimize2, ZoomIn, ZoomOut,
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

const TYPE_GRADIENT: Record<UnitType, string> = {
  CHURCH: "from-red-500 to-red-600",
  ZONE:   "from-cyan-500 to-cyan-600",
  BRANCH: "from-pink-500 to-pink-600",
  MC:     "from-amber-500 to-amber-600",
  BC:     "from-violet-500 to-violet-600",
  CELL:   "from-blue-500 to-blue-600",
  SHEPHERD: "from-emerald-500 to-emerald-600",
};

const TYPE_BG: Record<UnitType, string> = {
  CHURCH: "bg-red-50 border-red-100",
  ZONE:   "bg-cyan-50 border-cyan-100",
  BRANCH: "bg-pink-50 border-pink-100",
  MC:     "bg-amber-50 border-amber-100",
  BC:     "bg-violet-50 border-violet-100",
  CELL:   "bg-blue-50 border-blue-100",
  SHEPHERD: "bg-emerald-50 border-emerald-100",
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
    const found = findInTree(u.children, id);
    if (found) return found;
  }
  return null;
}

// ── Motion variants ────────────────────────────────────────────────────────────

const fadeIn = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

const scaleIn = {
  initial: { opacity: 0, scale: 0.92 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.92 },
};

const drawerVariants = {
  closed: { x: "100%", opacity: 0 },
  open: { x: 0, opacity: 1 },
};

const childrenVariants = {
  hidden: { opacity: 0, height: 0 },
  visible: { opacity: 1, height: "auto" },
};

// ── Type Picker ────────────────────────────────────────────────────────────────

function TypePicker({ value, onChange }: { value: UnitType; onChange: (t: UnitType) => void }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {ALL_TYPES.map(t => {
        const Icon = TYPE_ICON[t];
        const active = value === t;
        return (
          <motion.button key={t} type="button" onClick={() => onChange(t)} whileTap={{ scale: 0.95 }}
            className={`flex flex-col items-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border-2 transition-all ${
              active ? "border-transparent text-white shadow-lg" : "bg-white border-slate-100 text-slate-500 hover:border-slate-200"
            }`}
            style={active ? { background: `linear-gradient(135deg, ${TYPE_COLOR[t]}ee, ${TYPE_COLOR[t]})`, boxShadow: `0 4px 12px ${TYPE_COLOR[t]}44` } : {}}>
            <Icon size={14} />
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
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}>
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
        <motion.div
          className={`relative bg-white rounded-2xl shadow-2xl w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[90vh] overflow-hidden flex flex-col`}
          variants={scaleIn} initial="initial" animate="animate" exit="exit"
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 shrink-0">
            {Icon && (
              <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center text-slate-500 shrink-0">
                <Icon size={18} />
              </div>
            )}
            <h3 className="text-[15px] font-semibold text-slate-800 flex-1">{title}</h3>
            <motion.button onClick={onClose} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
              <X size={16} />
            </motion.button>
          </div>
          <div className="p-6 overflow-y-auto flex-1">{children}</div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Org Card ──────────────────────────────────────────────────────────────────

function OrgCard({ unit, selected, dimmed, onClick }: {
  unit: OrgUnit; selected: boolean; dimmed: boolean; onClick: () => void;
}) {
  const color = TYPE_COLOR[unit.type];
  const Icon = TYPE_ICON[unit.type] ?? Building2;
  const leader = unit.leaderships[0];

  return (
    <motion.div
      layout
      onClick={onClick}
      whileHover={{ y: -2, scale: selected ? 1.05 : 1.02 }}
      whileTap={{ scale: 0.98 }}
      animate={dimmed ? { opacity: 0.25 } : { opacity: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 35 }}
      className={`relative cursor-pointer overflow-hidden transition-shadow duration-300 rounded-2xl`}
      style={{
        width: 164,
        background: selected ? `linear-gradient(145deg, ${color}f0, ${color})` : "white",
        boxShadow: selected
          ? `0 12px 32px -4px ${color}55, 0 0 0 3px white, 0 0 0 5px ${color}bb, 0 4px 8px rgba(0,0,0,.08)`
          : "0 2px 8px rgba(0,0,0,.06), 0 0 0 1px rgba(0,0,0,.04)",
      }}
    >
      {/* Top color stripe with icon */}
      <div className="relative h-10 flex items-center px-3 gap-2 overflow-hidden"
        style={{ background: selected ? "rgba(255,255,255,.12)" : `linear-gradient(135deg, ${color}18, ${color}08)` }}>
        <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: selected ? "rgba(255,255,255,.22)" : color + "22" }}>
          <Icon size={13} style={{ color: selected ? "white" : color }} />
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-wider truncate ${selected ? "text-white/80" : ""}`}
          style={selected ? {} : { color }}>
          {TYPE_LABEL[unit.type]}
        </span>
      </div>

      {/* Content */}
      <div className="px-3 pb-3 pt-2">
        <p className={`text-[13px] font-bold leading-snug ${selected ? "text-white" : "text-slate-800"}`}
          style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {unit.name}
        </p>

        {leader && (
          <div className={`flex items-center gap-1.5 mt-2 ${selected ? "text-white/65" : "text-slate-400"}`}>
            <UserCircle2 size={10} />
            <p className="text-[10px] truncate">{leader.role}</p>
          </div>
        )}

        <div className={`flex items-center gap-3 mt-1.5 text-[10px] ${selected ? "text-white/55" : "text-slate-400"}`}>
          {unit.memberships.length > 0 && (
            <span className="flex items-center gap-1"><Users size={9} />{unit.memberships.length}</span>
          )}
          {unit.children.length > 0 && (
            <span className="flex items-center gap-1"><Network size={9} />{unit.children.length}</span>
          )}
        </div>
      </div>

      {/* Selection shimmer */}
      {selected && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.15, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          style={{ background: "linear-gradient(135deg, white, transparent)" }}
        />
      )}
    </motion.div>
  );
}

// ── Org Tree (recursive) ───────────────────────────────────────────────────────

function OrgTree({ unit, selectedId, expandedIds, onSelect, onToggle, searchQuery }: {
  unit: OrgUnit; selectedId: string | null; expandedIds: Set<string>;
  onSelect: (u: OrgUnit) => void; onToggle: (id: string) => void; searchQuery: string;
}) {
  const isExpanded = expandedIds.has(unit.id);
  const hasMatch = searchQuery ? flattenTree(unit).some(u => u.name.toLowerCase().includes(searchQuery.toLowerCase())) : true;
  const matchesSelf = !searchQuery || unit.name.toLowerCase().includes(searchQuery.toLowerCase());
  if (!hasMatch) return null;

  const visibleChildren = isExpanded
    ? unit.children.filter(c => !searchQuery || flattenTree(c).some(u => u.name.toLowerCase().includes(searchQuery.toLowerCase())))
    : [];

  return (
    <motion.div layout className="flex flex-col items-center" style={{ minWidth: 164 }}>
      {/* Card + toggle */}
      <div className="relative">
        <OrgCard unit={unit} selected={selectedId === unit.id} dimmed={!!searchQuery && !matchesSelf} onClick={() => onSelect(unit)} />

        {unit.children.length > 0 && (
          <motion.button
            type="button"
            onClick={e => { e.stopPropagation(); onToggle(unit.id); }}
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center z-10"
            style={{ boxShadow: "0 2px 8px rgba(0,0,0,.1), 0 0 0 1px rgba(0,0,0,.04)" }}
          >
            <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ type: "spring", stiffness: 400, damping: 30 }}>
              <ChevronDown size={12} className="text-slate-500" />
            </motion.div>
            {unit.children.length > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full text-white flex items-center justify-center text-[8px] font-bold"
                style={{ background: TYPE_COLOR[unit.type], fontSize: 7 }}>
                {unit.children.length}
              </span>
            )}
          </motion.button>
        )}
      </div>

      {/* Children */}
      <AnimatePresence initial={false}>
        {visibleChildren.length > 0 && (
          <motion.div
            key="children"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="flex flex-col items-center overflow-hidden"
          >
            {/* Stem down from toggle button */}
            <div className="w-px bg-slate-200" style={{ height: 24 }} />

            {/* Children row */}
            <div className="flex items-start">
              {visibleChildren.map((child, i) => {
                const isFirst = i === 0;
                const isLast = i === visibleChildren.length - 1;
                const isOnly = visibleChildren.length === 1;
                return (
                  <div key={child.id} className="relative flex flex-col items-center" style={{ paddingLeft: 18, paddingRight: 18 }}>
                    {/* Horizontal bridge */}
                    {!isOnly && (
                      <div className="absolute bg-slate-200" style={{
                        top: 0, height: 1,
                        left: isFirst ? "50%" : 0,
                        right: isLast ? "50%" : 0,
                      }} />
                    )}
                    {/* Drop */}
                    <div className="w-px bg-slate-200" style={{ height: 20 }} />
                    <OrgTree unit={child} selectedId={selectedId} expandedIds={expandedIds}
                      onSelect={onSelect} onToggle={onToggle} searchQuery={searchQuery} />
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

// ── Action Button ─────────────────────────────────────────────────────────────

function ActionBtn({ icon: Icon, label, color = "slate", onClick, danger = false, disabled = false }: {
  icon: React.ElementType; label: string; color?: string; onClick: () => void; danger?: boolean; disabled?: boolean;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileHover={{ x: 2 }}
      whileTap={{ scale: 0.97 }}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all border disabled:opacity-40 disabled:cursor-not-allowed ${
        danger
          ? "bg-red-50 border-red-100 text-red-600 hover:bg-red-100 hover:border-red-200"
          : "bg-slate-50 border-slate-100 text-slate-700 hover:bg-slate-100 hover:border-slate-200"
      }`}
    >
      <Icon size={15} className={danger ? "text-red-500" : "text-slate-400"} />
      <span className="flex-1 text-left">{label}</span>
      <ChevronRight size={13} className="text-slate-300" />
    </motion.button>
  );
}

// ── Main modal types ───────────────────────────────────────────────────────────

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
    setLoading(true); setErrorMsg("");
    try {
      const data = await apiFetch<RawUnit[]>("/organizational-units");
      setAllUnits(data);
      if (!initialLoadDone.current) {
        setExpandedIds(new Set(buildTree(data).map(r => r.id)));
        initialLoadDone.current = true;
      }
    } catch { setErrorMsg("Failed to load units."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadUnits(); }, [loadUnits]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true); setDetailUnit(null);
    try {
      const data = await apiFetch<DetailedUnit>(`/organizational-units/${id}`);
      setDetailUnit(data);
    } catch { /* silent */ }
    finally { setDetailLoading(false); }
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────────

  const tree = useMemo(() => buildTree(allUnits), [allUnits]);
  const selectedTreeUnit = useMemo(() => selectedId ? findInTree(tree, selectedId) : null, [tree, selectedId]);
  const selectedRaw = useMemo(() => selectedId ? allUnits.find(u => u.id === selectedId) ?? null : null, [allUnits, selectedId]);
  const typeCount = useMemo(() => {
    const c: Partial<Record<UnitType, number>> = {};
    allUnits.forEach(u => { c[u.type] = (c[u.type] ?? 0) + 1; });
    return c;
  }, [allUnits]);

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const handleSelect = useCallback((unit: OrgUnit) => {
    setSelectedId(unit.id); setIsEditing(false); loadDetail(unit.id);
  }, [loadDetail]);

  const handleToggle = useCallback((id: string) => {
    setExpandedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
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
      setActiveModal(null); await loadUnits();
      if (activeModal.parentId) setExpandedIds(prev => new Set([...prev, activeModal.parentId!]));
      setSelectedId(created.id); loadDetail(created.id);
    } catch (e) { setErrorMsg(e instanceof Error ? e.message : "Failed."); }
    finally { setSaving(false); }
  };

  const handleRename = async () => {
    if (!selectedId || !editName.trim()) return;
    setSaving(true); setErrorMsg("");
    try {
      await apiPatch(`/organizational-units/${selectedId}`, { name: editName.trim() });
      setIsEditing(false); await loadUnits(); loadDetail(selectedId);
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
    setSpNameA(`${selectedTreeUnit.name} A`); setSpNameB(`${selectedTreeUnit.name} B`);
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
      setSelectedId(newParent.id); await loadUnits(); loadDetail(newParent.id);
    } catch (e) { setErrorMsg(e instanceof Error ? e.message : "Group failed."); }
    finally { setSaving(false); }
  };

  const openMove = () => {
    if (!selectedTreeUnit) return;
    setMvTargetId(""); setActiveModal({ kind: "move", unit: selectedTreeUnit });
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
  const TypeIconEl = selectedTreeUnit ? TYPE_ICON[selectedTreeUnit.type] : Building2;
  const suggestedChild = selectedTreeUnit ? CHILD_TYPE[selectedTreeUnit.type] ?? null : null;
  const leader = detailUnit?.leaderships[0] ?? null;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full" style={{ maxHeight: "calc(100vh - 64px)" }}>
      <Header title="Org Chart" subtitle={`${allUnits.length} units across ${Object.keys(typeCount).length} levels`} />

      {/* Error toast */}
      <AnimatePresence>
        {errorMsg && (
          <motion.div {...fadeIn} transition={{ duration: 0.2 }}
            className="mx-6 mt-3 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm flex items-center gap-2.5">
            <AlertTriangle size={15} className="shrink-0 text-red-500" />
            <span className="flex-1">{errorMsg}</span>
            <button onClick={() => setErrorMsg("")}><X size={14} className="text-red-400 hover:text-red-600" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Toolbar ── */}
      <div className="px-6 py-3 flex items-center gap-3 border-b border-slate-100 bg-white/80 backdrop-blur-sm shrink-0">
        {/* Type pills */}
        <div className="flex gap-1.5 flex-1 flex-wrap">
          {ALL_TYPES.filter(t => typeCount[t]).map(t => {
            const Icon = TYPE_ICON[t];
            return (
              <motion.div key={t} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold text-white"
                style={{ background: `linear-gradient(135deg, ${TYPE_COLOR[t]}ee, ${TYPE_COLOR[t]})`, boxShadow: `0 2px 6px ${TYPE_COLOR[t]}44` }}>
                <Icon size={10} />
                {TYPE_LABEL[t]} <span className="opacity-80">{typeCount[t]}</span>
              </motion.div>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative shrink-0">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input type="text" placeholder="Search units…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-sm rounded-xl border border-slate-200 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 w-44 transition-all" />
          <AnimatePresence>
            {searchQuery && (
              <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                <X size={12} className="text-slate-400 hover:text-slate-600" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Expand/collapse */}
        <div className="flex gap-1 text-xs">
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={() => setExpandedIds(new Set(allUnits.map(u => u.id)))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-slate-500 bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors">
            <Maximize2 size={12} /> All
          </motion.button>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={() => setExpandedIds(new Set(tree.map(r => r.id)))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-slate-500 bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors">
            <Minimize2 size={12} /> Collapse
          </motion.button>
        </div>

        {/* Refresh */}
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={loadUnits}
          className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 transition-colors border border-slate-100">
          <motion.div animate={loading ? { rotate: 360 } : {}} transition={loading ? { duration: 1, repeat: Infinity, ease: "linear" } : {}}>
            <RefreshCw size={14} />
          </motion.div>
        </motion.button>

        {/* New unit */}
        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          onClick={() => openCreate(null, "CHURCH")}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-lg transition-all"
          style={{ background: "linear-gradient(135deg, #1e3a8a, #121D55)", boxShadow: "0 4px 12px rgba(18,29,85,.35)" }}>
          <Plus size={15} /> New unit
        </motion.button>
      </div>

      {/* ── Canvas + Drawer ── */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* Chart canvas */}
        <div
          className="flex-1 overflow-auto"
          style={{
            background: "radial-gradient(circle, #e2e8f0 1px, transparent 1px)",
            backgroundSize: "28px 28px",
            backgroundColor: "#f8fafc",
          }}
          onClick={() => { setSelectedId(null); setDetailUnit(null); }}
        >
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div key="loading" {...fadeIn} className="flex flex-col items-center justify-center h-full gap-4 text-slate-400">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}>
                  <RefreshCw size={28} className="text-slate-300" />
                </motion.div>
                <p className="text-sm font-medium">Loading org chart…</p>
              </motion.div>
            ) : tree.length === 0 ? (
              <motion.div key="empty" {...fadeIn} className="flex flex-col items-center justify-center h-full gap-4">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <Church size={28} className="text-slate-300" />
                </div>
                <p className="text-slate-400 text-sm font-medium">No units yet</p>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={() => openCreate(null, "CHURCH")}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
                  style={{ background: "linear-gradient(135deg, #1e3a8a, #121D55)", boxShadow: "0 4px 12px rgba(18,29,85,.35)" }}>
                  <Plus size={15} /> Create Church
                </motion.button>
              </motion.div>
            ) : (
              <motion.div key="tree" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
                className="flex gap-16 justify-start items-start p-10 min-w-max pb-16"
                onClick={e => e.stopPropagation()}>
                {tree.map(root => (
                  <OrgTree key={root.id} unit={root} selectedId={selectedId}
                    expandedIds={expandedIds} onSelect={handleSelect}
                    onToggle={handleToggle} searchQuery={searchQuery} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Detail Drawer ── */}
        <AnimatePresence>
          {selectedTreeUnit && (
            <motion.div
              key="drawer"
              variants={drawerVariants}
              initial="closed"
              animate="open"
              exit="closed"
              transition={{ type: "spring", stiffness: 350, damping: 35 }}
              className="w-80 shrink-0 bg-white border-l border-slate-100 overflow-y-auto shadow-2xl"
              style={{ boxShadow: "-8px 0 32px rgba(0,0,0,.08)" }}
            >
              <div className="p-6 space-y-5">
                {/* Close */}
                <div className="flex justify-end">
                  <motion.button whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    onClick={() => { setSelectedId(null); setDetailUnit(null); }}
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                    <X size={16} />
                  </motion.button>
                </div>

                {/* Hero */}
                <motion.div {...fadeIn} transition={{ delay: 0.05 }} className="flex flex-col items-center text-center gap-3">
                  <motion.div
                    layoutId={`icon-${selectedTreeUnit.id}`}
                    className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl"
                    style={{ background: `linear-gradient(145deg, ${color}e0, ${color})`, boxShadow: `0 8px 24px ${color}44` }}
                  >
                    <TypeIconEl size={26} className="text-white" />
                  </motion.div>

                  {isEditing ? (
                    <div className="w-full space-y-2">
                      <input value={editName} onChange={e => setEditName(e.target.value)} autoFocus
                        onKeyDown={e => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setIsEditing(false); }}
                        className="w-full text-center px-3 py-2 font-bold text-slate-800 border-b-2 outline-none bg-transparent"
                        style={{ borderColor: color }} />
                      <div className="flex gap-2">
                        <motion.button whileTap={{ scale: 0.97 }} onClick={handleRename} disabled={saving}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-60"
                          style={{ background: color }}>
                          <Check size={12} /> {saving ? "Saving…" : "Save"}
                        </motion.button>
                        <motion.button whileTap={{ scale: 0.97 }} onClick={() => setIsEditing(false)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-600">
                          <X size={12} /> Cancel
                        </motion.button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 justify-center">
                        <h2 className="text-lg font-bold text-slate-800 leading-tight">{selectedTreeUnit.name}</h2>
                        <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
                          onClick={() => { setEditName(selectedTreeUnit.name); setIsEditing(true); }}
                          className="text-slate-300 hover:text-slate-600 transition-colors p-0.5">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </motion.button>
                      </div>
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full text-white"
                        style={{ background: `linear-gradient(135deg, ${color}dd, ${color})` }}>
                        <TypeIconEl size={10} />
                        {TYPE_LABEL[selectedTreeUnit.type]}
                      </span>
                    </div>
                  )}

                  {/* Stats row */}
                  {selectedRaw && (
                    <div className="flex gap-4 text-center">
                      <div className="flex-1 bg-slate-50 rounded-xl py-2">
                        <p className="text-base font-bold text-slate-700">{selectedRaw.memberships.length}</p>
                        <p className="text-[10px] text-slate-400 font-medium">Members</p>
                      </div>
                      <div className="flex-1 bg-slate-50 rounded-xl py-2">
                        <p className="text-base font-bold text-slate-700">{selectedTreeUnit.children.length}</p>
                        <p className="text-[10px] text-slate-400 font-medium">Sub-units</p>
                      </div>
                      <div className="flex-1 bg-slate-50 rounded-xl py-2">
                        <p className="text-base font-bold text-slate-700">{selectedTreeUnit.ancestors.length}</p>
                        <p className="text-[10px] text-slate-400 font-medium">Depth</p>
                      </div>
                    </div>
                  )}
                </motion.div>

                {/* Leader card */}
                <motion.div {...fadeIn} transition={{ delay: 0.1 }}>
                  {detailLoading ? (
                    <div className="h-16 rounded-xl bg-slate-50 animate-pulse border border-slate-100" />
                  ) : leader ? (
                    <div className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-100 bg-slate-50/60">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-md"
                        style={{ background: `linear-gradient(145deg, ${color}dd, ${color})` }}>
                        {leader.user.firstName[0]}{leader.user.lastName[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-700 truncate">{leader.user.firstName} {leader.user.lastName}</p>
                        <p className="text-[10px] text-slate-400 truncate">{leader.role}</p>
                        <p className="text-[10px] text-slate-400 truncate">{leader.user.email}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-3.5 rounded-xl border border-dashed border-slate-200 bg-slate-50/40">
                      <UserCircle2 size={28} className="text-slate-200 shrink-0" />
                      <p className="text-xs text-slate-400">No leader assigned</p>
                    </div>
                  )}
                </motion.div>

                {/* Parent */}
                {detailUnit?.parent && (
                  <motion.div {...fadeIn} transition={{ delay: 0.12 }}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-500">
                    <ChevronUp size={12} className="text-slate-400 shrink-0" />
                    <span className="text-slate-400">Under</span>
                    <span className="font-semibold text-slate-600 truncate">{detailUnit.parent.name}</span>
                  </motion.div>
                )}

                <div className="h-px bg-slate-100" />

                {/* Actions */}
                <motion.div {...fadeIn} transition={{ delay: 0.15 }} className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 px-1 mb-3">Actions</p>

                  {suggestedChild && (
                    <ActionBtn icon={Plus} label={`Add ${TYPE_LABEL[suggestedChild]}`}
                      onClick={() => openCreate(selectedTreeUnit.id, suggestedChild)} />
                  )}

                  {selectedTreeUnit.children.length >= 2 && (
                    <ActionBtn icon={Scissors} label="Split this unit" onClick={openSplit} />
                  )}

                  {selectedTreeUnit.children.length >= 2 && (
                    <ActionBtn icon={Layers} label="Group children into new unit" onClick={openGroup} />
                  )}

                  {selectedTreeUnit.parentId && (
                    <ActionBtn icon={ArrowRightLeft} label="Move branch to…" onClick={openMove} />
                  )}

                  {selectedTreeUnit.children.length === 0 && (
                    <ActionBtn icon={Trash2} label="Delete unit" onClick={handleDelete} disabled={saving} danger />
                  )}

                  {selectedTreeUnit.children.length > 0 && (
                    <p className="text-[10px] text-slate-300 text-center pt-1">
                      Remove or move {selectedTreeUnit.children.length} sub-unit{selectedTreeUnit.children.length > 1 ? "s" : ""} to enable delete.
                    </p>
                  )}
                </motion.div>
              </div>
            </motion.div>
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
                <motion.p {...fadeIn} className="text-xs text-amber-500 mt-2 flex items-center gap-1.5">
                  <AlertTriangle size={11} /> Suggested: <strong>{activeModal.suggested}</strong> — override is allowed.
                </motion.p>
              )}
            </div>
            <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }}
              onClick={handleCreate} disabled={saving || !cName.trim()}
              className="w-full py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-50 shadow-lg transition-all flex items-center justify-center gap-2"
              style={{ background: `linear-gradient(135deg, ${TYPE_COLOR[cType]}ee, ${TYPE_COLOR[cType]})`, boxShadow: `0 6px 20px ${TYPE_COLOR[cType]}44` }}>
              {saving ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><RefreshCw size={14} /></motion.div> : <Plus size={14} />}
              {saving ? "Creating…" : `Create ${TYPE_LABEL[cType]}`}
            </motion.button>
          </div>
        </Modal>
      )}

      {activeModal?.kind === "split" && (
        <Modal title={`Split "${activeModal.unit.name}"`} icon={Scissors} wide onClose={() => setActiveModal(null)}>
          <div className="space-y-5">
            <p className="text-sm text-slate-500 leading-relaxed">Two sibling units will be created and children redistributed. The original unit will be removed.</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Group A name", value: spNameA, set: setSpNameA, key: "A" },
                { label: "Group B name", value: spNameB, set: setSpNameB, key: "B" },
              ].map(({ label, value, set, key }) => (
                <div key={key}>
                  <label className="text-xs font-semibold text-slate-600 block mb-1.5">{label}</label>
                  <input value={value} onChange={e => set(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all" />
                </div>
              ))}
            </div>
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-xs font-semibold text-slate-600">Assign sub-units</p>
                <div className="flex gap-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> A: {spGroupA.size}</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-400" /> B: {activeModal.unit.children.length - spGroupA.size}</span>
                </div>
              </div>
              <div className="space-y-1.5 max-h-52 overflow-y-auto rounded-xl border border-slate-100 p-2">
                {activeModal.unit.children.map(child => {
                  const inA = spGroupA.has(child.id);
                  const Icon = TYPE_ICON[child.type];
                  return (
                    <motion.button type="button" key={child.id} whileTap={{ scale: 0.99 }}
                      onClick={() => setSpGroupA(prev => { const n = new Set(prev); n.has(child.id) ? n.delete(child.id) : n.add(child.id); return n; })}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all ${inA ? "border-amber-200 bg-amber-50" : "border-slate-100 hover:bg-slate-50"}`}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0" style={{ background: TYPE_COLOR[child.type] }}>
                        <Icon size={12} />
                      </div>
                      <span className="text-sm text-slate-700 flex-1">{child.name}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-white ${inA ? "bg-amber-400" : "bg-slate-300"}`}>{inA ? "A" : "B"}</span>
                    </motion.button>
                  );
                })}
              </div>
            </div>
            <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }}
              onClick={handleSplit} disabled={saving || !spNameA.trim() || !spNameB.trim()}
              className="w-full py-3 rounded-xl text-white text-sm font-semibold bg-amber-500 hover:bg-amber-600 disabled:opacity-50 shadow-lg transition-all flex items-center justify-center gap-2">
              {saving ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><RefreshCw size={14} /></motion.div> : <Scissors size={14} />}
              {saving ? "Splitting…" : "Confirm Split"}
            </motion.button>
          </div>
        </Modal>
      )}

      {activeModal?.kind === "group" && (
        <Modal title={`Group children of "${activeModal.unit.name}"`} icon={Layers} wide onClose={() => setActiveModal(null)}>
          <div className="space-y-5">
            <p className="text-sm text-slate-500 leading-relaxed">Selected children will be moved under a new intermediate unit.</p>
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-2">Group name</label>
              <input value={grName} onChange={e => setGrName(e.target.value)} placeholder="e.g. East BC Cluster" autoFocus
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all" />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-2.5">Type</label>
              <TypePicker value={grType} onChange={setGrType} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-xs font-semibold text-slate-600">Select children to move</p>
                <span className="text-xs text-slate-400">{grSelected.size} selected</span>
              </div>
              <div className="space-y-1.5 max-h-52 overflow-y-auto rounded-xl border border-slate-100 p-2">
                {activeModal.unit.children.map(child => {
                  const sel = grSelected.has(child.id);
                  const Icon = TYPE_ICON[child.type];
                  return (
                    <motion.button type="button" key={child.id} whileTap={{ scale: 0.99 }}
                      onClick={() => setGrSelected(prev => { const n = new Set(prev); n.has(child.id) ? n.delete(child.id) : n.add(child.id); return n; })}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all ${sel ? "border-violet-200 bg-violet-50" : "border-slate-100 hover:bg-slate-50"}`}>
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${sel ? "bg-violet-500 border-violet-500" : "border-slate-200 bg-white"}`}>
                        {sel && <Check size={11} className="text-white" />}
                      </div>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0" style={{ background: TYPE_COLOR[child.type] }}>
                        <Icon size={12} />
                      </div>
                      <span className="text-sm text-slate-700 flex-1">{child.name}</span>
                      {child.memberships.length > 0 && <span className="text-xs text-slate-400 flex items-center gap-1"><Users size={10} />{child.memberships.length}</span>}
                    </motion.button>
                  );
                })}
              </div>
            </div>
            <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }}
              onClick={handleGroup} disabled={saving || !grName.trim() || grSelected.size === 0}
              className="w-full py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-50 shadow-lg transition-all flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg, #8b5cf6, #7c3aed)", boxShadow: "0 6px 20px #8b5cf644" }}>
              {saving ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><RefreshCw size={14} /></motion.div> : <Layers size={14} />}
              {saving ? "Creating…" : `Create group (${grSelected.size} units)`}
            </motion.button>
          </div>
        </Modal>
      )}

      {activeModal?.kind === "move" && (
        <Modal title={`Move "${activeModal.unit.name}"`} icon={ArrowRightLeft} wide onClose={() => setActiveModal(null)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-500 leading-relaxed">This unit and all its descendants will be re-parented under the selected unit.</p>

            {/* Currently selected target preview */}
            {mvTargetId && (() => {
              const target = allUnits.find(u => u.id === mvTargetId);
              if (!target) return null;
              const TargetIcon = TYPE_ICON[target.type];
              return (
                <motion.div {...scaleIn}
                  className="flex items-center gap-3 p-3.5 rounded-xl border-2 text-sm font-medium"
                  style={{ borderColor: TYPE_COLOR[target.type] + "66", background: TYPE_COLOR[target.type] + "08" }}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0"
                    style={{ background: `linear-gradient(135deg, ${TYPE_COLOR[target.type]}dd, ${TYPE_COLOR[target.type]})` }}>
                    <TargetIcon size={14} />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-700">{target.name}</p>
                    <p className="text-[10px] text-slate-400">{TYPE_LABEL[target.type]}</p>
                  </div>
                  <Check size={16} className="ml-auto shrink-0" style={{ color: TYPE_COLOR[target.type] }} />
                </motion.div>
              );
            })()}

            <div className="max-h-64 overflow-y-auto space-y-1.5 rounded-xl border border-slate-100 p-2">
              {moveTargets.map(u => {
                const Icon = TYPE_ICON[u.type];
                const expected = CHILD_TYPE[u.type];
                const compatible = !expected || expected === activeModal.unit.type;
                return (
                  <motion.button type="button" key={u.id} whileTap={{ scale: 0.99 }}
                    onClick={() => setMvTargetId(u.id)}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all ${
                      mvTargetId === u.id ? "border-blue-200 bg-blue-50" : "border-slate-100 hover:bg-slate-50"
                    }`}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0" style={{ background: TYPE_COLOR[u.type] }}>
                      <Icon size={12} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-700 truncate">{u.name}</p>
                      <p className="text-[10px] text-slate-400">{TYPE_LABEL[u.type]}</p>
                    </div>
                    {!compatible && (
                      <span className="flex items-center gap-1 text-[10px] text-amber-500 shrink-0">
                        <AlertTriangle size={9} /> mismatch
                      </span>
                    )}
                    {mvTargetId === u.id && <Check size={14} className="text-blue-500 shrink-0" />}
                  </motion.button>
                );
              })}
            </div>

            <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }}
              onClick={handleMove} disabled={saving || !mvTargetId}
              className="w-full py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-50 shadow-lg transition-all flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg, #3b82f6, #2563eb)", boxShadow: "0 6px 20px #3b82f644" }}>
              {saving ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><RefreshCw size={14} /></motion.div> : <MoveRight size={14} />}
              {saving ? "Moving…" : "Move branch"}
            </motion.button>
          </div>
        </Modal>
      )}
    </div>
  );
}
