import { motion } from "framer-motion";

export type ConsensusOption = { value: string; label: string; pct: number };

export function ConsensusBar({
  options,
  oraclePick,
  userPick,
}: {
  options: ConsensusOption[];
  oraclePick?: string;
  userPick?: string;
}) {
  const palette = ["#39E75F", "#7B61FF", "#FF9F40", "#FF5C8A", "#39B8FF"];
  return (
    <div className="space-y-2">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-secondary">
        {options.map((o, i) => (
          <motion.div
            key={o.value}
            initial={{ width: 0 }}
            animate={{ width: `${o.pct}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 18 }}
            style={{ background: palette[i % palette.length] }}
            className="relative"
          >
            {oraclePick === o.value && (
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 h-5 w-[3px] bg-oracle rounded-full shadow shadow-oracle/60" />
            )}
            {userPick === o.value && (
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-5 w-[3px] bg-acid rounded-full" />
            )}
          </motion.div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {options.map((o, i) => (
          <span key={o.value} className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: palette[i % palette.length] }} />
            <span className={userPick === o.value ? "text-acid font-semibold" : ""}>{o.label}</span>
            <span className="tabular-nums">{Math.round(o.pct)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}
