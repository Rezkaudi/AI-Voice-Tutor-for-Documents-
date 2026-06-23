export function VoiceWave() {
  return (
    <span className="flex h-4 items-center gap-[3px]" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="min-h-[5px] w-[3px] animate-wave-bar rounded-full bg-current motion-reduce:animate-none"
          style={{ animationDelay: `${i * 110}ms` }}
        />
      ))}
    </span>
  );
}

export function ThinkingDots() {
  return (
    <span className="flex h-4 items-center gap-[3px]" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-[4px] w-[4px] animate-dot-bounce rounded-full bg-current motion-reduce:animate-none"
          style={{ animationDelay: `${i * 160}ms` }}
        />
      ))}
    </span>
  );
}
