import { motion, useReducedMotion } from "framer-motion";
import { ArrowUp, ArrowDown, Minus, Sparkles } from "lucide-react";
import { CountUp } from "@/components/motion/CountUp";
import { StreakFlame } from "@/components/StreakFlame";

export interface BoardRowData {
  id: string;
  name: string;
  country: string | null;
  delta: number;
  streak: number;
  points: number;
  isOracle?: boolean;
  isMe?: boolean;
}

const flag = (cc: string) => `https://flagcdn.com/w160/${cc}.png`;

export function BoardRow({
  id,
  rank,
  data,
  index,
}: {
  id: string;
  rank: number;
  data: BoardRowData;
  index: number;
}) {
  const reduce = useReducedMotion();
  const { name, country, delta, streak, points, isOracle, isMe } = data;

  return (
    <motion.li
      layoutId={`board-${id}`}
      layout
      initial={reduce ? false : { opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        layout: { type: "spring", stiffness: 300, damping: 30 },
        opacity: { duration: 0.2, delay: reduce ? 0 : 0.04 * index },
        x: { type: "spring", stiffness: 200, damping: 22, delay: reduce ? 0 : 0.04 * index },
      }}
      className={`grid grid-cols-[40px_1fr_70px_90px] md:grid-cols-[56px_1fr_90px_110px] items-center px-5 md:px-6 py-4 border-b border-white/5 last:border-b-0 ${
        isMe ? "bg-acid/[0.04]" : ""
      } ${isOracle ? "bg-oracle/[0.06]" : ""}`}
    >
      {/* Rank */}
      <span
        className="num text-xl md:text-2xl"
        style={
          isOracle
            ? { color: "#C4B5FD", textShadow: "0 0 12px rgba(123,97,255,0.7)" }
            : isMe
            ? { color: "#39E75F", textShadow: "0 0 12px rgba(57,231,95,0.7)" }
            : { color: "rgba(255,255,255,0.7)" }
        }
      >
        {String(rank).padStart(2, "0")}
      </span>

      {/* Identity */}
      <div className="flex items-center gap-3 min-w-0">
        {isOracle ? (
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: "#7B61FF",
              boxShadow: "0 0 16px 2px rgba(123,97,255,0.45)",
            }}
          >
            <Sparkles size={18} className="text-white" strokeWidth={2.5} />
          </div>
        ) : country ? (
          <img
            src={flag(country)}
            alt=""
            className="w-10 h-7 object-cover rounded-md shrink-0 border border-white/10"
          />
        ) : (
          <div className="w-10 h-7 rounded-md bg-white/10 shrink-0" />
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-[15px] truncate">{name}</span>
            {isOracle && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider text-oracle border border-oracle/60">
                AI
              </span>
            )}
            {isMe && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-acid text-black">
                You
              </span>
            )}
            {streak >= 2 && <StreakFlame streak={streak} size={12} />}
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="flex justify-end">
        <DeltaBadge delta={delta} />
      </div>

      {/* Points */}
      <div
        className="num text-2xl md:text-3xl text-right"
        style={
          isOracle
            ? { color: "#C4B5FD", textShadow: "0 0 8px rgba(123,97,255,0.4)" }
            : isMe
            ? { color: "#39E75F", textShadow: "0 0 8px rgba(57,231,95,0.35)" }
            : { color: "#fff" }
        }
      >
        <CountUp value={points} />
      </div>
    </motion.li>
  );
}

function DeltaBadge({ delta }: { delta: number }) {
  if (delta === 0)
    return (
      <span className="inline-flex items-center gap-1 text-white/40 text-xs">
        <Minus size={12} /> —
      </span>
    );
  const up = delta > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-bold tabular-nums ${
        up ? "text-acid" : "text-[color:var(--destructive)]"
      }`}
    >
      {up ? <ArrowUp size={12} strokeWidth={3} /> : <ArrowDown size={12} strokeWidth={3} />}
      {Math.abs(delta)}
    </span>
  );
}
