"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  UserCircle2, UserPlus, Mail, X, Check, Clock, Send, Trash2, Loader2, ShieldAlert,
} from "lucide-react";
import { apiFetch, apiPost, apiDelete, apiPatch } from "@/lib/api";
import type { Leadership, Member, PagedUsers, PendingInvite } from "@/types/api";

/**
 * Appointing and standing down leaders.
 *
 * Until this existed, making someone the shepherd of a cell meant opening a
 * database client — the API had the endpoints, but nothing in the product
 * reached them. Everything here is delegation: the two paths are "this person
 * already has an account" and "this person hasn't signed up yet", and the
 * second one is the normal case during a rollout.
 */

type UnitType = "CHURCH" | "ZONE" | "BRANCH" | "MC" | "BC" | "CELL" | "SHEPHERD";

/** Which roles make sense at each level of the tree. */
const ROLES_FOR_TYPE: Record<UnitType, string[]> = {
  CHURCH: ["BISHOP", "ADMIN", "CHURCH_HEAD"],
  ZONE: ["ZONE_LEADER"],
  BRANCH: ["BRANCH_HEAD"],
  MC: ["MC_HEAD"],
  BC: ["BC_HEAD"],
  CELL: ["CELL_LEADER", "SHEPHERD"],
  SHEPHERD: ["SHEPHERD"],
};

const ROLE_LABEL: Record<string, string> = {
  BISHOP: "Bishop",
  ADMIN: "Administrator",
  CHURCH_HEAD: "Church Head",
  ZONE_LEADER: "Zone Leader",
  BRANCH_HEAD: "Branch Pastor",
  MC_HEAD: "MC Head",
  BC_HEAD: "BC Head",
  CELL_LEADER: "Cell Leader",
  SHEPHERD: "Shepherd",
};

const initials = (a?: string, b?: string) =>
  `${a?.[0] ?? ""}${b?.[0] ?? ""}`.toUpperCase() || "?";

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric", month: "short", year: "numeric",
  });
}

