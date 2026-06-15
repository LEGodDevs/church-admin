"use client";
import { useEffect, useState } from "react";
import Header from "@/components/layout/Header";
import PageHeader from "@/components/ui/PageHeader";
import { FullPageLoader } from "@/components/ui/LoadingSpinner";
import { apiFetch } from "@/lib/api";
import { Unit } from "@/types/api";
import { useAuthStore } from "@/stores/auth-store";

const TYPE_COLORS: Record<string, string> = {
  ZONE: "#7C3AED",
  BRANCH: "#047857",
  BC: "#0369A1",
  MC: "#B45309",
  CELL: "#DC2626",
};

const TYPE_ICONS: Record<string, string> = {
  ZONE: "🌐",
  BRANCH: "🏛️",
  BC: "🏘️",
  MC: "🏠",
  CELL: "👤",
};

export default function UnitsPage() {
  const { user } = useAuthStore();
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("ALL");

  const allowedRoles = ["BISHOP", "ADMIN", "ZONE_LEADER"];
  const canView = user && allowedRoles.includes(user.role);

  useEffect(() => {
    if (!canView) return;
    apiFetch<Unit[]>("/organizational-units")
      .then(setUnits)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [canView]);

  if (!canView) {
    return (
      <div className="flex flex-col flex-1">
        <Header title="Units" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-4xl mb-3">🔒</p>
            <p className="text-slate-600 font-medium">Access Restricted</p>
            <p className="text-slate-400 text-sm mt-1">This page is available to Zone Leaders and above</p>
          </div>
        </div>
      </div>
    );
  }

  const types = Array.from(new Set(units.map((u) => u.type)));
  const filtered = units.filter((u) => typeFilter === "ALL" || u.type === typeFilter);

  const countByType = types.reduce<Record<string, number>>((acc, t) => {
    acc[t] = units.filter((u) => u.type === t).length;
    return acc;
  }, {});

  return (
    <div className="flex flex-col flex-1">
      <Header title="Units" subtitle="Church organizational structure" />
      <div className="flex-1 p-6 overflow-y-auto">
        <PageHeader title="Church Units" subtitle={`${units.length} units total`} />

        {/* Type summary cards */}
        {!loading && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
            {(["ZONE", "BRANCH", "BC", "MC", "CELL"] as const).map((type) => (
              <div key={type} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 text-center">
                <p className="text-2xl mb-1">{TYPE_ICONS[type]}</p>
                <p className="text-xl font-bold text-slate-800">{countByType[type] ?? 0}</p>
                <p className="text-xs text-slate-400">{type === "BC" ? "Bus. Centers" : type === "MC" ? "Mini-Centers" : type + "s"}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filter */}
        <div className="flex gap-2 flex-wrap mb-5">
          {["ALL", ...types].map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                typeFilter === t ? "text-white" : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
              }`}
              style={typeFilter === t ? { background: TYPE_COLORS[t] ?? "#121D55" } : {}}
            >
              {t === "ALL" ? "All" : t}
            </button>
          ))}
        </div>

        {loading ? <FullPageLoader /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((unit) => (
              <div key={unit.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                    style={{ background: `${TYPE_COLORS[unit.type] ?? "#121D55"}15` }}
                  >
                    {TYPE_ICONS[unit.type] ?? "🏢"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{unit.name}</p>
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{ background: `${TYPE_COLORS[unit.type] ?? "#121D55"}15`, color: TYPE_COLORS[unit.type] ?? "#121D55" }}
                    >
                      {unit.type}
                    </span>
                  </div>
                </div>
                {unit.memberCount !== undefined && (
                  <p className="text-xs text-slate-400">👥 {unit.memberCount} member{unit.memberCount !== 1 ? "s" : ""}</p>
                )}
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full py-16 text-center text-slate-300 text-sm">No units found</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
