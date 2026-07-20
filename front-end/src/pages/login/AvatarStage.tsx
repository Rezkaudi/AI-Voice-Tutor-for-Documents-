import { useState } from "react";
import { BookOpen } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  avatarHalo,
  avatarImg,
  avatarPlaceholder,
} from "@/styles/pages/loginPage";

const AVATAR_SRC = "/teacher-avatar.png";

export function AvatarStage() {
  const { t } = useTranslation();
  const [avatarFailed, setAvatarFailed] = useState(false);

  return (
    <div className="relative grid place-items-center">
      <div aria-hidden className={avatarHalo} />

      {avatarFailed ? (
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
          onError={() => setAvatarFailed(true)}
          alt={t("login.avatarAlt")}
          className={avatarImg}
          draggable={false}
        />
      )}
    </div>
  );
}
