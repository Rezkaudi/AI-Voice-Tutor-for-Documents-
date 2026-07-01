import { cx } from "@/lib/uiClasses";

export function ThinkingDots({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-end gap-[3px]", className)} aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-[5px] w-[5px] rounded-full bg-current animate-dot-bounce motion-reduce:animate-none"
          style={{ animationDelay: `${i * 0.16}s` }}
        />
      ))}
    </span>
  );
}
