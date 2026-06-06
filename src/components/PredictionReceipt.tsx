import { forwardRef } from "react";
import { Sparkles } from "lucide-react";

export type ReceiptPick = { market: string; pick: string; faded?: boolean };

export const PredictionReceipt = forwardRef<
  HTMLDivElement,
  {
    displayName: string;
    home: string;
    away: string;
    homeCode: string;
    awayCode: string;
    picks: ReceiptPick[];
    potential: number;
  }
>(function PredictionReceipt({ displayName, home, away, homeCode, awayCode, picks, potential }, ref) {
  return (
    <div
      ref={ref}
      className="relative w-full max-w-md mx-auto p-6 rounded-3xl overflow-hidden"
      style={{
        background:
          "radial-gradient(circle at 0% 0%, #7B61FF33, transparent 50%), radial-gradient(circle at 100% 100%, #39E75F22, transparent 50%), #0A0A0F",
        color: "white",
        border: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      <div className="flex items-center justify-between text-xs uppercase tracking-widest text-white/60 mb-4">
        <span>Locked In</span>
        <span className="flex items-center gap-1">
          <Sparkles size={12} className="text-acid" /> Predictor
        </span>
      </div>

      <div className="flex items-center justify-between mb-5">
        <div className="text-center flex-1">
          <div className="text-3xl font-bold tracking-tight">{homeCode}</div>
          <div className="text-xs text-white/60">{home}</div>
        </div>
        <div className="text-white/40 text-xl font-bold">VS</div>
        <div className="text-center flex-1">
          <div className="text-3xl font-bold tracking-tight">{awayCode}</div>
          <div className="text-xs text-white/60">{away}</div>
        </div>
      </div>

      <div className="space-y-2 mb-5">
        {picks.map((p, i) => (
          <div
            key={i}
            className="flex items-center justify-between p-3 rounded-xl"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <span className="text-xs text-white/60 uppercase tracking-wider">{p.market}</span>
            <span className="font-bold flex items-center gap-2">
              {p.pick}
              {p.faded && (
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                  style={{ background: "#7B61FF", color: "white" }}
                >
                  FADE
                </span>
              )}
            </span>
          </div>
        ))}
      </div>

      <div
        className="flex items-center justify-between p-4 rounded-2xl"
        style={{ background: "#39E75F", color: "#0A0A0F" }}
      >
        <span className="font-bold uppercase text-xs tracking-wider">{displayName}</span>
        <span className="font-bold text-2xl tabular-nums">+{potential}</span>
      </div>
    </div>
  );
});
