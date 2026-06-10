"use client";
import { useAuthStore } from "@/stores/auth-store";
import { ROLE_LABELS, ROLE_COLORS } from "@/types/auth";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export default function Header({ title, subtitle }: HeaderProps) {
  const { user } = useAuthStore();
  const roleColor = user ? (ROLE_COLORS[user.role] ?? "#374151") : "#374151";

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
      <div>
        <h1 className="text-xl font-bold text-slate-800">{title}</h1>
        {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {user && (
        <div className="flex items-center gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-700 text-right">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-xs text-right" style={{ color: roleColor }}>
              {ROLE_LABELS[user.role]}
              {user.unitName ? ` · ${user.unitName}` : ""}
            </p>
          </div>
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold"
            style={{ backgroundColor: roleColor }}
          >
            {user.firstName[0]}{user.lastName[0]}
          </div>
        </div>
      )}
    </header>
  );
}
