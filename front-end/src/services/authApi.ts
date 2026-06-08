import { api, extractErrorMessage, resolveApiUrl } from "@/services/apiBase";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  picture: string | null;
}

export function googleLoginUrl(): string {
  return resolveApiUrl("/api/auth/google") ?? "/api/auth/google";
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const { data } = await api.get<{ user: AuthUser }>("/api/auth/me");
    return data.user;
  } catch {
    return null;
  }
}

export async function refreshSession(): Promise<AuthUser> {
  const { data } = await api.post<{ user: AuthUser }>("/api/auth/refresh");
  return data.user;
}

export async function logout(): Promise<void> {
  try {
    await api.post("/api/auth/logout");
  } catch (error) {
    throw new Error(extractErrorMessage(error, "Sign-out failed."), { cause: error });
  }
}
