import { useEffect, useState } from "react";

const AUTH_QUERY_KEY = "auth";
const AUTH_ERROR_VALUE = "error";

function readAuthErrorFromUrl() {
  if (typeof window === "undefined") return false;

  return new URLSearchParams(window.location.search).get(AUTH_QUERY_KEY) === AUTH_ERROR_VALUE;
}

export function useAuthErrorUrlCleanup() {
  const [hasAuthError] = useState(readAuthErrorFromUrl);

  useEffect(() => {
    if (!hasAuthError || typeof window === "undefined") return;

    const url = new URL(window.location.href);
    url.searchParams.delete(AUTH_QUERY_KEY);
    window.history.replaceState({}, "", url.toString());
  }, [hasAuthError]);

  return hasAuthError;
}
