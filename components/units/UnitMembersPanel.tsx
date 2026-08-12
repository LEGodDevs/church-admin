"use client";
import { useCallback, useEffect, useState } from "react";
import {
  Users, UserPlus, X, Check, Loader2, ShieldAlert, ArrowRightLeft, Mail, Clock, Send, Trash2,
} from "lucide-react";
import { apiFetch, apiPost, apiDelete } from "@/lib/api";
import type { Member, PagedUsers, PendingInvite } from "@/types/api";

/**
 * Who belongs to this unit, and moving them.
 *
 * Transfers go through `POST /organizational-units/members/transfer` rather than
 * a delete-and-recreate, because the schema deliberately preserves membership
 * history: a transfer closes the old row as TRANSFERRED and opens a new one, so
 * "which cell did this person come from" stays answerable. Rewriting the row by
 * hand would throw that away.
 */

interface UnitMember {
  id: string;
  userId: string;
  isPrimary: boolean;
  joinDate: string;
  status: string;
  user?: { id: string; firstName: string; lastName: string; email?: string };
}

const initials = (a?: string, b?: string) =>
  `${a?.[0] ?? ""}${b?.[0] ?? ""}`.toUpperCase() || "?";

export default function UnitMembersPanel({
  unitId, unitName, accent, canManage, onChanged,
}: {
  unitId: string;
  unitName: string;
  accent: string;
  canManage: boolean;
  onChanged?: () => void;
}) {
  const [members, setMembers] = useState<UnitMember[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [transferring, setTransferring] = useState<UnitMember | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [m, i] = await Promise.all([
        apiFetch<UnitMember[]>(`/membershipunit/unit/${unitId}`).catch(() => [] as UnitMember[]),
        apiFetch<PendingInvite[]>(
          `/pending-invites/by-unit/${unitId}?inviteType=MEMBERSHIP`,
        ).catch(() => [] as PendingInvite[]),
      ]);
      setMembers(m.filter((x) => x.status !== "TRANSFERRED"));
      setInvites(i);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load members");
    } finally {
      setLoading(false);
    }
  }, [unitId]);

  useEffect(() => { load(); }, [load]);

  const revokeInvite = async (inv: PendingInvite) => {
    if (!confirm(`Cancel the invitation to ${inv.email}?`)) return;
    setBusyId(inv.id);
    try {
      await apiDelete(`/pending-invites/${inv.id}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't cancel the invitation");
    } finally {
      setBusyId(null);
    }
  };

  const resendInvite = async (inv: PendingInvite) => {
    setBusyId(inv.id);
    try {
      await apiPost(`/pending-invites/${inv.id}/resend`, {});
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't resend the invitation");
    } finally {
      setBusyId(null);
    }
  };

  const shown = expanded ? members : members.slice(0, 5);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Members {members.length > 0 && `· ${members.length}`}
        </p>
        {canManage && (
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <UserPlus size={11} /> Add
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
        <div className="h-12 rounded-xl bg-slate-50 animate-pulse border border-slate-100" />
      ) : members.length === 0 && invites.length === 0 ? (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-slate-200">
          <Users size={20} className="text-slate-200 shrink-0" />
          <p className="text-xs text-slate-400">Nobody in this unit yet</p>
        </div>
      ) : (
        <div className="space-y-1">
          {shown.map((m) => (
            <div key={m.id} className="flex items-center gap-2.5 p-2 rounded-xl border border-slate-100">
              <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600 shrink-0">
                {initials(m.user?.firstName, m.user?.lastName)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-700 truncate">
                  {m.user?.firstName} {m.user?.lastName}
                </p>
                <p className="text-[10px] text-slate-400 truncate">{m.user?.email}</p>
              </div>
              {canManage && (
                <button
                  onClick={() => setTransferring(m)}
                  title="Move to another unit"
                  className="p-1.5 rounded-lg text-slate-300 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                >
                  <ArrowRightLeft size={12} />
                </button>
              )}
            </div>
          ))}

          {members.length > 5 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="w-full text-center text-[11px] text-slate-400 hover:text-slate-600 py-1"
            >
              {expanded ? "Show fewer" : `Show all ${members.length}`}
            </button>
          )}

          {invites.map((inv) => (
            <div key={inv.id} className="flex items-center gap-2.5 p-2 rounded-xl border border-dashed border-amber-200 bg-amber-50/50">
              <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                <Clock size={12} className="text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-700 truncate">{inv.email}</p>
                <p className="text-[10px] text-amber-700">Invited · hasn&apos;t signed up yet</p>
              </div>
              {canManage && (
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => resendInvite(inv)}
                    disabled={busyId === inv.id}
                    title="Resend"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-100 disabled:opacity-40"
                  >
                    {busyId === inv.id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                  </button>
                  <button
                    onClick={() => revokeInvite(inv)}
                    disabled={busyId === inv.id}
                    title="Cancel"
                    className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 disabled:opacity-40"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {addOpen && (
        <AddMemberModal
          unitId={unitId}
          unitName={unitName}
          accent={accent}
          onClose={() => setAddOpen(false)}
          onDone={async () => { setAddOpen(false); await load(); onChanged?.(); }}
        />
      )}

      {transferring && (
        <TransferModal
          member={transferring}
          fromUnitId={unitId}
          fromUnitName={unitName}
          accent={accent}
          onClose={() => setTransferring(null)}
          onDone={async () => { setTransferring(null); await load(); onChanged?.(); }}
        />
      )}
    </div>
  );
}

function AddMemberModal({
  unitId, unitName, accent, onClose, onDone,
}: {
  unitId: string; unitName: string; accent: string;
  onClose: () => void; onDone: () => void;
}) {
  const [mode, setMode] = useState<"search" | "email">("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Member[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<Member | null>(null);
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "search") return;
    const term = query.trim();
    if (term.length < 2) { setResults([]); return; }

    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const page = await apiFetch<PagedUsers>(`/users?search=${encodeURIComponent(term)}&pageSize=8`);
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
        await apiPost("/membershipunit", { userId: picked.id, unitId });
        onDone();
      } else {
        const trimmed = email.trim().toLowerCase();
        if (!trimmed.includes("@")) { setError("Enter a valid email address"); setSaving(false); return; }
        await apiPost("/pending-invites", {
          email: trimmed, unitId, role: "MEMBER", inviteType: "MEMBERSHIP",
        });
        setResult(`Invitation sent to ${trimmed}. They'll join ${unitName} as soon as they register.`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add this person");
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
              <p className="font-bold text-slate-800 text-sm">Add a member</p>
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
            <button onClick={onDone} className="w-full py-2.5 rounded-xl text-white text-sm font-semibold" style={{ background: accent }}>
              Done
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
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
                      Nobody in your scope matches that. Invite them by email instead.
                    </p>
                  )}
                  {results.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setPicked(m)}
                      className={`w-full flex items-center gap-2.5 p-2 rounded-xl border text-left transition-colors ${
                        picked?.id === m.id ? "border-transparent bg-slate-50" : "border-slate-100 hover:bg-slate-50"
                      }`}
                      style={picked?.id === m.id ? { boxShadow: `0 0 0 2px ${accent}` } : undefined}
                    >
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600 shrink-0">
                        {initials(m.firstName, m.lastName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-700 truncate">{m.firstName} {m.lastName}</p>
                        <p className="text-[10px] text-slate-400 truncate">{m.email}</p>
                      </div>
                      {picked?.id === m.id && <Check size={14} style={{ color: accent }} />}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-2">Their email address</label>
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
                  We&apos;ll email them. When they register with this address they
                  join {unitName} automatically.
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
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50">
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5"
                style={{ background: accent }}
              >
                {saving && <Loader2 size={13} className="animate-spin" />}
                {mode === "email" ? "Send invitation" : "Add to unit"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TransferModal({
  member, fromUnitId, fromUnitName, accent, onClose, onDone,
}: {
  member: UnitMember;
  fromUnitId: string;
  fromUnitName: string;
  accent: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [units, setUnits] = useState<{ id: string; name: string; type: string }[]>([]);
  const [target, setTarget] = useState<string>("");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ id: string; name: string; type: string }[]>("/organizational-units")
      .then((all) => setUnits(all.filter((u) => u.id !== fromUnitId)))
      .catch(() => setUnits([]));
  }, [fromUnitId]);

  const filtered = query.trim()
    ? units.filter((u) => u.name.toLowerCase().includes(query.trim().toLowerCase()))
    : units.slice(0, 40);

  const submit = async () => {
    if (!target) { setError("Choose where they're going"); return; }
    setSaving(true);
    setError(null);
    try {
      await apiPost("/organizational-units/members/transfer", {
        userIds: [member.userId],
        fromUnitId,
        toUnitId: target,
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't move this person");
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
              <ArrowRightLeft size={15} />
            </div>
            <div>
              <p className="font-bold text-slate-800 text-sm">
                Move {member.user?.firstName} {member.user?.lastName}
              </p>
              <p className="text-[11px] text-slate-400">Currently in {fromUnitName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for the unit they're moving to…"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-slate-400"
          />

          <div className="max-h-56 overflow-y-auto space-y-1">
            {filtered.map((u) => (
              <button
                key={u.id}
                onClick={() => setTarget(u.id)}
                className={`w-full flex items-center gap-2.5 p-2 rounded-xl border text-left transition-colors ${
                  target === u.id ? "border-transparent bg-slate-50" : "border-slate-100 hover:bg-slate-50"
                }`}
                style={target === u.id ? { boxShadow: `0 0 0 2px ${accent}` } : undefined}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-700 truncate">{u.name}</p>
                  <p className="text-[10px] text-slate-400">{u.type}</p>
                </div>
                {target === u.id && <Check size={14} style={{ color: accent }} />}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-[11px] text-slate-400 px-1 py-2">No units match that.</p>
            )}
          </div>

          <p className="text-[11px] text-slate-400 leading-snug">
            Their old membership is closed rather than deleted, so the record of
            where they came from survives the move.
          </p>

          {error && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-rose-50 border border-rose-100">
              <ShieldAlert size={13} className="text-rose-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-rose-700 leading-snug">{error}</p>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50">
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={saving || !target}
              className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5"
              style={{ background: accent }}
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              Move
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
