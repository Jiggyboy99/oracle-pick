import { useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

type Frame = { title: string; body: string; bg: string };

export function StoryRecap({ matchday, body, onClose }: { matchday: number; body: string; onClose: () => void }) {
  const frames: Frame[] = [
    { title: "Matchday Recap", body: `Matchday ${matchday}`, bg: "linear-gradient(135deg,#7B61FF,#39E75F)" },
    { title: "The Story", body, bg: "linear-gradient(135deg,#0A0A0F,#1A1130)" },
    { title: "Biggest Riser", body: "Top climber gained 14 ranks. Pure heat.", bg: "linear-gradient(135deg,#39E75F,#0A0A0F)" },
    { title: "Got Humbled", body: "The Oracle dropped one. Faders ate good.", bg: "linear-gradient(135deg,#7B61FF,#FF5C8A)" },
    { title: "Giant Killer", body: "Someone faded the Oracle at 88% and lived to tell.", bg: "linear-gradient(135deg,#FF9F40,#0A0A0F)" },
  ];

  const [i, setI] = useState(0);
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (reduced) return;
    const t = setTimeout(() => {
      if (i < frames.length - 1) setI(i + 1);
      else onClose();
    }, 4000);
    return () => clearTimeout(t);
  }, [i, frames.length, onClose, reduced]);

  const f = frames[i];

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="absolute top-3 left-3 right-3 flex gap-1 z-10">
        {frames.map((_, idx) => (
          <div key={idx} className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white"
              style={{
                width: idx < i ? "100%" : idx === i ? undefined : "0%",
                animation: idx === i && !reduced ? "story-bar 4s linear forwards" : undefined,
              }}
            />
          </div>
        ))}
      </div>
      <button
        onClick={onClose}
        className="absolute top-6 right-4 z-10 text-white p-2 active:scale-90"
      >
        <X size={24} />
      </button>

      <div className="flex-1 flex items-center justify-center p-8 relative" style={{ background: f.bg }}>
        <button
          className="absolute left-0 top-0 bottom-0 w-1/3"
          onClick={() => setI(Math.max(0, i - 1))}
          aria-label="Previous"
        >
          <ChevronLeft className="text-white/30 mx-auto" />
        </button>
        <button
          className="absolute right-0 top-0 bottom-0 w-1/3"
          onClick={() => (i < frames.length - 1 ? setI(i + 1) : onClose())}
          aria-label="Next"
        >
          <ChevronRight className="text-white/30 mx-auto ml-auto" />
        </button>

        <div className="text-center max-w-md">
          <div className="text-xs uppercase tracking-[0.3em] text-white/70 mb-4">{f.title}</div>
          <div className="text-3xl md:text-4xl font-bold text-white leading-tight" style={{ fontFamily: "var(--font-display)" }}>
            {f.body}
          </div>
        </div>
      </div>
    </div>
  );
}
