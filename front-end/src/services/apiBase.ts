import axios, { AxiosError } from "axios";

const RAW_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").trim();
const BASE = RAW_BASE.replace(/\/+$/, "");

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
