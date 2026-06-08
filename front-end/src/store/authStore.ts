import { create } from "zustand";
import { setSessionExpiredHandler } from "@/services/apiBase";
import {
  type AuthUser,
  getCurrentUser,
  googleLoginUrl,
  logout as logoutRequest
} from "@/services/authApi";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthStore {
  user: AuthUser | null;
  status: AuthStatus;
  init: () => Promise<void>;
  login: () => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => {
  setSessionExpiredHandler(() => set({ user: null, status: "unauthenticated" }));

  return {
    user: null,
    status: "loading",

    init: async () => {
      const user = await getCurrentUser();
      set(
        user
          ? { user, status: "authenticated" }
          : { user: null, status: "unauthenticated" }
      );
    },

    login: () => {
      window.location.href = googleLoginUrl();
    },

    logout: async () => {
      try {
        await logoutRequest();
      } finally {
        set({ user: null, status: "unauthenticated" });
      }
    }
  };
});
