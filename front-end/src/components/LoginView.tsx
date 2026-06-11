import { useEffect } from "react";
import { BookOpen } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { cx, ui } from "@/lib/uiClasses";

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.34A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.01-2.34Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

export function LoginView() {
  const login = useAuthStore((s) => s.login);

  const failed = new URLSearchParams(window.location.search).get("auth") === "error";
  useEffect(() => {
    if (failed) {
      const url = new URL(window.location.href);
      url.searchParams.delete("auth");
      window.history.replaceState({}, "", url.toString());
    }
  }, [failed]);

  return (
    <div className="grid min-h-dvh place-items-center bg-paper px-5">
      <div className={cx(ui.surface, "grid w-[min(420px,100%)] gap-5 p-8 text-center")}>
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-xl bg-teacher text-paper-strong">
          <BookOpen size={28} aria-hidden />
        </div>
        <div>
          <h1 className="m-0 text-[1.4rem] font-[760] leading-tight">
            AI Voice Tutor for Documents
          </h1>
          <p className="mx-auto mt-2 max-w-[34ch] text-[0.9rem] leading-relaxed text-muted">
            Sign in to upload your documents and start learning with your voice tutor.
          </p>
        </div>

        {failed && (
          <p className={ui.errorText}>Sign-in didn’t complete. Please try again.</p>
        )}

        <button
          type="button"
          onClick={login}
          className={cx(ui.button, "w-full justify-center !py-3 text-[0.95rem]")}
        >
          <GoogleMark />
          Continue with Google
        </button>
      </div>
    </div>
  );
}
