import { ChevronDown, Loader2, LogOut } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { cx, ui } from "@/lib/uiClasses";
import { useAuthStore } from "@/store/authStore";
import type { AuthUser } from "@/services/authApi";
import { useDismiss } from "../LibraryMenu/useDismiss";
import { UserAvatar } from "./UserAvatar";

export function UserMenu({ user }: { user: AuthUser }) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, containerRef, close);

  const handleSignOut = async () => {
    setSigningOut(true);
    await useAuthStore.getState().logout();
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account: ${user.name}`}
        onClick={() => setOpen((value) => !value)}
        className={cx(
          // Same base as the Library button so radius/border/height match.
          ui.button,
          "min-h-11 gap-2 !py-1 !pl-1 !pr-2.5 text-[0.86rem]",
          open && "!border-accent"
        )}
      >
        <UserAvatar name={user.name} picture={user.picture} size={30} />
        <span className="hidden max-w-[15ch] truncate text-[0.86rem] font-[600] text-ink sm:inline">
          {user.name}
        </span>
        <ChevronDown
          size={15}
          aria-hidden
          className={cx(
            "text-muted transition-transform duration-200 ease-out",
            open && "rotate-180"
          )}
        />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Account menu"
          className={cx(
            "absolute right-0 z-50 mt-2.5 w-[min(280px,calc(100vw-32px))] origin-top-right overflow-hidden",
            ui.surface,
            "p-0 shadow-[0_18px_50px_oklch(0.18_0.03_244/0.22)] animate-modal-pop"
          )}
        >
          {/* Identity band — a soft, warm-tinted header anchors the menu. */}
          <div className="flex items-center gap-3 bg-panel px-4 pb-3.5 pt-4">
            <span className="relative flex-none">
              <UserAvatar
                name={user.name}
                picture={user.picture}
                size={42}
                className="ring-2 ring-paper-strong"
              />
              {/* Signed-in status. */}
              <span
                aria-hidden
                className="absolute -bottom-px -right-px h-3 w-3 rounded-full bg-accent ring-[2.5px] ring-paper-strong"
              />
            </span>
            <div className="min-w-0">
              <p
                className="m-0 truncate text-[0.95rem] font-[680] leading-snug text-ink"
                title={user.name}
              >
                {user.name}
              </p>
              <p
                className="m-0 mt-0.5 truncate text-[0.78rem] leading-snug text-muted"
                title={user.email}
              >
                {user.email}
              </p>
            </div>
          </div>

          <div className="p-1.5">
            <button
              type="button"
              role="menuitem"
              disabled={signingOut}
              onClick={handleSignOut}
              className={cx(
                "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[0.88rem] font-[600] text-danger",
                "transition-colors duration-150 hover:bg-[oklch(0.95_0.04_28)]",
                "focus-visible:bg-[oklch(0.95_0.04_28)] focus-visible:outline-none",
                "disabled:cursor-not-allowed disabled:opacity-60"
              )}
            >
              <span className="grid h-[30px] w-[30px] flex-none place-items-center rounded-md bg-[oklch(0.93_0.05_28)] text-danger">
                {signingOut ? (
                  <Loader2 size={15} aria-hidden className={ui.spin} />
                ) : (
                  <LogOut size={15} aria-hidden />
                )}
              </span>
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