export default function LeadershipPanel({
  unitId,
  unitType,
  unitName,
  accent,
  canManage,
  onChanged,
}: {
  unitId: string;
  unitType: UnitType;
  unitName: string;
  accent: string;
  canManage: boolean;
  onChanged?: () => void;
}) {
  const [leaders, setLeaders] = useState<Leadership[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appointOpen, setAppointOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [l, i] = await Promise.all([
        apiFetch<Leadership[]>(`/leadershipunit/unit/${unitId}`),
        apiFetch<PendingInvite[]>(
          `/pending-invites/by-unit/${unitId}?inviteType=LEADERSHIP`,
        ).catch(() => [] as PendingInvite[]),
      ]);
      setLeaders(l);
      setInvites(i);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load leaders");
    } finally {
      setLoading(false);
    }
  }, [unitId]);

  useEffect(() => { load(); }, [load]);

  const standDown = async (leadership: Leadership) => {
    const who = `${leadership.user.firstName} ${leadership.user.lastName}`;
    if (!confirm(
      `Stand ${who} down as ${ROLE_LABEL[leadership.role] ?? leadership.role} of ${unitName}?\n\n` +
      `They keep their account and their place in the record — this ends the appointment from today.`
    )) return;

    setBusyId(leadership.id);
    try {
      await apiPatch(`/leadershipunit/${leadership.id}/end`, {});
      await load();
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't stand this leader down");
    } finally {
      setBusyId(null);
    }
  };

  const resendInvite = async (invite: PendingInvite) => {
    setBusyId(invite.id);
    try {
      await apiPost(`/pending-invites/${invite.id}/resend`, {});
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't resend the invitation");
    } finally {
      setBusyId(null);
    }
  };

  const revokeInvite = async (invite: PendingInvite) => {
    if (!confirm(`Cancel the invitation to ${invite.email}?`)) return;
    setBusyId(invite.id);
    try {
      await apiDelete(`/pending-invites/${invite.id}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't cancel the invitation");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Leadership
        </p>
        {canManage && (
          <button
            onClick={() => setAppointOpen(true)}
            className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg text-white transition-opacity hover:opacity-90"
            style={{ background: accent }}
          >
            <UserPlus size={11} /> Appoint
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-rose-50 border border-rose-100">
          <ShieldAlert size={13} className="text-rose-500 shrink-0 mt-0.5" />
          <p className="text-[11px] text-rose-700 leading-snug">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="h-16 rounded-xl bg-slate-50 animate-pulse border border-slate-100" />
      ) : leaders.length === 0 && invites.length === 0 ? (
        <div className="flex items-center gap-3 p-3.5 rounded-xl border border-dashed border-slate-200">
          <UserCircle2 size={26} className="text-slate-200 shrink-0" />
          <div>
            <p className="text-xs text-slate-500 font-medium">No leader yet</p>
            {canManage && (
              <p className="text-[10px] text-slate-400">
                This unit has nobody responsible for it.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {leaders.map((l) => (
            <div
              key={l.id}
              className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/60"
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                style={{ background: `linear-gradient(145deg,${accent}cc,${accent})` }}
              >
                {initials(l.user.firstName, l.user.lastName)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-700 truncate">
                  {l.user.firstName} {l.user.lastName}
                </p>
                <p className="text-[10px] text-slate-500 truncate">
                  {ROLE_LABEL[l.role] ?? l.role} · since {formatDate(l.startDate)}
                </p>
                <p className="text-[10px] text-slate-400 truncate">{l.user.email}</p>
              </div>
              {canManage && (
                <button
                  onClick={() => standDown(l)}
                  disabled={busyId === l.id}
                  title="Stand down"
                  className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors disabled:opacity-40"
                >
                  {busyId === l.id ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                </button>
              )}
            </div>
          ))}

          {invites.map((inv) => (
            <div
              key={inv.id}
              className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-amber-200 bg-amber-50/50"
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-amber-100 shrink-0">
                <Clock size={14} className="text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-700 truncate">{inv.email}</p>
                <p className="text-[10px] text-amber-700">
                  Invited as {ROLE_LABEL[inv.role] ?? inv.role} · hasn&apos;t signed up yet
                </p>
              </div>
              {canManage && (
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => resendInvite(inv)}
                    disabled={busyId === inv.id}
                    title="Resend invitation"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-100 transition-colors disabled:opacity-40"
                  >
                    {busyId === inv.id ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                  </button>
                  <button
                    onClick={() => revokeInvite(inv)}
                    disabled={busyId === inv.id}
                    title="Cancel invitation"
                    className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors disabled:opacity-40"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {appointOpen && (
        <AppointModal
          unitId={unitId}
          unitType={unitType}
          unitName={unitName}
          accent={accent}
          onClose={() => setAppointOpen(false)}
          onDone={async () => { setAppointOpen(false); await load(); onChanged?.(); }}
        />
      )}
    </div>
  );
}

/**
 * Appointing someone, in two modes.
 *
 * "Search" is for people who already have accounts; "Invite by email" writes a
 * pending invite and sends it, and the role is applied automatically when they
 * register. The API's `appoint-by-email` route collapses both, so the email path
 * still works if the person turns out to have registered in the meantime.
 */
function AppointModal({
  unitId, unitType, unitName, accent, onClose, onDone,
}: {
  unitId: string;
  unitType: UnitType;
  unitName: string;
  accent: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const roles = useMemo(() => ROLES_FOR_TYPE[unitType] ?? ["SHEPHERD"], [unitType]);
  const [role, setRole] = useState(roles[0]);
  const [mode, setMode] = useState<"search" | "email">("search");

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Member[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<Member | null>(null);

  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  // Debounced search against the scoped, paged user endpoint. Before this was
  // scoped server-side, a picker like this would have listed the whole church.
  useEffect(() => {
    if (mode !== "search") return;
    const term = query.trim();
    if (term.length < 2) { setResults([]); return; }

    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const page = await apiFetch<PagedUsers>(
          `/users?search=${encodeURIComponent(term)}&pageSize=8`,
        );
        if (!cancelled) setResults(page.data);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 280);

    return () => { cancelled = true; clearTimeout(t); };
  }, [query, mode]);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      if (mode === "search") {
        if (!picked) { setError("Choose someone first"); setSaving(false); return; }
        await apiPost("/leadershipunit", { userId: picked.id, unitId, role });
        onDone();
      } else {
        const trimmed = email.trim().toLowerCase();
        if (!trimmed.includes("@")) { setError("Enter a valid email address"); setSaving(false); return; }
        const res = await apiPost<{ status: "APPOINTED" | "INVITED" }>(
          "/leadershipunit/appoint-by-email",
          { email: trimmed, unitId, role },
        );
        if (res.status === "INVITED") {
          // Don't close — confirming the invite went out is the whole point.
          setResult(`Invitation sent to ${trimmed}. They'll be ${ROLE_LABEL[role] ?? role} of ${unitName} as soon as they register.`);
        } else {
          onDone();
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't complete the appointment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white" style={{ background: accent }}>
              <UserPlus size={15} />
            </div>
            <div>
              <p className="font-bold text-slate-800 text-sm">Appoint a leader</p>
              <p className="text-[11px] text-slate-400">{unitName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>

        {result ? (
          <div className="p-6 space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-100">
              <Check size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              <p className="text-sm text-emerald-800 leading-snug">{result}</p>
            </div>
            <button
              onClick={onDone}
              className="w-full py-2.5 rounded-xl text-white text-sm font-semibold"
              style={{ background: accent }}
            >
              Done
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* Role */}
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-2">Role</label>
              <div className="flex flex-wrap gap-1.5">
                {roles.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRole(r)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      role === r
                        ? "text-white border-transparent"
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                    }`}
                    style={role === r ? { background: accent } : undefined}
                  >
                    {ROLE_LABEL[r] ?? r}
                  </button>
                ))}
              </div>
            </div>

            {/* Mode */}
            <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
              {([["search", "Existing member"], ["email", "Invite by email"]] as const).map(([m, label]) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setError(null); }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    mode === m ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {mode === "search" ? (
              <div>
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setPicked(null); }}
                  placeholder="Search by name or email…"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-slate-400"
                />
                <div className="mt-2 max-h-52 overflow-y-auto space-y-1">
                  {searching && (
                    <p className="text-[11px] text-slate-400 px-1 py-2 flex items-center gap-1.5">
                      <Loader2 size={11} className="animate-spin" /> Searching…
                    </p>
                  )}
                  {!searching && query.trim().length >= 2 && results.length === 0 && (
                    <p className="text-[11px] text-slate-400 px-1 py-2">
                      Nobody in your scope matches that. Try inviting them by email instead.
                    </p>
                  )}
                  {results.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setPicked(m)}
                      className={`w-full flex items-center gap-2.5 p-2 rounded-xl border text-left transition-colors ${
                        picked?.id === m.id
                          ? "border-transparent bg-slate-50 ring-2"
                          : "border-slate-100 hover:bg-slate-50"
                      }`}
                      style={picked?.id === m.id ? { boxShadow: `0 0 0 2px ${accent}` } : undefined}
                    >
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600 shrink-0">
                        {initials(m.firstName, m.lastName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-700 truncate">
                          {m.firstName} {m.lastName}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">{m.email}</p>
                      </div>
                      {picked?.id === m.id && <Check size={14} style={{ color: accent }} />}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-2">
                  Their email address
                </label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input
                    autoFocus
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="grace@church.org"
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-slate-400"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-2 leading-snug">
                  We&apos;ll email an invitation. When they register with this address
                  they become {ROLE_LABEL[role] ?? role} of {unitName} automatically —
                  there&apos;s nothing else to set up.
                </p>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-rose-50 border border-rose-100">
                <ShieldAlert size={13} className="text-rose-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-rose-700 leading-snug">{error}</p>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5"
                style={{ background: accent }}
              >
                {saving && <Loader2 size={13} className="animate-spin" />}
                {mode === "email" ? "Send invitation" : "Appoint"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
