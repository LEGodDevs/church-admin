"use client";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Church, MapPin, GitBranch, Users, Network, Grid3X3, Leaf,
  Plus, Scissors, Layers, Trash2, Search, ChevronDown, ChevronUp,
  X, Check, AlertTriangle, RefreshCw, UserCircle2, Building2,
  ArrowRightLeft, ChevronRight, ChevronLeft, Maximize2, Minimize2,
  ZoomIn, ZoomOut, Target, Crosshair, CornerUpLeft, List, LayoutGrid,
  Pencil, Shield, Lock,
} from "lucide-react";
import Header from "@/components/layout/Header";
import { apiFetch, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { UserRole } from "@/types/auth";

// ── Hierarchy ──────────────────────────────────────────────────────────────────

type UnitType = "CHURCH" | "ZONE" | "BRANCH" | "MC" | "BC" | "CELL" | "SHEPHERD";

const TYPE_ORDER: UnitType[] = ["CHURCH","ZONE","BRANCH","MC","BC","CELL","SHEPHERD"];
const LEVEL = (t: UnitType) => TYPE_ORDER.indexOf(t);

const PARENT_TYPE: Partial<Record<UnitType, UnitType>> = {
  ZONE:"CHURCH", BRANCH:"ZONE", MC:"BRANCH", BC:"MC", CELL:"BC", SHEPHERD:"CELL",
};
const CHILD_TYPE: Partial<Record<UnitType, UnitType>> = {
  CHURCH:"ZONE", ZONE:"BRANCH", BRANCH:"MC", MC:"BC", BC:"CELL", CELL:"SHEPHERD",
};

// What unit types each web role is permitted to create
const ROLE_CREATABLE: Partial<Record<UserRole, UnitType[]>> = {
  BISHOP:      TYPE_ORDER,
  ADMIN:       TYPE_ORDER,
  ZONE_LEADER: ["BRANCH","MC","BC","CELL","SHEPHERD"],
  BRANCH_HEAD: ["MC","BC","CELL","SHEPHERD"],
};

const TYPE_COLOR: Record<UnitType, string> = {
  CHURCH:"#EF4444", ZONE:"#06B6D4", BRANCH:"#EC4899",
  MC:"#F59E0B",     BC:"#8B5CF6",   CELL:"#3B82F6", SHEPHERD:"#10B981",
};
const TYPE_LABEL: Record<UnitType, string> = {
  CHURCH:"Church", ZONE:"Zone", BRANCH:"Branch",
  MC:"Mini-Center", BC:"Business Center", CELL:"Cell", SHEPHERD:"Shepherd",
};
const TYPE_ICON: Record<UnitType, React.ElementType> = {
  CHURCH:Church, ZONE:MapPin, BRANCH:GitBranch,
  MC:Network,    BC:Grid3X3, CELL:Layers, SHEPHERD:Leaf,
};
const ALL_TYPES: UnitType[] = TYPE_ORDER;

// ── Interfaces ─────────────────────────────────────────────────────────────────

interface RawUnit {
  id: string; name: string; type: UnitType;
  parentId?: string | null; ancestors: string[];
  memberships: { id: string }[];
  leaderships: { id: string; role: string; userId: string }[];
}
interface OrgUnit extends RawUnit { children: OrgUnit[]; }
interface DetailedUnit extends Omit<RawUnit,"leaderships"> {
  parent: { id: string; name: string; type: UnitType } | null;
  leaderships: { id: string; role: string; user: { id: string; firstName: string; lastName: string; email: string } }[];
}

// ── Permissions ────────────────────────────────────────────────────────────────

function canWrite(unit: RawUnit, userId: string | undefined, userRole: UserRole | undefined): boolean {
  if (!userId || !userRole) return false;
  if (userRole === "BISHOP" || userRole === "ADMIN") return true;
  return unit.id === userId || unit.ancestors.includes(userId);
}

function isHighPrivilege(role: UserRole | undefined) {
  return role === "BISHOP" || role === "ADMIN";
}

function creatableChildType(parentType: UnitType, role: UserRole | undefined): UnitType | null {
  const child = CHILD_TYPE[parentType];
  if (!child) return null;
  const allowed = ROLE_CREATABLE[role ?? "MEMBER"] ?? [];
  return allowed.includes(child) ? child : null;
}

// ── Tree helpers ───────────────────────────────────────────────────────────────

function buildTree(flat: RawUnit[]): OrgUnit[] {
  const map = new Map<string, OrgUnit>();
  flat.forEach(u => map.set(u.id, { ...u, children: [] }));
  const roots: OrgUnit[] = [];
  map.forEach(u => {
    if (u.parentId && map.has(u.parentId)) map.get(u.parentId)!.children.push(u);
    else roots.push(u);
  });
  const sort = (arr: OrgUnit[]): OrgUnit[] =>
    arr.sort((a,b)=>a.name.localeCompare(b.name)).map(u=>({...u,children:sort(u.children)}));
  return sort(roots);
}

function flattenTree(u: OrgUnit): OrgUnit[] {
  return [u, ...u.children.flatMap(flattenTree)];
}
function findInTree(units: OrgUnit[], id: string): OrgUnit | null {
  for (const u of units) {
    if (u.id === id) return u;
    const f = findInTree(u.children, id); if (f) return f;
  }
  return null;
}
function pathTo(units: OrgUnit[], id: string): OrgUnit[] {
  for (const u of units) {
    if (u.id === id) return [u];
    const p = pathTo(u.children, id); if (p.length) return [u, ...p];
  }
  return [];
}
function scopedTree(tree: OrgUnit[], unitId: string | undefined, role: UserRole | undefined): OrgUnit[] {
  if (!role || role === "BISHOP" || role === "ADMIN") return tree;
  if (!unitId) return tree;
  const node = findInTree(tree, unitId);
  return node ? [node] : tree;
}
function validMoveTargets(source: OrgUnit, all: RawUnit[], userUnitId: string | undefined, role: UserRole | undefined): Set<string> {
  const required = PARENT_TYPE[source.type];
  if (!required) return new Set();
  const sub = new Set(flattenTree(source).map(u => u.id));
  return new Set(all.filter(u =>
    u.type === required &&
    !sub.has(u.id) &&
    u.id !== source.parentId &&
    canWrite(u, userUnitId, role)
  ).map(u => u.id));
}

// ── Motion ─────────────────────────────────────────────────────────────────────

const scaleIn = {
  initial:{ opacity:0, scale:0.9, y:6 },
  animate:{ opacity:1, scale:1,   y:0 },
  exit:   { opacity:0, scale:0.9, y:-6 },
};
const drawerV = { closed:{ x:"100%", opacity:0 }, open:{ x:0, opacity:1 } };

// ── TypePicker ─────────────────────────────────────────────────────────────────

function TypePicker({ value, onChange, allowed }: {
  value: UnitType; onChange: (t: UnitType) => void; allowed?: UnitType[];
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {ALL_TYPES.map(t => {
        const Icon = TYPE_ICON[t];
        const on = value === t;
        const disabled = allowed ? !allowed.includes(t) : false;
        return (
          <motion.button key={t} type="button" onClick={() => !disabled && onChange(t)} whileTap={disabled ? {} : {scale:0.94}}
            disabled={disabled}
            className={`flex flex-col items-center gap-1.5 py-2.5 rounded-xl text-[11px] font-bold border-2 transition-colors
              ${on ? "border-transparent text-white" : "bg-white border-slate-100 text-slate-500"}
              ${disabled ? "opacity-30 cursor-not-allowed" : "hover:border-slate-200"}`}
            style={on ? { background: TYPE_COLOR[t], boxShadow: `0 4px 14px ${TYPE_COLOR[t]}55` } : {}}>
            <Icon size={13} />
            {t==="SHEPHERD"?"SHPD":t==="MC"?"M-CTR":t==="BC"?"B-CTR":t}
          </motion.button>
        );
      })}
    </div>
  );
}

// ── Modal ──────────────────────────────────────────────────────────────────────

function Modal({ title, icon:Icon, wide, onClose, children }: {
  title:string; icon?:React.ElementType; wide?:boolean; onClose:()=>void; children:React.ReactNode;
}) {
  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={onClose}>
        <div className="absolute inset-0 bg-slate-900/65 backdrop-blur-sm" />
        <motion.div className={`relative bg-white rounded-2xl shadow-2xl w-full ${wide?"max-w-2xl":"max-w-md"} max-h-[90vh] overflow-hidden flex flex-col`}
          variants={scaleIn} initial="initial" animate="animate" exit="exit"
          transition={{type:"spring",stiffness:420,damping:32}} onClick={e=>e.stopPropagation()}>
          <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 shrink-0">
            {Icon && <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center text-slate-500 shrink-0"><Icon size={17}/></div>}
            <h3 className="text-[15px] font-semibold text-slate-800 flex-1">{title}</h3>
            <motion.button onClick={onClose} whileHover={{rotate:90}} transition={{type:"spring",stiffness:400,damping:20}}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100">
              <X size={15}/>
            </motion.button>
          </div>
          <div className="p-6 overflow-y-auto flex-1">{children}</div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Drawer section ─────────────────────────────────────────────────────────────

function Section({ label, tier, children }: { label:string; tier:"safe"|"controlled"|"restricted"; children:React.ReactNode }) {
  const colors = { safe:"text-emerald-600", controlled:"text-amber-600", restricted:"text-red-500" };
  const icons  = { safe:"✓", controlled:"⚙", restricted:"🔒" };
  return (
    <div className="space-y-1.5">
      <p className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 px-1 mb-2 ${colors[tier]}`}>
        <span>{icons[tier]}</span>{label}
      </p>
      {children}
    </div>
  );
}

function ActionBtn({ icon:Icon, label, sublabel, onClick, danger, disabled, accent, locked }: {
  icon:React.ElementType; label:string; sublabel?:string; onClick:()=>void;
  danger?:boolean; disabled?:boolean; accent?:string; locked?:boolean;
}) {
  return (
    <motion.button type="button" onClick={onClick} disabled={disabled||locked}
      whileHover={disabled||locked?{}:{x:3}} whileTap={disabled||locked?{}:{scale:0.97}}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm border transition-all
        ${danger?"bg-red-50 border-red-100 text-red-600 hover:bg-red-100"
                :"bg-slate-50 border-slate-100 text-slate-700 hover:bg-slate-100"}
        ${(disabled||locked)?"opacity-40 cursor-not-allowed":""}`}>
      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
        style={{background: danger?"#fee2e2" : accent?`${accent}18`:"#f1f5f9"}}>
        {locked ? <Lock size={13} className="text-slate-400"/> : <Icon size={14} style={{color: danger?"#ef4444":accent??"#64748b"}}/>}
      </div>
      <div className="flex-1 text-left leading-tight">
        <p className="font-semibold">{label}</p>
        {sublabel && <p className="text-[10px] text-slate-400 mt-0.5">{sublabel}</p>}
      </div>
      <ChevronRight size={13} className="text-slate-300"/>
    </motion.button>
  );
}

// ── OrgCard ────────────────────────────────────────────────────────────────────

type CardMode = "normal"|"selected"|"source"|"target"|"dimmed"|"readonly";

function OrgCard({ unit, mode, onClick }: { unit:OrgUnit; mode:CardMode; onClick:()=>void }) {
  const color = TYPE_COLOR[unit.type];
  const Icon  = TYPE_ICON[unit.type] ?? Building2;
  const leader = unit.leaderships[0];
  const isSel  = mode==="selected";
  const isSrc  = mode==="source";
  const isTgt  = mode==="target";
  const isDim  = mode==="dimmed";
  const isRO   = mode==="readonly";

  return (
    <motion.div
      layout
      data-org-card
      onClick={onClick}
      animate={{ opacity: isDim?0.2:1, scale: isSrc?1.06:isTgt?1.03:isSel?1.04:1 }}
      whileHover={isDim?{}:{ y:-3, scale: isSrc||isSel?undefined:1.03 }}
      whileTap={{ scale:0.97 }}
      transition={{ type:"spring", stiffness:480, damping:36 }}
      className="relative overflow-hidden cursor-pointer rounded-2xl"
      style={{
        width: 172,
        background: isSel ? `linear-gradient(145deg,${color}ee,${color})`
                  : isTgt ? "linear-gradient(145deg,#eff6ff,#dbeafe)"
                  : isRO  ? "#f8fafc"
                  : "white",
        boxShadow: isSel ? `0 12px 32px -4px ${color}55,0 0 0 3px white,0 0 0 5px ${color}bb`
                 : isSrc ? `0 0 0 3px white,0 0 0 5px ${color},0 8px 24px ${color}44`
                 : isTgt ? `0 0 0 3px white,0 0 0 5px #3b82f6,0 8px 24px #3b82f640`
                 : "0 2px 10px rgba(0,0,0,.07),0 0 0 1px rgba(0,0,0,.04)",
      }}
    >
      {/* Colored top bar */}
      <div className="h-1.5 w-full" style={{background:color}} />

      {/* Source / target badges */}
      {isSrc && (
        <div className="absolute top-3 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white" style={{background:color}}>
          <Crosshair size={7}/> MOVING
        </div>
      )}
      {isTgt && (
        <motion.div className="absolute top-3 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold text-blue-600 bg-blue-100"
          animate={{scale:[1,1.08,1]}} transition={{duration:1.2,repeat:Infinity}}>
          <Target size={7}/> DROP HERE
        </motion.div>
      )}
      {isRO && (
        <div className="absolute top-3 right-2">
          <Lock size={10} className="text-slate-300"/>
        </div>
      )}

      {/* Icon + type label */}
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
          style={{background: isSel?"rgba(255,255,255,.22)":`${color}20`}}>
          <Icon size={12} style={{color: isSel?"white":color}}/>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider truncate"
          style={{color: isSel?"rgba(255,255,255,.75)":color}}>
          {TYPE_LABEL[unit.type]}
        </span>
      </div>

      {/* Name */}
      <p className={`px-3 text-[13px] font-bold leading-snug ${isSel?"text-white":isRO?"text-slate-400":"text-slate-800"}`}
        style={{display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>
        {unit.name}
      </p>

      {leader && (
        <div className={`flex items-center gap-1.5 px-3 mt-1.5 ${isSel?"text-white/60":"text-slate-400"}`}>
          <UserCircle2 size={10}/>
          <p className="text-[10px] truncate">{leader.role}</p>
        </div>
      )}

      <div className={`flex items-center gap-3 px-3 pb-3 mt-1 text-[10px] ${isSel?"text-white/50":"text-slate-400"}`}>
        {unit.memberships.length>0 && <span className="flex items-center gap-1"><Users size={9}/>{unit.memberships.length}</span>}
        {unit.children.length>0   && <span className="flex items-center gap-1"><Network size={9}/>{unit.children.length}</span>}
      </div>

      {/* Selected shimmer */}
      {isSel && (
        <motion.div className="absolute inset-0 pointer-events-none"
          animate={{x:["-100%","200%"]}} transition={{duration:2.5,repeat:Infinity,ease:"easeInOut",repeatDelay:1.2}}
          style={{background:"linear-gradient(90deg,transparent,rgba(255,255,255,.15),transparent)",width:"60%"}}/>
      )}
    </motion.div>
  );
}

// ── OrgTree (recursive) ────────────────────────────────────────────────────────

function OrgTree({ unit, selectedId, expandedIds, onSelect, onToggle, searchQuery,
  moveSourceId, moveTargetIds, onMoveTarget, writeIds, stagger=0 }: {
  unit:OrgUnit; selectedId:string|null; expandedIds:Set<string>;
  onSelect:(u:OrgUnit)=>void; onToggle:(id:string)=>void; searchQuery:string;
  moveSourceId:string|null; moveTargetIds:Set<string>|null;
  onMoveTarget:(u:OrgUnit)=>void; writeIds:Set<string>; stagger?:number;
}) {
  const isExpanded = expandedIds.has(unit.id);
  const color = TYPE_COLOR[unit.type];
  const inSearch = searchQuery ? flattenTree(unit).some(u=>u.name.toLowerCase().includes(searchQuery.toLowerCase())) : true;
  const matchSelf = !searchQuery || unit.name.toLowerCase().includes(searchQuery.toLowerCase());
  if (!inSearch) return null;

  const visibleChildren = isExpanded
    ? unit.children.filter(c=>!searchQuery||flattenTree(c).some(u=>u.name.toLowerCase().includes(searchQuery.toLowerCase())))
    : [];

  let mode: CardMode = "normal";
  if (moveSourceId) {
    if (unit.id===moveSourceId)              mode="source";
    else if (moveTargetIds?.has(unit.id))    mode="target";
    else                                     mode="dimmed";
  } else if (unit.id===selectedId)           mode="selected";
  else if (searchQuery && !matchSelf)        mode="dimmed";
  else if (!writeIds.has(unit.id))           mode="readonly";

  const handleClick = () => {
    if (moveSourceId && moveTargetIds?.has(unit.id)) onMoveTarget(unit);
    else if (!moveSourceId) onSelect(unit);
  };

  return (
    <motion.div layout initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}
      transition={{delay:stagger*0.04,type:"spring",stiffness:400,damping:30}}
      className="flex flex-col items-center" style={{minWidth:172}}>

      {/* Card + toggle */}
      <div className="relative">
        <OrgCard unit={unit} mode={mode} onClick={handleClick}/>
        {unit.children.length>0 && !moveSourceId && (
          <motion.button type="button" onClick={e=>{e.stopPropagation();onToggle(unit.id);}}
            whileHover={{scale:1.2}} whileTap={{scale:0.85}}
            className="absolute -bottom-4 left-1/2 -translate-x-1/2 z-10 w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-md">
            <motion.div animate={{rotate:isExpanded?180:0}} transition={{type:"spring",stiffness:400,damping:28}}>
              <ChevronDown size={12} className="text-slate-500"/>
            </motion.div>
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-white flex items-center justify-center text-[8px] font-black shadow"
              style={{background:color}}>
              {unit.children.length}
            </span>
          </motion.button>
        )}
      </div>

      {/* Children */}
      <AnimatePresence initial={false}>
        {visibleChildren.length>0 && (
          <motion.div key="ch" initial={{opacity:0,height:0}} animate={{opacity:1,height:"auto"}}
            exit={{opacity:0,height:0}} transition={{duration:0.26,ease:[0.4,0,0.2,1]}}
            className="flex flex-col items-center overflow-hidden">
            <div className="w-px" style={{height:28,background:`${color}60`}}/>
            <div className="flex items-start">
              {visibleChildren.map((child,i)=>{
                const first=i===0, last=i===visibleChildren.length-1, only=visibleChildren.length===1;
                const cc=TYPE_COLOR[child.type];
                return (
                  <div key={child.id} className="relative flex flex-col items-center" style={{paddingLeft:16,paddingRight:16}}>
                    {!only && <div className="absolute" style={{top:0,height:1,left:first?"50%":0,right:last?"50%":0,background:`${color}50`}}/>}
                    <div className="w-px" style={{height:20,background:`${cc}60`}}/>
                    <OrgTree unit={child} selectedId={selectedId} expandedIds={expandedIds}
                      onSelect={onSelect} onToggle={onToggle} searchQuery={searchQuery}
                      moveSourceId={moveSourceId} moveTargetIds={moveTargetIds} onMoveTarget={onMoveTarget}
                      writeIds={writeIds} stagger={i}/>
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

// ── List / Drill-down view (mobile-friendly) ───────────────────────────────────

function DrillView({ roots, onSelect, writeIds }: {
  roots: OrgUnit[]; onSelect:(u:OrgUnit)=>void; writeIds:Set<string>;
}) {
  const [stack, setStack] = useState<OrgUnit[]>([]);
  const current = stack[stack.length-1] ?? null;
  const children = current ? current.children : roots;
  const breadcrumb = stack;

  return (
    <div className="flex flex-col h-full">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 px-4 py-3 border-b border-slate-100 overflow-x-auto">
        <button onClick={()=>setStack([])} className="text-xs text-slate-400 hover:text-slate-700 shrink-0 flex items-center gap-1">
          <Church size={11}/> All
        </button>
        {breadcrumb.map((u,i)=>{
          const Icon=TYPE_ICON[u.type];
          return (
            <span key={u.id} className="flex items-center gap-1 shrink-0">
              <ChevronRight size={10} className="text-slate-300"/>
              <button onClick={()=>setStack(stack.slice(0,i+1))}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1">
                <Icon size={10} style={{color:TYPE_COLOR[u.type]}}/>{u.name}
              </button>
            </span>
          );
        })}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {current && (
          <button onClick={()=>setStack(s=>s.slice(0,-1))}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-slate-200 text-slate-400 text-sm hover:bg-slate-50 mb-3">
            <CornerUpLeft size={14}/> Back to {stack[stack.length-2]?.name ?? "All"}
          </button>
        )}
        {children.map(u=>{
          const Icon=TYPE_ICON[u.type];
          const color=TYPE_COLOR[u.type];
          const writable=writeIds.has(u.id);
          return (
            <div key={u.id} className="flex items-center bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              {/* Color band */}
              <div className="w-1.5 self-stretch" style={{background:color}}/>
              {/* Icon */}
              <div className="w-10 h-10 flex items-center justify-center m-3 rounded-xl shrink-0"
                style={{background:`${color}18`}}>
                <Icon size={16} style={{color}}/>
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0 py-3">
                <p className={`text-sm font-semibold truncate ${writable?"text-slate-800":"text-slate-400"}`}>{u.name}</p>
                <p className="text-[10px] text-slate-400">{TYPE_LABEL[u.type]}
                  {u.memberships.length>0 && ` · ${u.memberships.length} members`}
                  {u.children.length>0    && ` · ${u.children.length} sub-units`}
                </p>
              </div>
              {/* Actions */}
              <div className="flex items-center gap-1 px-3">
                {writable && (
                  <button onClick={()=>onSelect(u)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100">
                    <Pencil size={13}/>
                  </button>
                )}
                {u.children.length>0 && (
                  <button onClick={()=>setStack(s=>[...s,u])}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100">
                    <ChevronRight size={15}/>
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {children.length===0 && (
          <div className="py-16 text-center text-slate-300 text-sm">No units at this level</div>
        )}
      </div>
    </div>
  );
}

// ── Modal types ────────────────────────────────────────────────────────────────

type ActiveModal =
  | { kind:"create"; parentId:string|null; suggested:UnitType; allowedTypes:UnitType[] }
  | { kind:"split";  unit:OrgUnit }
  | { kind:"group";  unit:OrgUnit }
  | { kind:"rename"; unit:OrgUnit }
  | { kind:"church"; unit:OrgUnit; step:1|2|3|4;
      churchName:string; zoneName:string; branchName:string; selectedIds:Set<string> };

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function UnitsPage() {
  const { user } = useAuthStore();
  const role   = user?.role;
  const unitId = user?.unitId;

  // Data
  const [allUnits, setAllUnits]   = useState<RawUnit[]>([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [errorMsg, setErrorMsg]   = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const initDone = useRef(false);

  // Selection
  const [selectedId, setSelectedId]       = useState<string|null>(null);
  const [detailUnit, setDetailUnit]       = useState<DetailedUnit|null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Canvas (pan/zoom via refs for 60fps — avoids React re-renders during drag)
  const canvasRef  = useRef<HTMLDivElement>(null);
  const treeRef    = useRef<HTMLDivElement>(null);
  const panRef     = useRef({ x:60, y:60 });
  const zoomRef    = useRef(1);
  const dragRef    = useRef({ active:false, startX:0, startY:0 });
  const [displayZoom, setDisplayZoom] = useState(100);

  // UI modes
  const [viewMode, setViewMode]   = useState<"chart"|"list">("chart");
  const [searchQuery, setSearchQuery] = useState("");
  const [focusId, setFocusId]     = useState<string|null>(null);

  // Move mode
  const [moveSource, setMoveSource] = useState<OrgUnit|null>(null);

  // Modals
  const [activeModal, setActiveModal] = useState<ActiveModal|null>(null);
  const [cName, setCName]   = useState("");
  const [cType, setCType]   = useState<UnitType>("ZONE");
  const [spNameA,setSpNameA]= useState("");
  const [spNameB,setSpNameB]= useState("");
  const [spGroupA,setSpGroupA]=useState<Set<string>>(new Set());
  const [grName,setGrName]  = useState("");
  const [grType,setGrType]  = useState<UnitType>("BC");
  const [grSel,setGrSel]    = useState<Set<string>>(new Set());

  // ── Data ──────────────────────────────────────────────────────────────────────

  const loadUnits = useCallback(async () => {
    setLoading(true); setErrorMsg("");
    try {
      const data = await apiFetch<RawUnit[]>("/organizational-units");
      setAllUnits(data);
      if (!initDone.current) {
        setExpandedIds(new Set(buildTree(data).map(r=>r.id)));
        initDone.current=true;
      }
    } catch { setErrorMsg("Failed to load units."); }
    finally { setLoading(false); }
  }, []);

  useEffect(()=>{ loadUnits(); },[loadUnits]);

  const loadDetail = useCallback(async (id:string) => {
    setDetailLoading(true); setDetailUnit(null);
    try { setDetailUnit(await apiFetch<DetailedUnit>(`/organizational-units/${id}`)); }
    catch{} finally { setDetailLoading(false); }
  },[]);

  // ── Derived ───────────────────────────────────────────────────────────────────

  const tree        = useMemo(()=>buildTree(allUnits),[allUnits]);
  const visibleTree = useMemo(()=>scopedTree(tree,unitId,role),[tree,unitId,role]);
  const displayTree = useMemo(()=>{
    if (!focusId) return visibleTree;
    const node=findInTree(visibleTree,focusId);
    return node?[node]:visibleTree;
  },[visibleTree,focusId]);

  // Set of unit IDs the user can write to
  const writeIds = useMemo(()=>new Set(
    allUnits.filter(u=>canWrite(u,unitId,role)).map(u=>u.id)
  ),[allUnits,unitId,role]);

  const selectedUnit = useMemo(()=>selectedId?findInTree(tree,selectedId):null,[tree,selectedId]);
  const selectedRaw  = useMemo(()=>allUnits.find(u=>u.id===selectedId)??null,[allUnits,selectedId]);
  const breadcrumb   = useMemo(()=>selectedId?pathTo(visibleTree,selectedId):[],[visibleTree,selectedId]);

  const typeCount = useMemo(()=>{
    const c: Partial<Record<UnitType,number>>={};
    allUnits.forEach(u=>{c[u.type]=(c[u.type]??0)+1;});
    return c;
  },[allUnits]);

  const moveTargets = useMemo(()=>
    moveSource?validMoveTargets(moveSource,allUnits,unitId,role):null,
    [moveSource,allUnits,unitId,role]
  );

  const color   = selectedUnit?TYPE_COLOR[selectedUnit.type]:"#121D55";
  const TypeIcon = selectedUnit?TYPE_ICON[selectedUnit.type]:Building2;
  const leader   = detailUnit?.leaderships[0]??null;
  const childTypeSuggested = selectedUnit?creatableChildType(selectedUnit.type,role):null;
  const canEditSelected = selectedId?writeIds.has(selectedId):false;

  // ── Pan / Zoom (imperative for performance) ────────────────────────────────────

  const applyTransform = useCallback(()=>{
    if(!treeRef.current) return;
    treeRef.current.style.transformOrigin="0 0";
    treeRef.current.style.transform=`translate(${panRef.current.x}px,${panRef.current.y}px) scale(${zoomRef.current})`;
  },[]);

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as Element).closest("[data-org-card]")) return;
    dragRef.current={active:true,startX:e.clientX-panRef.current.x,startY:e.clientY-panRef.current.y};
    if(canvasRef.current) canvasRef.current.style.cursor="grabbing";
  };
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if(!dragRef.current.active) return;
    panRef.current={x:e.clientX-dragRef.current.startX,y:e.clientY-dragRef.current.startY};
    applyTransform();
  };
  const handleCanvasMouseUp = () => {
    dragRef.current.active=false;
    if(canvasRef.current) canvasRef.current.style.cursor="grab";
  };
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if(!e.ctrlKey&&!e.metaKey) return;
    e.preventDefault();
    const rect=canvasRef.current!.getBoundingClientRect();
    const mx=e.clientX-rect.left, my=e.clientY-rect.top;
    const delta=e.deltaY<0?0.1:-0.1;
    const oldZ=zoomRef.current;
    const newZ=Math.min(2,Math.max(0.3,oldZ+delta));
    const ratio=newZ/oldZ;
    panRef.current={x:mx-(mx-panRef.current.x)*ratio,y:my-(my-panRef.current.y)*ratio};
    zoomRef.current=newZ;
    applyTransform();
    setDisplayZoom(Math.round(newZ*100));
  };
  const zoomBy = (d:number) => {
    zoomRef.current=Math.min(2,Math.max(0.3,zoomRef.current+d));
    applyTransform();
    setDisplayZoom(Math.round(zoomRef.current*100));
  };
  const zoomToFit = () => {
    if(!treeRef.current||!canvasRef.current) return;
    const prev=treeRef.current.style.transform;
    treeRef.current.style.transform="none";
    requestAnimationFrame(()=>{
      if(!treeRef.current||!canvasRef.current) return;
      const tw=treeRef.current.scrollWidth, th=treeRef.current.scrollHeight;
      treeRef.current.style.transform=prev;
      const cw=canvasRef.current.clientWidth, ch=canvasRef.current.clientHeight;
      const pad=60;
      const scale=Math.min((cw-pad*2)/Math.max(tw,1),(ch-pad*2)/Math.max(th,1),1);
      panRef.current={x:pad,y:pad};
      zoomRef.current=scale;
      applyTransform();
      setDisplayZoom(Math.round(scale*100));
    });
  };

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const handleSelect = useCallback((unit:OrgUnit)=>{
    setSelectedId(unit.id); loadDetail(unit.id);
  },[loadDetail]);

  const handleToggle = useCallback((id:string)=>{
    setExpandedIds(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n;});
  },[]);

  const openCreate=(parentId:string|null,suggested:UnitType,allowedTypes:UnitType[])=>{
    setCName(""); setCType(suggested);
    setActiveModal({kind:"create",parentId,suggested,allowedTypes});
  };

  const handleCreate=async()=>{
    if(!cName.trim()||activeModal?.kind!=="create") return;
    setSaving(true); setErrorMsg("");
    try {
      const created=await apiPost<{id:string}>("/organizational-units",{name:cName.trim(),type:cType,...(activeModal.parentId?{parentId:activeModal.parentId}:{})});
      setActiveModal(null); await loadUnits();
      if(activeModal.parentId) setExpandedIds(prev=>new Set([...prev,activeModal.parentId!]));
      setSelectedId(created.id); loadDetail(created.id);
    } catch(e){setErrorMsg(e instanceof Error?e.message:"Failed.");}
    finally{setSaving(false);}
  };

  const handleRename=async(newName:string)=>{
    if(!selectedId||!newName.trim()) return;
    setSaving(true); setErrorMsg("");
    try {
      await apiPatch(`/organizational-units/${selectedId}`,{name:newName.trim()});
      setActiveModal(null); await loadUnits(); loadDetail(selectedId);
    } catch(e){setErrorMsg(e instanceof Error?e.message:"Rename failed.");}
    finally{setSaving(false);}
  };

  const handleDelete=async()=>{
    if(!selectedUnit||selectedUnit.children.length>0) return;
    if(!confirm(`Delete "${selectedUnit.name}"? This cannot be undone.`)) return;
    setSaving(true); setErrorMsg("");
    try {
      await apiDelete(`/organizational-units/${selectedId}`);
      setSelectedId(null); setDetailUnit(null); await loadUnits();
    } catch(e){setErrorMsg(e instanceof Error?e.message:"Delete failed.");}
    finally{setSaving(false);}
  };

  const handleMoveTarget=async(target:OrgUnit)=>{
    if(!moveSource) return;
    setSaving(true); setErrorMsg("");
    try {
      await apiPost(`/organizational-units/${target.id}/children`,{childId:moveSource.id});
      setMoveSource(null);
      setExpandedIds(prev=>new Set([...prev,target.id]));
      await loadUnits(); loadDetail(moveSource.id);
    } catch(e){setErrorMsg(e instanceof Error?e.message:"Move failed."); setMoveSource(null);}
    finally{setSaving(false);}
  };

  const openSplit=()=>{
    if(!selectedUnit||selectedUnit.children.length<2) return;
    setSpNameA(`${selectedUnit.name} A`);
    setSpNameB(`${selectedUnit.name} B`);
    setSpGroupA(new Set(selectedUnit.children.slice(0,Math.ceil(selectedUnit.children.length/2)).map(c=>c.id)));
    setActiveModal({kind:"split",unit:selectedUnit});
  };
  const handleSplit=async()=>{
    if(activeModal?.kind!=="split") return;
    const {unit}=activeModal;
    if(!spNameA.trim()||!spNameB.trim()) return;
    setSaving(true); setErrorMsg("");
    try {
      const [nA,nB]=await Promise.all([
        apiPost<{id:string}>("/organizational-units",{name:spNameA.trim(),type:unit.type,parentId:unit.parentId}),
        apiPost<{id:string}>("/organizational-units",{name:spNameB.trim(),type:unit.type,parentId:unit.parentId}),
      ]);
      await Promise.all([
        ...unit.children.filter(c=>spGroupA.has(c.id)).map(c=>apiPost(`/organizational-units/${nA.id}/children`,{childId:c.id})),
        ...unit.children.filter(c=>!spGroupA.has(c.id)).map(c=>apiPost(`/organizational-units/${nB.id}/children`,{childId:c.id})),
      ]);
      await apiDelete(`/organizational-units/${unit.id}`);
      setActiveModal(null); setSelectedId(nA.id); await loadUnits(); loadDetail(nA.id);
    } catch(e){setErrorMsg(e instanceof Error?e.message:"Split failed.");}
    finally{setSaving(false);}
  };

  const openGroup=()=>{
    if(!selectedUnit||selectedUnit.children.length<2) return;
    const s=CHILD_TYPE[selectedUnit.children[0]?.type??selectedUnit.type]??"CELL";
    setGrName(""); setGrType(s as UnitType); setGrSel(new Set());
    setActiveModal({kind:"group",unit:selectedUnit});
  };
  const handleGroup=async()=>{
    if(activeModal?.kind!=="group") return;
    const {unit}=activeModal;
    if(!grName.trim()||grSel.size===0) return;
    setSaving(true); setErrorMsg("");
    try {
      const np=await apiPost<{id:string}>("/organizational-units",{name:grName.trim(),type:grType,parentId:unit.id});
      await Promise.all([...grSel].map(childId=>apiPost(`/organizational-units/${np.id}/children`,{childId})));
      setActiveModal(null);
      setExpandedIds(prev=>new Set([...prev,unit.id,np.id]));
      setSelectedId(np.id); await loadUnits(); loadDetail(np.id);
    } catch(e){setErrorMsg(e instanceof Error?e.message:"Group failed.");}
    finally{setSaving(false);}
  };

  // Create Church wizard
  const initChurchWizard=()=>{
    if(!selectedUnit) return;
    setActiveModal({kind:"church",unit:selectedUnit,step:1,churchName:"",zoneName:"",branchName:"",selectedIds:new Set()});
  };
  const handleCreateChurch=async()=>{
    if(activeModal?.kind!=="church") return;
    const {unit,churchName,zoneName,branchName,selectedIds}=activeModal;
    if(!churchName.trim()||!zoneName.trim()||!branchName.trim()) return;
    setSaving(true); setErrorMsg("");
    try {
      const church = await apiPost<{id:string}>("/organizational-units",{name:churchName.trim(),type:"CHURCH"});
      const zone   = await apiPost<{id:string}>("/organizational-units",{name:zoneName.trim(),  type:"ZONE",   parentId:church.id});
      const branch = await apiPost<{id:string}>("/organizational-units",{name:branchName.trim(),type:"BRANCH", parentId:zone.id});
      const toMove = selectedIds.size>0 ? [...selectedIds] : [unit.id];
      await Promise.all(toMove.map(id=>apiPost(`/organizational-units/${branch.id}/children`,{childId:id})));
      setActiveModal(null); setExpandedIds(prev=>new Set([...prev,church.id,zone.id,branch.id]));
      setSelectedId(church.id); await loadUnits(); loadDetail(church.id);
    } catch(e){setErrorMsg(e instanceof Error?e.message:"Failed to create church.");}
    finally{setSaving(false);}
  };

  // ── Render ─────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full" style={{maxHeight:"calc(100vh - 64px)"}}>
      <Header title="Org Chart" subtitle={`${allUnits.length} units · ${writeIds.size} editable by you`}/>

      {/* Error toast */}
      <AnimatePresence>
        {errorMsg && (
          <motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}}
            className="mx-6 mt-3 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm flex items-center gap-2.5 shrink-0">
            <AlertTriangle size={14} className="shrink-0 text-red-400"/>
            <span className="flex-1">{errorMsg}</span>
            <button onClick={()=>setErrorMsg("")}><X size={13} className="text-red-300 hover:text-red-500"/></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Move mode banner */}
      <AnimatePresence>
        {moveSource && (
          <motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}}
            className="mx-6 mt-3 px-4 py-3 rounded-xl border flex items-center gap-3 shrink-0"
            style={{background:`${TYPE_COLOR[moveSource.type]}10`,borderColor:`${TYPE_COLOR[moveSource.type]}40`}}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0"
              style={{background:TYPE_COLOR[moveSource.type]}}>
              {(()=>{const I=TYPE_ICON[moveSource.type];return <I size={14}/>;})()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-700">
                Moving <span style={{color:TYPE_COLOR[moveSource.type]}}>{moveSource.name}</span>
              </p>
              <p className="text-xs text-slate-400">
                {moveTargets&&moveTargets.size>0
                  ? `${moveTargets.size} valid ${PARENT_TYPE[moveSource.type]} destination${moveTargets.size>1?"s":""} highlighted — click one`
                  : "No valid destinations in your scope for this unit type"}
              </p>
            </div>
            <motion.button whileTap={{scale:0.95}} onClick={()=>setMoveSource(null)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50">
              <X size={11}/> Cancel
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toolbar */}
      <div className="px-6 py-3 flex items-center gap-2 border-b border-slate-100 bg-white/80 backdrop-blur-sm shrink-0 flex-wrap">
        {/* Type count pills */}
        <div className="flex gap-1.5 flex-1 flex-wrap min-w-0">
          {ALL_TYPES.filter(t=>typeCount[t]).map(t=>{
            const TIcon=TYPE_ICON[t];
            return (
              <div key={t} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold text-white"
                style={{background:TYPE_COLOR[t],boxShadow:`0 2px 6px ${TYPE_COLOR[t]}44`}}>
                <TIcon size={9}/>
                {TYPE_LABEL[t]} <span className="opacity-75 ml-0.5">{typeCount[t]}</span>
              </div>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative shrink-0">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
          <input type="text" placeholder="Search…" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-sm rounded-xl border border-slate-200 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 w-36 transition-all"/>
          <AnimatePresence>
            {searchQuery&&<motion.button initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2"><X size={11} className="text-slate-400 hover:text-slate-700"/></motion.button>}
          </AnimatePresence>
        </div>

        {/* View toggle */}
        <div className="flex bg-slate-100 rounded-xl p-0.5 shrink-0">
          {([["chart","Chart",LayoutGrid],["list","List",List]] as const).map(([v,l,I])=>(
            <button key={v} onClick={()=>setViewMode(v as "chart"|"list")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${viewMode===v?"bg-white shadow-sm text-slate-800":"text-slate-500"}`}>
              <I size={12}/>{l}
            </button>
          ))}
        </div>

        {/* Chart-only controls */}
        {viewMode==="chart" && <>
          <div className="flex gap-1 shrink-0">
            <motion.button whileTap={{scale:0.93}} onClick={()=>setExpandedIds(new Set(allUnits.map(u=>u.id)))}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-500 bg-slate-50 border border-slate-100 hover:bg-slate-100">
              <Maximize2 size={11}/> All
            </motion.button>
            <motion.button whileTap={{scale:0.93}} onClick={()=>setExpandedIds(new Set(visibleTree.map(r=>r.id)))}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-500 bg-slate-50 border border-slate-100 hover:bg-slate-100">
              <Minimize2 size={11}/> Collapse
            </motion.button>
          </div>

          <div className="flex items-center gap-1 bg-slate-50 border border-slate-100 rounded-xl px-1 shrink-0">
            <motion.button whileTap={{scale:0.9}} onClick={()=>zoomBy(-0.1)}
              className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-200"><ZoomOut size={12}/></motion.button>
            <button onClick={zoomToFit} className="text-xs font-bold text-slate-500 w-9 text-center hover:text-slate-800">
              {displayZoom}%
            </button>
            <motion.button whileTap={{scale:0.9}} onClick={()=>zoomBy(0.1)}
              className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-200"><ZoomIn size={12}/></motion.button>
          </div>
        </>}

        <motion.button whileTap={{scale:0.9}} onClick={loadUnits}
          className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 border border-slate-100 shrink-0">
          <motion.div animate={loading?{rotate:360}:{}} transition={loading?{duration:1,repeat:Infinity,ease:"linear"}:{}}>
            <RefreshCw size={13}/>
          </motion.div>
        </motion.button>

        {/* New unit — only if role allows creating top-level units */}
        {isHighPrivilege(role) && (
          <motion.button whileHover={{scale:1.03}} whileTap={{scale:0.97}}
            onClick={()=>openCreate(null,"CHURCH",["CHURCH"])}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-lg shrink-0"
            style={{background:"linear-gradient(135deg,#1e3a8a,#121D55)",boxShadow:"0 4px 14px rgba(18,29,85,.35)"}}>
            <Plus size={14}/> New Church
          </motion.button>
        )}
      </div>

      {/* Focus bar */}
      <AnimatePresence>
        {focusId && (
          <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:"auto"}} exit={{opacity:0,height:0}}
            className="px-6 py-2 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2 shrink-0">
            <button onClick={()=>{setFocusId(null);setSelectedId(null);setDetailUnit(null);}}
              className="flex items-center gap-1.5 text-xs text-indigo-600 font-semibold hover:text-indigo-800">
              <CornerUpLeft size={12}/> Exit Focus
            </button>
            <span className="text-indigo-300">·</span>
            {breadcrumb.map((u,i)=>{const I=TYPE_ICON[u.type];return(
              <span key={u.id} className="flex items-center gap-1 text-xs">
                {i>0&&<ChevronRight size={10} className="text-indigo-300"/>}
                <I size={10} style={{color:TYPE_COLOR[u.type]}}/>
                <span className={i===breadcrumb.length-1?"font-semibold text-indigo-700":"text-indigo-400"}>{u.name}</span>
              </span>
            );})}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* ── Chart view ── */}
        {viewMode==="chart" && (
          <div ref={canvasRef}
            className="flex-1 overflow-hidden"
            style={{background:"radial-gradient(circle,#cbd5e1 1px,transparent 1px)",backgroundSize:"28px 28px",backgroundColor:"#f1f5f9",cursor:"grab"}}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            onWheel={handleWheel}
            onClick={()=>{if(!moveSource){setSelectedId(null);setDetailUnit(null);}}}
          >
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div key="loading" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
                  className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
                  <motion.div animate={{rotate:360}} transition={{duration:1.2,repeat:Infinity,ease:"linear"}}>
                    <RefreshCw size={28} className="text-slate-300"/>
                  </motion.div>
                  <p className="text-sm font-medium">Loading org chart…</p>
                </motion.div>
              ) : displayTree.length===0 ? (
                <motion.div key="empty" initial={{opacity:0}} animate={{opacity:1}}
                  className="flex flex-col items-center justify-center h-full gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-white shadow-md flex items-center justify-center">
                    <Church size={28} className="text-slate-300"/>
                  </div>
                  <p className="text-slate-400 text-sm font-medium">No units visible for your role</p>
                  {isHighPrivilege(role) && (
                    <motion.button whileHover={{scale:1.04}} whileTap={{scale:0.96}}
                      onClick={()=>openCreate(null,"CHURCH",["CHURCH"])}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
                      style={{background:"linear-gradient(135deg,#1e3a8a,#121D55)"}}>
                      <Plus size={14}/> Create First Church
                    </motion.button>
                  )}
                </motion.div>
              ) : (
                <div ref={treeRef} className="absolute" style={{transformOrigin:"0 0",paddingBottom:80}}>
                  <div className="flex gap-16 items-start p-12 min-w-max"
                    onClick={e=>e.stopPropagation()}>
                    {displayTree.map(root=>(
                      <OrgTree key={root.id} unit={root} selectedId={selectedId}
                        expandedIds={expandedIds} onSelect={handleSelect} onToggle={handleToggle}
                        searchQuery={searchQuery} moveSourceId={moveSource?.id??null}
                        moveTargetIds={moveTargets??null} onMoveTarget={handleMoveTarget}
                        writeIds={writeIds} stagger={0}/>
                    ))}
                  </div>
                </div>
              )}
            </AnimatePresence>

            {/* Zoom hint */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-slate-400 pointer-events-none select-none">
              Drag to pan · Ctrl+scroll to zoom · Click a card to inspect
            </div>
          </div>
        )}

        {/* ── List view ── */}
        {viewMode==="list" && (
          <div className="flex-1 overflow-hidden bg-slate-50">
            <DrillView roots={visibleTree} onSelect={handleSelect} writeIds={writeIds}/>
          </div>
        )}

        {/* ── Detail Drawer ── */}
        <AnimatePresence>
          {selectedUnit && !moveSource && (
            <motion.aside key="drawer" variants={drawerV} initial="closed" animate="open" exit="closed"
              transition={{type:"spring",stiffness:340,damping:34}}
              className="w-80 shrink-0 bg-white border-l border-slate-100 overflow-y-auto"
              style={{boxShadow:"-6px 0 32px rgba(0,0,0,.08)"}}>
              <div className="p-5 space-y-4">

                {/* Close */}
                <div className="flex justify-end">
                  <motion.button whileHover={{rotate:90}} transition={{type:"spring",stiffness:400,damping:22}}
                    onClick={()=>{setSelectedId(null);setDetailUnit(null);}}
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-300 hover:text-slate-600 hover:bg-slate-100">
                    <X size={16}/>
                  </motion.button>
                </div>

                {/* Hero */}
                <div className="flex flex-col items-center text-center gap-3">
                  <motion.div layoutId={`hero-${selectedUnit.id}`}
                    className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl"
                    style={{background:`linear-gradient(145deg,${color}dd,${color})`,boxShadow:`0 8px 28px ${color}44`}}>
                    <TypeIcon size={24} className="text-white"/>
                  </motion.div>
                  <div>
                    <div className="flex items-center gap-1.5 justify-center">
                      <p className="text-base font-bold text-slate-800">{selectedUnit.name}</p>
                      {!canEditSelected && <Lock size={12} className="text-slate-300"/>}
                    </div>
                    <span className="inline-flex items-center gap-1.5 mt-1.5 text-xs font-bold px-3 py-1 rounded-full text-white"
                      style={{background:`linear-gradient(135deg,${color}cc,${color})`}}>
                      <TypeIcon size={10}/>{TYPE_LABEL[selectedUnit.type]}
                    </span>
                  </div>
                  {selectedRaw && (
                    <div className="flex gap-2 w-full">
                      {[["Members",selectedRaw.memberships.length],["Sub-units",selectedUnit.children.length],["Depth",selectedUnit.ancestors.length]].map(([l,v])=>(
                        <div key={l as string} className="flex-1 bg-slate-50 rounded-xl py-2 border border-slate-100">
                          <p className="text-sm font-bold text-slate-700">{v}</p>
                          <p className="text-[10px] text-slate-400 font-medium">{l}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Leader */}
                {detailLoading ? (
                  <div className="h-16 rounded-xl bg-slate-50 animate-pulse border border-slate-100"/>
                ) : leader ? (
                  <div className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-100 bg-slate-50/60">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0"
                      style={{background:`linear-gradient(145deg,${color}cc,${color})`}}>
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
                    <UserCircle2 size={26} className="text-slate-200 shrink-0"/>
                    <p className="text-xs text-slate-400">No leader assigned</p>
                  </div>
                )}

                {/* Parent */}
                {detailUnit?.parent && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                    <ChevronUp size={11} className="text-slate-300 shrink-0"/>
                    <span className="text-slate-400">Under:</span>
                    <span className="font-semibold text-slate-600 truncate">{detailUnit.parent.name}</span>
                    <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
                      style={{background:TYPE_COLOR[detailUnit.parent.type]}}>
                      {TYPE_LABEL[detailUnit.parent.type]}
                    </span>
                  </div>
                )}

                <div className="h-px bg-slate-100"/>

                {/* ── Safe operations ── */}
                {canEditSelected && (
                  <Section label="Safe" tier="safe">
                    {childTypeSuggested && (
                      <ActionBtn icon={Plus} label={`Add ${TYPE_LABEL[childTypeSuggested]}`}
                        sublabel="Create a direct child of this unit" accent={color}
                        onClick={()=>{
                          const allowed=ROLE_CREATABLE[role??"MEMBER"]??[];
                          openCreate(selectedUnit.id,childTypeSuggested,allowed);
                        }}/>
                    )}
                    <ActionBtn icon={Pencil} label="Rename"
                      sublabel="Change the name of this unit"
                      onClick={()=>setActiveModal({kind:"rename",unit:selectedUnit})}/>
                  </Section>
                )}

                {/* ── Controlled operations ── */}
                {canEditSelected && (
                  <Section label="Controlled" tier="controlled">
                    {selectedUnit.parentId && (
                      <ActionBtn icon={ArrowRightLeft} label="Move to valid parent"
                        sublabel={`Reparent under a different ${PARENT_TYPE[selectedUnit.type]??"-"}`}
                        accent="#3b82f6"
                        locked={!PARENT_TYPE[selectedUnit.type]}
                        onClick={()=>{setMoveSource(selectedUnit);setSelectedId(null);setDetailUnit(null);}}/>
                    )}
                    <ActionBtn icon={Scissors} label="Split unit"
                      sublabel={`Divide children across 2 new ${TYPE_LABEL[selectedUnit.type]}s`}
                      accent="#f59e0b" disabled={selectedUnit.children.length<2}
                      onClick={openSplit}/>
                    <ActionBtn icon={Layers} label="Group children"
                      sublabel="Bundle selected children under a new sub-unit"
                      accent="#8b5cf6" disabled={selectedUnit.children.length<2}
                      onClick={openGroup}/>
                  </Section>
                )}

                {/* ── Restricted operations (BISHOP/ADMIN only) ── */}
                <Section label={isHighPrivilege(role)?"Restricted":"Restricted (Bishop/Admin only)"} tier="restricted">
                  <ActionBtn icon={Church} label="Spin off new Church"
                    sublabel="Create CHURCH→ZONE→BRANCH scaffold and move this unit under it"
                    locked={!isHighPrivilege(role)}
                    onClick={isHighPrivilege(role)?initChurchWizard:()=>{}}/>
                  {canEditSelected && (
                    <ActionBtn icon={Trash2} label="Delete unit" danger
                      sublabel={selectedUnit.children.length>0?"Must remove all sub-units first":"Permanently removes this leaf unit"}
                      disabled={selectedUnit.children.length>0}
                      locked={!isHighPrivilege(role)}
                      onClick={isHighPrivilege(role)?handleDelete:()=>{}}/>
                  )}
                </Section>

                {/* Focus */}
                <button onClick={()=>{setFocusId(selectedId);setExpandedIds(new Set(flattenTree(selectedUnit).map(u=>u.id)));}}
                  className="w-full text-center text-xs text-slate-400 hover:text-slate-600 py-1">
                  Focus on this subtree →
                </button>

              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* ══ MODALS ══════════════════════════════════════════════════════════════ */}

      {activeModal?.kind==="create" && (
        <Modal title={activeModal.parentId?"Add child unit":"Create root unit"} icon={Plus} onClose={()=>setActiveModal(null)}>
          <div className="space-y-5">
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-2">Unit name</label>
              <input value={cName} onChange={e=>setCName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleCreate()}
                placeholder="e.g. North Zone" autoFocus
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"/>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-2.5">Type</label>
              <TypePicker value={cType} onChange={setCType} allowed={activeModal.allowedTypes}/>
              {activeModal.parentId && cType!==activeModal.suggested && (
                <p className="text-xs text-amber-500 mt-2 flex items-center gap-1.5">
                  <AlertTriangle size={11}/> Suggested type: <strong>{activeModal.suggested}</strong>
                </p>
              )}
            </div>
            <motion.button whileTap={{scale:0.97}} onClick={handleCreate} disabled={saving||!cName.trim()}
              className="w-full py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              style={{background:`linear-gradient(135deg,${TYPE_COLOR[cType]}ee,${TYPE_COLOR[cType]})`,boxShadow:`0 6px 20px ${TYPE_COLOR[cType]}44`}}>
              {saving?<motion.div animate={{rotate:360}} transition={{duration:1,repeat:Infinity,ease:"linear"}}><RefreshCw size={14}/></motion.div>:<Plus size={14}/>}
              {saving?"Creating…":`Create ${TYPE_LABEL[cType]}`}
            </motion.button>
          </div>
        </Modal>
      )}

      {activeModal?.kind==="rename" && (
        <RenameModal unit={activeModal.unit} onClose={()=>setActiveModal(null)} onSave={handleRename} saving={saving}/>
      )}

      {activeModal?.kind==="split" && (
        <Modal title={`Split "${activeModal.unit.name}"`} icon={Scissors} wide onClose={()=>setActiveModal(null)}>
          <div className="space-y-5">
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-xs text-amber-700 flex items-start gap-2">
              <AlertTriangle size={13} className="shrink-0 mt-0.5"/>
              Two new sibling units are created at the same level. Children are redistributed and the original unit is deleted.
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[["Group A",spNameA,setSpNameA],["Group B",spNameB,setSpNameB]].map(([l,v,s])=>(
                <div key={l as string}>
                  <label className="text-xs font-semibold text-slate-600 block mb-1.5">{l as string}</label>
                  <input value={v as string} onChange={e=>(s as (v:string)=>void)(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"/>
                </div>
              ))}
            </div>
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-xs font-semibold text-slate-600">Assign children (click to toggle A/B)</p>
                <div className="flex gap-3 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400"/>A:{spGroupA.size}</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300"/>B:{activeModal.unit.children.length-spGroupA.size}</span>
                </div>
              </div>
              <div className="space-y-1.5 max-h-56 overflow-y-auto rounded-xl border border-slate-100 p-2">
                {activeModal.unit.children.map(c=>{
                  const inA=spGroupA.has(c.id); const CI=TYPE_ICON[c.type];
                  return (
                    <motion.button type="button" key={c.id} whileTap={{scale:0.98}}
                      onClick={()=>setSpGroupA(prev=>{const n=new Set(prev);n.has(c.id)?n.delete(c.id):n.add(c.id);return n;})}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all ${inA?"border-amber-200 bg-amber-50":"border-slate-100 hover:bg-slate-50"}`}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0" style={{background:TYPE_COLOR[c.type]}}><CI size={12}/></div>
                      <span className="text-sm text-slate-700 flex-1">{c.name}</span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full text-white ${inA?"bg-amber-400":"bg-slate-300"}`}>{inA?"A":"B"}</span>
                    </motion.button>
                  );
                })}
              </div>
            </div>
            <motion.button whileTap={{scale:0.97}} onClick={handleSplit}
              disabled={saving||!spNameA.trim()||!spNameB.trim()}
              className="w-full py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600">
              {saving?<motion.div animate={{rotate:360}} transition={{duration:1,repeat:Infinity,ease:"linear"}}><RefreshCw size={14}/></motion.div>:<Scissors size={14}/>}
              {saving?"Splitting…":"Confirm Split"}
            </motion.button>
          </div>
        </Modal>
      )}

      {activeModal?.kind==="group" && (
        <Modal title={`Group children of "${activeModal.unit.name}"`} icon={Layers} wide onClose={()=>setActiveModal(null)}>
          <div className="space-y-5">
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-2">New group name</label>
              <input value={grName} onChange={e=>setGrName(e.target.value)} placeholder="e.g. East BC Cluster" autoFocus
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"/>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-2.5">Type</label>
              <TypePicker value={grType} onChange={setGrType} allowed={ROLE_CREATABLE[role??"MEMBER"]??[]}/>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-xs font-semibold text-slate-600">Select children to move in</p>
                <span className="text-[11px] text-slate-400">{grSel.size} selected</span>
              </div>
              <div className="space-y-1.5 max-h-56 overflow-y-auto rounded-xl border border-slate-100 p-2">
                {activeModal.unit.children.map(c=>{
                  const sel=grSel.has(c.id); const CI=TYPE_ICON[c.type];
                  return (
                    <motion.button type="button" key={c.id} whileTap={{scale:0.98}}
                      onClick={()=>setGrSel(prev=>{const n=new Set(prev);n.has(c.id)?n.delete(c.id):n.add(c.id);return n;})}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all ${sel?"border-violet-200 bg-violet-50":"border-slate-100 hover:bg-slate-50"}`}>
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${sel?"bg-violet-500 border-violet-500":"border-slate-200 bg-white"}`}>
                        {sel&&<Check size={11} className="text-white"/>}
                      </div>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0" style={{background:TYPE_COLOR[c.type]}}><CI size={12}/></div>
                      <span className="text-sm text-slate-700 flex-1">{c.name}</span>
                      {c.memberships.length>0&&<span className="text-[10px] text-slate-400 flex items-center gap-1"><Users size={9}/>{c.memberships.length}</span>}
                    </motion.button>
                  );
                })}
              </div>
            </div>
            <motion.button whileTap={{scale:0.97}} onClick={handleGroup}
              disabled={saving||!grName.trim()||grSel.size===0}
              className="w-full py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              style={{background:"linear-gradient(135deg,#8b5cf6,#7c3aed)",boxShadow:"0 6px 20px #8b5cf644"}}>
              {saving?<motion.div animate={{rotate:360}} transition={{duration:1,repeat:Infinity,ease:"linear"}}><RefreshCw size={14}/></motion.div>:<Layers size={14}/>}
              {saving?"Creating…":`Group ${grSel.size} units`}
            </motion.button>
          </div>
        </Modal>
      )}

      {/* ── Create Church wizard ── */}
      {activeModal?.kind==="church" && (
        <Modal title="Spin Off New Church" icon={Church} wide onClose={()=>setActiveModal(null)}>
          <ChurchWizard
            modal={activeModal}
            onChange={patch=>setActiveModal(prev=>prev?.kind==="church"?{...prev,...patch}:prev)}
            onSubmit={handleCreateChurch}
            saving={saving}
          />
        </Modal>
      )}
    </div>
  );
}

// ── Rename Modal ───────────────────────────────────────────────────────────────

function RenameModal({ unit, onClose, onSave, saving }: {
  unit:OrgUnit; onClose:()=>void; onSave:(name:string)=>void; saving:boolean;
}) {
  const [name,setName]=useState(unit.name);
  const color=TYPE_COLOR[unit.type]; const Icon=TYPE_ICON[unit.type];
  return (
    <Modal title="Rename unit" icon={Icon} onClose={onClose}>
      <div className="space-y-5">
        <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0" style={{background:color}}><Icon size={14}/></div>
          <div><p className="text-xs text-slate-400">Renaming</p><p className="text-sm font-semibold text-slate-700">{unit.name}</p></div>
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-700 block mb-2">New name</label>
          <input value={name} onChange={e=>setName(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter")onSave(name);if(e.key==="Escape")onClose();}}
            autoFocus
            className="w-full px-4 py-3 rounded-xl border-2 text-sm font-semibold outline-none"
            style={{borderColor:color,boxShadow:`0 0 0 3px ${color}15`}}/>
        </div>
        <div className="flex gap-2">
          <motion.button whileTap={{scale:0.97}} onClick={()=>onSave(name)} disabled={saving||!name.trim()||name===unit.name}
            className="flex-1 py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            style={{background:color,boxShadow:`0 4px 14px ${color}44`}}>
            {saving?<motion.div animate={{rotate:360}} transition={{duration:1,repeat:Infinity,ease:"linear"}}><RefreshCw size={14}/></motion.div>:<Check size={14}/>}
            {saving?"Saving…":"Save"}
          </motion.button>
          <motion.button whileTap={{scale:0.97}} onClick={onClose}
            className="px-5 py-3 rounded-xl text-sm font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200">
            Cancel
          </motion.button>
        </div>
      </div>
    </Modal>
  );
}

// ── Church Wizard (multi-step) ────────────────────────────────────────────────

type ChurchModal = Extract<ActiveModal, { kind: "church" }>;

function ChurchWizard({ modal, onChange, onSubmit, saving }: {
  modal: ChurchModal;
  onChange: (patch: Partial<ChurchModal>) => void;
  onSubmit: () => void;
  saving: boolean;
}) {
  const { step, unit, churchName, zoneName, branchName, selectedIds } = modal;
  const siblings = unit.parentId
    ? (findInTree(buildTree([]) /* we don't have tree here — use unit.children */ , unit.parentId)?.children ?? [])
    : [];

  const steps = [
    { label:"Name Church", desc:"Create the new Church unit" },
    { label:"Name Zone",   desc:"A Zone is required under every Church" },
    { label:"Name Branch", desc:"A Branch is required under every Zone" },
    { label:"Move units",  desc:"Choose which existing units move under the new Branch" },
  ];

  const canProceed = step===1?!!churchName.trim() : step===2?!!zoneName.trim() : step===3?!!branchName.trim() : true;

  return (
    <div className="space-y-5">
      {/* Step indicators */}
      <div className="flex items-center gap-2">
        {steps.map((s,i)=>{
          const n=i+1 as 1|2|3|4;
          const done=step>n, active=step===n;
          return (
            <div key={n} className="flex items-center gap-2 flex-1 min-w-0">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all
                ${done?"bg-emerald-500 text-white":active?"bg-blue-600 text-white":"bg-slate-100 text-slate-400"}`}>
                {done?<Check size={12}/>:n}
              </div>
              <div className="min-w-0 hidden sm:block">
                <p className={`text-xs font-semibold truncate ${active?"text-slate-800":"text-slate-400"}`}>{s.label}</p>
              </div>
              {i<steps.length-1 && <div className={`flex-1 h-px ${step>n?"bg-emerald-300":"bg-slate-200"}`}/>}
            </div>
          );
        })}
      </div>

      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-sm text-slate-600">
        {steps[step-1].desc}
      </div>

      {step===1 && (
        <div>
          <label className="text-sm font-semibold text-slate-700 block mb-2">Church name</label>
          <input value={churchName} onChange={e=>onChange({churchName:e.target.value})} autoFocus
            placeholder="e.g. RCCG Lagos Mainland"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"/>
        </div>
      )}
      {step===2 && (
        <div>
          <label className="text-sm font-semibold text-slate-700 block mb-2">Zone name</label>
          <input value={zoneName} onChange={e=>onChange({zoneName:e.target.value})} autoFocus
            placeholder={`e.g. ${churchName} Zone`}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"/>
        </div>
      )}
      {step===3 && (
        <div>
          <label className="text-sm font-semibold text-slate-700 block mb-2">Branch name</label>
          <input value={branchName} onChange={e=>onChange({branchName:e.target.value})} autoFocus
            placeholder={`e.g. ${zoneName} Branch`}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100"/>
        </div>
      )}
      {step===4 && (
        <div>
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700 mb-3">
            <strong>{unit.name}</strong> and any selected siblings will move under the new Branch. Leave blank to move only <strong>{unit.name}</strong>.
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto rounded-xl border border-slate-100 p-2">
            {/* Always include the source unit, pre-checked */}
            <div className="flex items-center gap-3 p-2.5 rounded-xl border border-blue-200 bg-blue-50">
              <div className="w-5 h-5 rounded-md bg-blue-500 flex items-center justify-center shrink-0"><Check size={11} className="text-white"/></div>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0" style={{background:TYPE_COLOR[unit.type]}}>
                {(()=>{const I=TYPE_ICON[unit.type];return <I size={12}/>;})()}
              </div>
              <span className="text-sm font-semibold text-slate-700 flex-1">{unit.name} <span className="text-blue-500 text-[10px]">(this unit)</span></span>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-2 text-center">
            Will create: <strong className="text-red-500">{churchName}</strong> → <strong className="text-cyan-500">{zoneName}</strong> → <strong className="text-pink-500">{branchName}</strong> → <strong>{unit.name}</strong>
          </p>
        </div>
      )}

      <div className="flex gap-2">
        {step>1 && (
          <motion.button whileTap={{scale:0.97}} onClick={()=>onChange({step:(step-1) as 1|2|3|4})}
            className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200">
            <ChevronLeft size={14}/> Back
          </motion.button>
        )}
        {step<4 ? (
          <motion.button whileTap={{scale:0.97}} onClick={()=>onChange({step:(step+1) as 1|2|3|4})}
            disabled={!canProceed}
            className="flex-1 py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700">
            Next <ChevronRight size={14}/>
          </motion.button>
        ) : (
          <motion.button whileTap={{scale:0.97}} onClick={onSubmit} disabled={saving}
            className="flex-1 py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            style={{background:"linear-gradient(135deg,#ef4444,#dc2626)",boxShadow:"0 6px 20px #ef444444"}}>
            {saving?<motion.div animate={{rotate:360}} transition={{duration:1,repeat:Infinity,ease:"linear"}}><RefreshCw size={14}/></motion.div>:<Church size={14}/>}
            {saving?"Creating…":"Create Church"}
          </motion.button>
        )}
      </div>
    </div>
  );
}
