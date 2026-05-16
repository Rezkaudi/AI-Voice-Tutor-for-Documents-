import { CheckCircle2, Loader2, LockKeyhole } from "lucide-react";
import type { FormEvent } from "react";
import type { AccessState } from "./types";

type AccessScreenProps = {
  state: Extract<AccessState, "checking" | "locked">;
  accessCode: string;
  error: string | null;
  onAccessCodeChange: (code: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

/** Loading spinner and access-code lock screen shown before the workspace. */
export function AccessScreen({
  state,
  accessCode,
  error,
  onAccessCodeChange,
  onSubmit
}: AccessScreenProps) {
  if (state === "checking") {
    return (
      <div className="access-wrap">
        <Loader2 className="spin" size={32} aria-hidden />
      </div>
    );
  }

  return (
    <div className="access-wrap">
      <form className="access-box surface" onSubmit={onSubmit}>
        <LockKeyhole size={36} aria-hidden />
        <h2>Access Code</h2>
        <p>Enter the demo code for this teaching workspace.</p>
        <div style={{ height: 16 }} />
        <label className="field-label" htmlFor="access-code">
          Access code
        </label>
        <input
          id="access-code"
          className="access-input"
          value={accessCode}
          onChange={(event) => onAccessCodeChange(event.target.value)}
          placeholder="Enter your code"
          type="password"
          autoComplete="one-time-code"
          autoFocus
        />
        <div style={{ height: 12 }} />
        <button className="button primary" type="submit">
          <CheckCircle2 size={18} aria-hidden />
          Enter
        </button>
        {error ? (
          <p className="error-text" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </div>
  );
}
