import { Flame } from "lucide-react";

export function StreakFlame({ streak, size = 14 }: { streak: number; size?: number }) {
  if (streak <= 0) return null;
  const intensity = Math.min(1, streak / 10);
  return (
    <span
      className="inline-flex items-center gap-0.5 chip anim-flame"
      style={{
        color: "var(--flame)",
        background: `color-mix(in oklab, var(--flame) ${10 + intensity * 30}%, transparent)`,
        filter: `drop-shadow(0 0 ${4 + intensity * 8}px var(--flame))`,
      }}
    >
      <Flame size={size} fill="currentColor" />
      <span className="tabular-nums font-bold">{streak}</span>
    </span>
  );
}
