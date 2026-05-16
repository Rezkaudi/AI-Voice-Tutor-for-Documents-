import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { AccessState } from "@/components/teaching/types";

type UseAccessParams = {
  onError: (message: string | null) => void;
};

export type Access = {
  accessState: AccessState;
  accessCode: string;
  setAccessCode: (code: string) => void;
  submitAccess: (event: FormEvent<HTMLFormElement>) => Promise<void>;
};

/**
 * Resolves whether the current visitor may use the workspace and exposes the
 * access-code submission flow for the lock screen.
 */
export function useAccess({ onError }: UseAccessParams): Access {
  const [accessState, setAccessState] = useState<AccessState>("checking");
  const [accessCode, setAccessCode] = useState("");

  useEffect(() => {
    fetch("/api/access")
      .then((response) => response.json())
      .then((data) => setAccessState(data.granted ? "granted" : "locked"))
      // A failed probe should not lock a user out of a local/dev session.
      .catch(() => setAccessState("granted"));
  }, []);

  const submitAccess = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      onError(null);

      const response = await fetch("/api/access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: accessCode })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        onError(data.error || "Access failed.");
        return;
      }

      setAccessState("granted");
    },
    [accessCode, onError]
  );

  return { accessState, accessCode, setAccessCode, submitAccess };
}
