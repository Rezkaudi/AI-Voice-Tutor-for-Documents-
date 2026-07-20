import { GraduationCap, Mic, ShieldCheck, Sprout } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/store/authStore";
import { cx, ui } from "@/lib/uiClasses";
import { LanguageSwitcher } from "@/components/common/LanguageSwitcher";
import {
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
import { AvatarStage } from "./login/AvatarStage";
import { GoogleMark } from "./login/GoogleMark";
import { LoginBackdrop } from "./login/LoginBackdrop";
import { useAuthErrorUrlCleanup } from "./login/useAuthErrorUrlCleanup";

const benefits = [
  { icon: GraduationCap, key: "login.benefitLearn" },
  { icon: Mic, key: "login.benefitPractice" },
  { icon: Sprout, key: "login.benefitGrow" }
] as const;

export function LoginPage() {
  const login = useAuthStore((s) => s.login);
  const { t } = useTranslation();
  const failed = useAuthErrorUrlCleanup();

  return (
    <main className={main}>
      <LoginBackdrop />

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
          <AvatarStage />
        </div>
      </section>

      <footer className={footer}>
        {t("login.footer")}
      </footer>
    </main>
  );
}
