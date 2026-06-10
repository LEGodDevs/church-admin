"use client";
import { create } from "zustand";
import { AuthUser, LoginResponse } from "@/types/auth";

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  hydrated: boolean;
  setAuth: (data: LoginResponse) => void;
  logout: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  hydrated: false,

  hydrate: () => {
    const token = localStorage.getItem("auth_token");
    const userRaw = localStorage.getItem("auth_user");
    const user = userRaw ? (JSON.parse(userRaw) as AuthUser) : null;
    set({ token, user, hydrated: true });
  },

  setAuth: ({ token, user }) => {
    localStorage.setItem("auth_token", token);
    localStorage.setItem("auth_user", JSON.stringify(user));
    set({ token, user });
  },

  logout: () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    set({ token: null, user: null });
  },
}));
