"use client";
import { useEffect, useState } from "react";
import Header from "@/components/layout/Header";
import PageHeader from "@/components/ui/PageHeader";
import { FullPageLoader } from "@/components/ui/LoadingSpinner";
import { apiFetch } from "@/lib/api";
import { Member } from "@/types/api";
import { ROLE_LABELS } from "@/types/auth";
import { formatDate, getInitials } from "@/lib/utils";

const PAGE_SIZE = 20;

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState("ALL");

  useEffect(() => {
    apiFetch<Member[]>("/users")
      .then(setMembers)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = members.filter((m) => {
    const name = `${m.firstName} ${m.lastName}`.toLowerCase();
    const matchSearch = !search || name.includes(search.toLowerCase()) || m.email?.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "ALL" || m.role === roleFilter;
    return matchSearch && matchRole;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const roles = Array.from(new Set(members.map((m) => m.role)));

  return (
    <div className="flex flex-col flex-1">
      <Header title="Members" subtitle="All church members in your scope" />
      <div className="flex-1 p-6 overflow-y-auto">
        <PageHeader title="Members" subtitle={`${filtered.length} member${filtered.length !== 1 ? "s" : ""}`} />

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-5">
          <input
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="flex-1 min-w-48 px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 outline-none focus:border-blue-400"
          />
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 outline-none"
          >
            <option value="ALL">All Roles</option>
            {roles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r as keyof typeof ROLE_LABELS] ?? r}</option>)}
          </select>
        </div>

        {loading ? <FullPageLoader /> : (
          <>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide px-5 py-3.5">Member</th>
                    <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide px-5 py-3.5 hidden md:table-cell">Role</th>
                    <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide px-5 py-3.5 hidden lg:table-cell">Unit</th>
                    <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide px-5 py-3.5 hidden xl:table-cell">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((m) => (
                    <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 flex-shrink-0">
                            {getInitials(m.firstName, m.lastName)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-700">{m.firstName} {m.lastName}</p>
                            {m.email && <p className="text-xs text-slate-400">{m.email}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 hidden md:table-cell">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                          {ROLE_LABELS[m.role as keyof typeof ROLE_LABELS] ?? m.role}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 hidden lg:table-cell text-sm text-slate-500">{m.unitName ?? "—"}</td>
                      <td className="px-5 py-3.5 hidden xl:table-cell text-sm text-slate-400">{formatDate(m.createdAt)}</td>
                    </tr>
                  ))}
                  {paged.length === 0 && (
                    <tr><td colSpan={4} className="px-5 py-12 text-center text-slate-300 text-sm">No members found</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-slate-400">
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setPage((p) => p - 1)} disabled={page === 1}
                    className="px-3 py-1.5 rounded-lg text-sm border border-slate-200 disabled:opacity-40 hover:bg-slate-50">
                    Prev
                  </button>
                  <button onClick={() => setPage((p) => p + 1)} disabled={page === totalPages}
                    className="px-3 py-1.5 rounded-lg text-sm border border-slate-200 disabled:opacity-40 hover:bg-slate-50">
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
