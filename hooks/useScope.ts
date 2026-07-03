"use client";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Resolves the data scope for the logged-in admin.
 * - Bishop/Admin operate church-wide (admin dashboard, all units).
 * - Zone/Branch leaders are scoped to their own unit subtree.
 */
export function useScope() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "BISHOP" || user?.role === "ADMIN";
  return {
    user,
    role: user?.role,
    unitId: user?.unitId,
    unitName: user?.unitName,
    isAdmin,
  };
}
