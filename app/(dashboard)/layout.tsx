"use client";
import Sidebar from "@/components/layout/Sidebar";
import AuthGuard from "@/components/layout/AuthGuard";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex h-full min-h-screen" style={{ background: "var(--background)" }}>
        <Sidebar />
        <div className="flex-1 flex flex-col" style={{ marginLeft: "var(--sidebar-width)" }}>
          {children}
        </div>
      </div>
    </AuthGuard>
  );
}
