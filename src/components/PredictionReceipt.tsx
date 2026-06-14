import { forwardRef } from "react";
import { Sparkles } from "lucide-react";

export type ReceiptPick = { market: string; pick: string; faded?: boolean; correct?: boolean };

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
    variant?: "default" | "called-it";
    calledScore?: string;
  }
>(function PredictionReceipt(
  { displayName, home, away, homeCode, awayCode, picks, potential, variant = "default", calledScore },
  ref
) {
  const isCalledIt = variant === "called-it";

  return (
    <div
      ref={ref}
      className="relative w-full max-w-md mx-auto p-6 rounded-3xl overflow-hidden"
      style={{
        background: isCalledIt
          ? "radial-gradient(circle at 0% 0%, #39E75F44, transparent 50%), radial-gradient(circle at 100% 100%, #39E75F22, transparent 50%), #0A0A0F"
          : "radial-gradient(circle at 0% 0%, #7B61FF33, transparent 50%), radial-gradient(circle at 100% 100%, #39E75F22, transparent 50%), #0A0A0F",
        color: "white",
        border: isCalledIt ? "1px solid rgba(57,231,95,0.4)" : "1px solid rgba(255,255,255,0.1)",
      }}
    >
      {isCalledIt && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(circle at 50% 0%, rgba(57,231,95,0.12), transparent 60%)",
          }}
        />
      )}

      <div className="relative flex items-center justify-between text-xs uppercase tracking-widest text-white/60 mb-4">
        {isCalledIt ? (
          <span className="font-black tracking-[0.2em] text-sm" style={{ color: "#39E75F" }}>
            I CALLED IT
          </span>
        ) : (
          <span>Locked In</span>
        )}
        <span className="flex items-center gap-1">
          <Sparkles size={12} className={isCalledIt ? "text-acid" : "text-acid"} />
          {isCalledIt ? "Exact Score" : "Predictor"}
        </span>
      </div>

      {isCalledIt && calledScore && (
        <div className="relative mb-5 text-center">
          <div
            className="num text-[72px] leading-none font-black tabular-nums"
            style={{ color: "#39E75F", textShadow: "0 0 40px rgba(57,231,95,0.5)" }}
          >
            {calledScore}
          </div>
          <div className="text-xs tracking-[0.25em] uppercase text-white/40 mt-1">Perfect call</div>
        </div>
      )}

      <div className="relative flex items-center justify-between mb-5">
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

      <div className="relative space-y-2 mb-5">
        {picks.map((p, i) => (
          <div
            key={i}
            className="flex items-center justify-between p-3 rounded-xl"
            style={{
              background: p.correct
                ? "rgba(57,231,95,0.12)"
                : "rgba(255,255,255,0.04)",
              border: p.correct
                ? "1px solid rgba(57,231,95,0.4)"
                : "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <span className="text-xs text-white/60 uppercase tracking-wider">{p.market}</span>
            <span className="font-bold flex items-center gap-2">
              {p.correct && (
                <span
                  className="text-[9px] font-black px-1.5 py-0.5 rounded"
                  style={{ background: "#39E75F", color: "#0A0A0F" }}
                >
                  EXACT
                </span>
              )}
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
        className="relative flex items-center justify-between p-4 rounded-2xl"
        style={
          isCalledIt
            ? { background: "#39E75F", color: "#0A0A0F" }
            : { background: "#39E75F", color: "#0A0A0F" }
        }
      >
        <span className="font-bold uppercase text-xs tracking-wider">{displayName}</span>
        <span className="font-bold text-2xl tabular-nums">+{potential}</span>
      </div>
    </div>
  );
});
