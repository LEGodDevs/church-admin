"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { LoginResponse } from "@/types/auth";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Email:email, Password: password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || "Invalid credentials");
      }
      const data = (await res.json()) as LoginResponse;

      const allowedRoles = ["BISHOP", "ADMIN", "ZONE_LEADER", "BRANCH_HEAD"];
      if (!allowedRoles.includes(data.user.role)) {
        throw new Error("This portal is for Branch Pastors and above. Please use the mobile app.");
      }

      // Set cookie for middleware
      document.cookie = `auth_token=${data.token}; path=/; max-age=86400`;
      setAuth(data);
      router.replace("/overview");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: "var(--background)" }}>
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-96 p-10" style={{ background: "var(--primary)" }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl">✝️</div>
          <span className="text-white font-bold text-lg">LC Church</span>
        </div>
        <div>
          <h2 className="text-white text-3xl font-bold leading-tight mb-4">
            Leadership<br />Admin Portal
          </h2>
          <p className="text-white/60 text-sm leading-relaxed">
            Manage your congregation, track attendance, monitor growth, and oversee your unit — all from one place.
          </p>
        </div>
        <p className="text-white/30 text-xs">Branch Pastor · Zone Leader · Bishop</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-lg" style={{ background: "var(--primary)" }}>✝️</div>
            <span className="font-bold text-slate-800">LC Church Admin</span>
          </div>

          <h1 className="text-2xl font-bold text-slate-800 mb-1">Welcome back</h1>
          <p className="text-slate-400 text-sm mb-8">Sign in to your leadership account</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
                placeholder="pastor@church.org"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-white text-sm font-semibold transition-opacity disabled:opacity-60"
              style={{ background: "var(--primary)" }}
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <p className="text-center text-xs text-slate-400 mt-8">
            For members, please use the LC Church mobile app.
          </p>
        </div>
      </div>
    </div>
  );
}
