import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

const RAW_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").trim();
const BASE = RAW_BASE.replace(/\/+$/, "");

export function resolveApiUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  if (!BASE) return path;
  return `${BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

export const api = axios.create({
  baseURL: BASE || "/",
  withCredentials: true
});

let onSessionExpired: (() => void) | null = null;
export function setSessionExpiredHandler(handler: () => void): void {
  onSessionExpired = handler;
}

let refreshPromise: Promise<void> | null = null;

function refreshOnce(): Promise<void> {
  if (!refreshPromise) {
    refreshPromise = api
      .post("/api/auth/refresh")
      .then(() => undefined)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

const NO_REFRESH_ON_401 = ["/api/auth/refresh", "/api/auth/logout"];

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!(error instanceof AxiosError) || error.response?.status !== 401) {
      return Promise.reject(error);
    }

    const original = error.config as RetriableConfig | undefined;
    const url = original?.url ?? "";
    if (
      !original ||
      original._retried ||
      NO_REFRESH_ON_401.some((path) => url.includes(path))
    ) {
      return Promise.reject(error);
    }

    try {
      await refreshOnce();
    } catch {
      onSessionExpired?.();
      return Promise.reject(error);
    }

    original._retried = true;
    return api(original);
  }
);

export function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as { error?: string } | undefined;
    if (data?.error) return data.error;
    if (error.message) return error.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
