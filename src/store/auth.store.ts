"use client";

import { create } from "zustand";
import { User } from "@/types/auth";
import { removeToken, setToken } from "@/lib/auth";

interface AuthState {
  user: User | null;
  token: string | null;

  setAuth: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,

  setAuth: (user, token) => {
    setToken(token);

    set({
      user,
      token,
    });
  },

  logout: () => {
    removeToken();

    set({
      user: null,
      token: null,
    });
  },
}));