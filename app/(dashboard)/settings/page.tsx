"use client";
import { useState } from "react";
import Header from "@/components/layout/Header";
import PageHeader from "@/components/ui/PageHeader";
import { useAuthStore } from "@/stores/auth-store";
import { ROLE_LABELS } from "@/types/auth";
import { getInitials } from "@/lib/utils";

export default function SettingsPage() {
  const { user } = useAuthStore();
  const [saved, setSaved] = useState(false);

  const allowedRoles = ["BISHOP", "ADMIN"];
  const canEdit = user && allowedRoles.includes(user.role);

  const showSaved = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  return (
    <div className="flex flex-col flex-1">
      <Header title="Settings" subtitle="Account and portal configuration" />
      <div className="flex-1 p-6 overflow-y-auto">
        <PageHeader title="Settings" />

        {/* Profile section */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-5">
          <p className="font-semibold text-slate-700 mb-5">My Profile</p>
          <div className="flex items-center gap-5 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center text-xl font-bold text-blue-700">
              {user ? getInitials(user.firstName, user.lastName) : "?"}
            </div>
            <div>
              <p className="text-lg font-bold text-slate-800">{user?.firstName} {user?.lastName}</p>
              <p className="text-sm text-slate-400">{user?.email}</p>
              <span className="inline-block mt-1 px-3 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                {user ? ROLE_LABELS[user.role] : ""}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">First Name</label>
              <input defaultValue={user?.firstName ?? ""} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Last Name</label>
              <input defaultValue={user?.lastName ?? ""} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 outline-none focus:border-blue-400" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Email</label>
              <input defaultValue={user?.email ?? ""} type="email" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 outline-none focus:border-blue-400" />
            </div>
          </div>
          <button
            onClick={showSaved}
            className="mt-4 px-5 py-2.5 rounded-xl text-white text-sm font-semibold"
            style={{ background: "#121D55" }}
          >
            {saved ? "✓ Saved" : "Save Changes"}
          </button>
        </div>

        {/* Church config — bishop/admin only */}
        {canEdit && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-5">
            <p className="font-semibold text-slate-700 mb-5">Church Configuration</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Church Name</label>
                <input defaultValue="Living Christ Chapel" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Default Currency</label>
                <select className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 outline-none">
                  <option value="GHS">GHS (Ghana Cedis)</option>
                  <option value="USD">USD (US Dollar)</option>
                  <option value="GBP">GBP (British Pound)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Weekly Service Day</label>
                <select className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 outline-none">
                  {["Sunday", "Saturday", "Friday"].map((d) => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Fiscal Year Start</label>
                <select className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 outline-none">
                  {["January", "April", "July", "October"].map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <button
              onClick={showSaved}
              className="mt-4 px-5 py-2.5 rounded-xl text-white text-sm font-semibold"
              style={{ background: "#121D55" }}
            >
              {saved ? "✓ Saved" : "Save Configuration"}
            </button>
          </div>
        )}

        {/* Danger zone */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-red-100">
          <p className="font-semibold text-red-500 mb-4">Danger Zone</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">Sign Out</p>
              <p className="text-xs text-slate-400">You will be redirected to the login page</p>
            </div>
            <button
              onClick={() => { useAuthStore.getState().logout(); window.location.href = "/login"; }}
              className="px-4 py-2 rounded-xl border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
