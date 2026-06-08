import { cx } from "@/lib/uiClasses";

interface UserAvatarProps {
  name: string;
  picture: string | null;
  size?: number;
  className?: string;
}

export function UserAvatar({ name, picture, size = 28, className }: UserAvatarProps) {
  const dimension = { width: size, height: size } as const;
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  return picture ? (
    <img
      src={picture}
      alt=""
      style={dimension}
      referrerPolicy="no-referrer"
      className={cx("flex-none rounded-full object-cover", className)}
    />
  ) : (
    <span
      aria-hidden
      style={{ ...dimension, fontSize: Math.round(size * 0.42) }}
      className={cx(
        "grid flex-none place-items-center rounded-full bg-teacher font-bold text-paper-strong",
        className
      )}
    >
      {initial}
    </span>
  );
}
