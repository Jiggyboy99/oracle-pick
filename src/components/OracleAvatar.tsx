import { Sparkles } from "lucide-react";
import type { OracleMood } from "@/lib/oracle";
import { oracleAvatarColor } from "@/lib/oracle";

export function OracleAvatar({ mood, size = 40 }: { mood: OracleMood; size?: number }) {
  const eyes = {
    smug: "◠ ◠",
    confident: "● ●",
    nervous: "◔ ◔",
    humbled: "× ×",
  }[mood];
  return (
    <div
      className={`relative rounded-full bg-gradient-to-br ${oracleAvatarColor(mood)} flex items-center justify-center font-bold shadow-lg shadow-oracle/40`}
      style={{ width: size, height: size }}
    >
      <span className="text-white" style={{ fontSize: size * 0.32 }}>{eyes}</span>
      <Sparkles
        className="absolute -top-1 -right-1 text-acid fill-acid"
        size={Math.max(12, size * 0.32)}
      />
    </div>
  );
}
