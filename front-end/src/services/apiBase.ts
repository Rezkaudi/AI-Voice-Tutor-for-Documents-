import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

const RAW_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").trim();
const BASE = RAW_BASE.replace(/\/+$/, "");

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

let onSessionExpired: (() => void) | null = null;
export function setSessionExpiredHandler(handler: () => void): void {
  onSessionExpired = handler;
}

/** Paywall reasons mirror the backend `PaymentRequiredError.reason`. */
export type PaywallReason = "no_plan" | "insufficient_credits" | "daily_limit";

let onPaywall: ((reason: PaywallReason) => void) | null = null;
export function setPaywallHandler(handler: (reason: PaywallReason) => void): void {
  onPaywall = handler;
}

/** Best-effort read of the `reason` off a 402 body (may be a Blob/stream). */
function readPaywallReason(data: unknown): PaywallReason {
  if (data && typeof data === "object" && "reason" in data) {
    const reason = (data as { reason?: string }).reason;
    if (
      reason === "no_plan" ||
      reason === "insufficient_credits" ||
      reason === "daily_limit"
    ) {
      return reason;
    }
  }
  return "insufficient_credits";
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

// On a 401, try one silent refresh and replay the original request.
api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    // Paywall: a billable AI/billing call was blocked. Raise the modal and let
    // the rejection propagate (callers swallow it; the user sees the modal).
    if (error instanceof AxiosError && error.response?.status === 402) {
      onPaywall?.(readPaywallReason(error.response.data));
      return Promise.reject(error);
    }

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

/** Thrown by transports on a 402 so callers can stay silent (the paywall shows). */
export class PaywallError extends Error {
  constructor() {
    super("payment_required");
    this.name = "PaywallError";
  }
}

/** True when an error is (or wraps) a 402 paywall response. */
export function isPaywallError(error: unknown): boolean {
  if (error instanceof PaywallError) return true;
  if (error instanceof AxiosError) return error.response?.status === 402;
  if (error instanceof Error && error.cause instanceof AxiosError) {
    return error.cause.response?.status === 402;
  }
  return false;
}

export function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as { error?: string } | undefined;
    if (data?.error) return data.error;
    if (error.message) return error.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
