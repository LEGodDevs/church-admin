"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { ROLE_LABELS } from "@/types/auth";
import { getInitials } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  roles?: string[];
}

const NAV: NavItem[] = [
  { href: "/overview", label: "Overview", icon: "📊" },
  { href: "/members", label: "Members", icon: "👥" },
  { href: "/attendance", label: "Attendance", icon: "✅" },
  { href: "/reports", label: "Reports", icon: "📋" },
  { href: "/finances", label: "Finances", icon: "💰" },
  { href: "/announcements", label: "Announcements", icon: "📢" },
  { href: "/units", label: "Units", icon: "🏛️", roles: ["BISHOP", "ADMIN", "ZONE_LEADER"] },
  { href: "/settings", label: "Settings", icon: "⚙️", roles: ["BISHOP", "ADMIN"] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  const visible = NAV.filter((n) => !n.roles || (user && n.roles.includes(user.role)));

  return (
    <aside
      className="fixed left-0 top-0 h-screen flex flex-col z-30"
      style={{ width: "var(--sidebar-width)", background: "var(--primary)", color: "#fff" }}
    >
      {/* Logo */}
      <div className="px-6 py-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-lg">✝️</div>
          <div>
            <p className="font-bold text-sm leading-tight">LC Church</p>
            <p className="text-white/60 text-xs">Admin Portal</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {visible.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 text-sm font-medium transition-colors ${
                active ? "bg-white/20 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className="text-base w-5 text-center">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      {user && (
        <div className="px-4 py-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
              {getInitials(user.firstName, user.lastName)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{user.firstName} {user.lastName}</p>
              <p className="text-white/60 text-xs">{ROLE_LABELS[user.role]}</p>
            </div>
          </div>
          <button
            onClick={() => { logout(); window.location.href = "/login"; }}
            className="w-full text-left px-3 py-2 rounded-xl text-white/70 hover:bg-white/10 hover:text-white text-sm transition-colors"
          >
            🚪 Sign Out
          </button>
        </div>
      )}
    </aside>
  );
}
