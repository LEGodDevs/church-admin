"use client";
import { Page } from "@/components/ui/Page";
import { Card, CardHeader } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, ROLE_TONE } from "@/components/ui/Badge";
import { useAuthStore } from "@/stores/auth-store";
import { ROLE_LABELS } from "@/types/auth";

export default function SettingsPage() {
  const { user } = useAuthStore();

  return (
    <Page title="Settings" subtitle="Your account and session">
      <div className="grid lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2">
          <CardHeader title="Profile" />
          <div className="flex items-center gap-4 mb-5">
            <Avatar name={`${user?.firstName ?? ""} ${user?.lastName ?? ""}`} src={user?.profileImage} size={64} />
            <div>
              <p className="text-lg font-semibold text-slate-800">{user?.firstName} {user?.lastName}</p>
              <p className="text-sm text-slate-400">{user?.email}</p>
              {user && <Badge tone={ROLE_TONE[user.role] ?? "slate"}>{ROLE_LABELS[user.role]}</Badge>}
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            {([
              ["Role", user ? ROLE_LABELS[user.role] : "—"],
              ["Unit", user?.unitName ?? "—"],
              ["Email", user?.email ?? "—"],
              ["Account ID", user?.id ?? "—"],
            ] as [string, string][]).map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-slate-400">{label}</dt>
                <dd className="text-slate-700 font-medium truncate">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-slate-400 mt-5">
            Profile details are managed from the mobile app. This console reflects your leadership account.
          </p>
        </Card>

        <Card>
          <CardHeader title="Session" />
          <p className="text-sm text-slate-500 mb-4">Sign out of the admin console on this device.</p>
          <button
            onClick={() => {
              useAuthStore.getState().logout();
              window.location.href = "/login";
            }}
            className="w-full px-4 py-2.5 rounded-xl border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 transition-colors"
          >
            🚪 Sign Out
          </button>
        </Card>
      </div>
    </Page>
  );
}
