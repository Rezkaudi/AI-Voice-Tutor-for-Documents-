import axios, { AxiosError } from "axios";

const RAW_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").trim();
const BASE = RAW_BASE.replace(/\/+$/, "");

/** Base URL of the API server, e.g. "http://localhost:3000" — empty in production same-origin. */
export const API_BASE = BASE;

/** Resolves an API path returned by the backend (e.g. `/api/documents/abc/file`) to an absolute URL. */
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

export function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as { error?: string } | undefined;
    if (data?.error) return data.error;
    if (error.message) return error.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
