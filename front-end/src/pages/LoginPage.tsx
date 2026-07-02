import { useEffect, useState } from "react";
import { BookOpen, GraduationCap, Mic, ShieldCheck, Sprout } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/store/authStore";
import { cx, ui } from "@/lib/uiClasses";
import { LanguageSwitcher } from "@/components/common/LanguageSwitcher";
import {
  avatarHalo,
  avatarImg,
  avatarPlaceholder,
  backdropBlob1,
  backdropBlob2,
  benefitList,
  brand,
  ctaExtra,
  footer,
  header,
  headline,
  leftCol,
  main,
  section,
  subtitle
} from "@/styles/pages/loginPage";

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
  { icon: GraduationCap, key: "login.benefitLearn" },
  { icon: Mic, key: "login.benefitPractice" },
  { icon: Sprout, key: "login.benefitGrow" }
] as const;

export function LoginPage() {
  const login = useAuthStore((s) => s.login);
  const { t } = useTranslation();
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
    <main className={main}>
      <BackdropDecor />

      <header className={header}>
        <span className={brand}>{t("login.brand")}</span>
        <LanguageSwitcher />
      </header>

      <section className={section}>

        <div className={leftCol}>
          <h1 className={headline}>
            {t("login.headlineLead")}
            <br className="hidden sm:block" />{" "}
            <span className="text-accent">{t("login.headlineAccent")}</span>
          </h1>

          <p className={subtitle}>
            {t("login.subtitle")}
          </p>

          <ul className={benefitList}>
            {benefits.map(({ icon: Icon, key }) => (
              <li key={key} className={ui.pill}>
                <Icon size={15} className="text-accent" aria-hidden />
                {t(key)}
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-col items-center gap-3 lg:items-start">
            <button
              type="button"
              onClick={login}
              className={cx(ui.button, ctaExtra)}
            >
              <GoogleMark />
              {t("login.cta")}
            </button>

            {failed ? (
              <p className={ui.errorText}>{t("login.signinError")}</p>
            ) : (
              <div className="grid justify-items-center gap-1.5 lg:justify-items-start">
                <p className="text-[0.82rem] text-muted">{t("login.freeStart")}</p>
                <p className="inline-flex items-center gap-1.5 text-[0.82rem] font-[560] text-muted">
                  <ShieldCheck size={14} className="flex-none text-accent" aria-hidden />
                  {t("login.privacy")}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="order-1 flex items-end justify-center lg:order-2">
          <AvatarStage failed={avatarFailed} onFail={() => setAvatarFailed(true)} />
        </div>
      </section>

      <footer className={footer}>
        {t("login.footer")}
      </footer>
    </main>
  );
}

function AvatarStage({ failed, onFail }: { failed: boolean; onFail: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="relative grid place-items-center">

      <div aria-hidden className={avatarHalo} />

      {failed ? (
        <div className={avatarPlaceholder}>
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
          alt={t("login.avatarAlt")}
          className={avatarImg}
          draggable={false}
        />
      )}
    </div>
  );
}

function BackdropDecor() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
      <div className={backdropBlob1} />
      <div className={backdropBlob2} />
    </div>
  );
}
