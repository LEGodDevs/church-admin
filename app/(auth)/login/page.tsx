"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { LoginResponse, UserRole } from "@/types/auth";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
        body: JSON.stringify({ Email: email, Password: password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || "Invalid credentials");
      }
      const raw = await res.json();

      const ROLE_PRIORITY: UserRole[] = ["BISHOP", "ADMIN", "ZONE_LEADER", "BRANCH_HEAD", "BC_HEAD", "MC_HEAD", "CELL_LEADER", "SHEPHERD", "MEMBER"];
      const userRoles: UserRole[] = (raw.user.leaderships || []).map((l: { role: UserRole }) => l.role);
      const role = ROLE_PRIORITY.find(r => userRoles.includes(r)) ?? "MEMBER";

      const allowedRoles: UserRole[] = ["BISHOP", "ADMIN", "ZONE_LEADER", "BRANCH_HEAD"];
      if (!allowedRoles.includes(role)) {
        throw new Error("This portal is for Branch Pastors and above. Please use the mobile app.");
      }

      const data: LoginResponse = {
        token: raw.token,
        user: {
          id: raw.user.id,
          firstName: raw.user.firstName,
          lastName: raw.user.lastName,
          email: raw.user.email,
          role,
          unitId: raw.user.leaderships?.[0]?.unitId,
          profileImage: raw.user.profilePic ?? undefined,
        },
      };

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
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-200 text-slate-800 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
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
