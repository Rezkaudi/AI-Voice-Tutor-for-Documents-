import { useEffect, useState } from "react";
import { BookOpen, GraduationCap, Mic, ShieldCheck, Sprout } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { cx, ui } from "@/lib/uiClasses";

/** Place the supplied teacher artwork at front-end/public/teacher-avatar.png */
const AVATAR_SRC = "/teacher-avatar.png";

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

const benefits = [
  { icon: GraduationCap, label: "Learn" },
  { icon: Mic, label: "Practice" },
  { icon: Sprout, label: "Grow" }
] as const;

export function LoginView() {
  const login = useAuthStore((s) => s.login);
  const [avatarFailed, setAvatarFailed] = useState(false);

  const failed = new URLSearchParams(window.location.search).get("auth") === "error";
  useEffect(() => {
    if (failed) {
      const url = new URL(window.location.href);
      url.searchParams.delete("auth");
      window.history.replaceState({}, "", url.toString());
    }
  }, [failed]);

  return (
    <main className="relative grid h-dvh w-full place-items-center overflow-hidden bg-paper text-ink">
      <BackdropDecor />

      {/* Brand lockup — no nav, on-brand minimal */}
      <header className="absolute left-0 top-0 z-20 flex items-center p-5 sm:p-7">
        <span className="text-[0.95rem] font-[760] tracking-tight">AI Voice Tutor</span>
      </header>

      <section className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-8 px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
        {/* Copy + the single CTA */}
        <div className="order-2 mx-auto max-w-xl text-center lg:order-1 lg:mx-0 lg:text-left">
          <h1 className="text-[clamp(2rem,5vw,3.5rem)] font-[820] leading-[1.03] tracking-[-0.022em]">
            Your documents,
            <br className="hidden sm:block" />{" "}
            <span className="text-accent">taught out loud.</span>
          </h1>

          <p className="mx-auto mt-4 max-w-[46ch] text-[1.02rem] leading-[1.55] text-muted lg:mx-0">
            A human-like AI teacher that teaches you any concept from a text-based PDF document
          </p>

          <ul className="mt-6 flex flex-wrap justify-center gap-2 lg:justify-start">
            {benefits.map(({ icon: Icon, label }) => (
              <li key={label} className={ui.pill}>
                <Icon size={15} className="text-accent" aria-hidden />
                {label}
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-col items-center gap-3 lg:items-start">
            <button
              type="button"
              onClick={login}
              className={cx(
                ui.button,
                "w-full justify-center gap-3 !rounded-xl !px-6 !py-3.5 text-[1rem] font-[720] shadow-app sm:w-auto"
              )}
            >
              <GoogleMark />
              Continue with Google
            </button>

            {failed ? (
              <p className={ui.errorText}>Sign-in didn’t complete. Please try again.</p>
            ) : (
              <div className="grid justify-items-center gap-1.5 lg:justify-items-start">
                <p className="text-[0.82rem] text-muted">
                  Free to start · No credit card needed
                </p>
                <p className="inline-flex items-center gap-1.5 text-[0.82rem] font-[560] text-muted">
                  <ShieldCheck size={14} className="flex-none text-accent" aria-hidden />
                  Your data is private and secure — we never train on your documents.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Teacher avatar on a soft branded stage */}
        <div className="order-1 flex items-end justify-center lg:order-2">
          <AvatarStage failed={avatarFailed} onFail={() => setAvatarFailed(true)} />
        </div>
      </section>

      <footer className="absolute inset-x-0 bottom-0 z-20 hidden justify-center p-4 text-[0.75rem] text-muted sm:flex">
        © 2026 AI Voice Tutor for Documents · Learn smarter, by voice.
      </footer>
    </main>
  );
}

function AvatarStage({ failed, onFail }: { failed: boolean; onFail: () => void }) {
  return (
    <div className="relative grid place-items-center">
      {/* Halo echoing the in-app teacher avatar */}
      <div
        aria-hidden
        className="pointer-events-none absolute h-[min(72vw,440px)] w-[min(72vw,440px)] rounded-full bg-[radial-gradient(circle_at_50%_42%,oklch(0.86_0.035_210/0.6)_0%,oklch(0.58_0.11_154/0.16)_46%,transparent_70%)] motion-safe:animate-halo-breath"
      />

      {failed ? (
        <div className="relative z-1 grid h-[min(58vh,360px)] w-[min(72vw,360px)] place-items-center rounded-[28px] border border-dashed border-line bg-paper-strong/70 px-6 text-center">
          <span className="grid gap-2 text-muted">
            <BookOpen size={36} className="mx-auto text-teacher" aria-hidden />
            <span className="text-[0.85rem] leading-snug">
              Add <code className="text-ink">public/teacher-avatar.png</code> to show
              your tutor here.
            </span>
          </span>
        </div>
      ) : (
        <img
          src={AVATAR_SRC}
          onError={onFail}
          alt="Friendly AI teacher holding a notebook of lessons, ready to begin"
          className="relative z-1 max-h-[62vh] w-[min(78vw,440px)] select-none object-contain drop-shadow-[0_24px_45px_oklch(0.22_0.02_245/0.18)]"
          draggable={false}
        />
      )}
    </div>
  );
}

function BackdropDecor() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
      <div className="absolute -right-32 -top-40 h-[480px] w-[480px] rounded-full bg-[radial-gradient(circle,oklch(0.86_0.035_210/0.5),transparent_70%)] blur-2xl" />
      <div className="absolute -bottom-44 -left-32 h-[460px] w-[460px] rounded-full bg-[radial-gradient(circle,oklch(0.78_0.09_154/0.3),transparent_70%)] blur-2xl" />
    </div>
  );
}
