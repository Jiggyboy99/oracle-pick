import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Lock, Sparkles, Check } from "lucide-react";
import { PitchLines } from "@/components/PitchLines";

export const Route = createFileRoute("/predict")({
  head: () => ({
    meta: [
      { title: "Predict — Oracle" },
      { name: "description", content: "Lock in your call. Fade the Oracle." },
    ],
  }),
  component: PredictScreen,
});

const flag = (cc: string) => `https://flagcdn.com/w160/${cc}.png`;

const FIXTURE = {
  matchday: 3,
  group: "Group F",
  venue: "MetLife Stadium · East Rutherford",
  kickoffAt: new Date(Date.now() + 1000 * 60 * 60 * 27 + 1000 * 60 * 14).toISOString(),
  home: { code: "ARG", name: "Argentina", flag: flag("ar") },
  away: { code: "ESP", name: "Spain", flag: flag("es") },
};

type Market = {
  id: string;
  label: string;
  points: number;
  options: { value: string; label: string; sub?: string }[];
  oracle: { pick: string; confidence: number; reasoning: string; quip: string };
};

const MARKETS: Market[] = [
  {
    id: "result",
    label: "Match Result",
    points: 30,
    options: [
      { value: "H", label: "ARG", sub: "Win" },
      { value: "D", label: "Draw" },
      { value: "A", label: "ESP", sub: "Win" },
    ],
    oracle: {
      pick: "H",
      confidence: 0.62,
      reasoning: "Argentina unbeaten in their last 11 competitive fixtures; Spain rotating.",
      quip: "Messi in finals weather. Easy.",
    },
  },
  {
    id: "score",
    label: "Exact Score",
    points: 120,
    options: [
      { value: "2-1", label: "2–1" },
      { value: "1-1", label: "1–1" },
      { value: "2-0", label: "2–0" },
      { value: "1-0", label: "1–0" },
      { value: "1-2", label: "1–2" },
      { value: "0-0", label: "0–0" },
    ],
    oracle: {
      pick: "2-1",
      confidence: 0.21,
      reasoning: "Open game; both sides press high. Late winner in the model 41% of sims.",
      quip: "Risky? Yes. Right? Probably.",
    },
  },
  {
    id: "btts",
    label: "Both Teams to Score",
    points: 25,
    options: [
      { value: "Y", label: "Yes" },
      { value: "N", label: "No" },
    ],
    oracle: {
      pick: "Y",
      confidence: 0.74,
      reasoning: "Both attacks averaging 2.1 xG. Neither keeper in form.",
      quip: "Goals incoming. Bank it.",
    },
  },
  {
    id: "ou",
    label: "Total Goals · O/U 2.5",
    points: 25,
    options: [
      { value: "O", label: "Over 2.5" },
      { value: "U", label: "Under 2.5" },
    ],
    oracle: {
      pick: "O",
      confidence: 0.68,
      reasoning: "Last 6 H2H averaged 3.3 goals. Tempo will be high from minute one.",
      quip: "Under 2.5 is for cowards.",
    },
  },
  {
    id: "cards",
    label: "Yellow Cards · O/U 4.5",
    points: 20,
    options: [
      { value: "O", label: "Over 4.5" },
      { value: "U", label: "Under 4.5" },
    ],
    oracle: {
      pick: "O",
      confidence: 0.57,
      reasoning: "Referee Marciniak averages 5.2 yellows in knockout fixtures.",
      quip: "Marciniak's pocket is loaded.",
    },
  },
  {
    id: "fgs",
    label: "First Goalscorer",
    points: 80,
    options: [
      { value: "messi", label: "Messi" },
      { value: "alvarez", label: "Álvarez" },
      { value: "yamal", label: "Yamal" },
      { value: "morata", label: "Morata" },
      { value: "other", label: "Other" },
      { value: "none", label: "No goal" },
    ],
    oracle: {
      pick: "alvarez",
      confidence: 0.18,
      reasoning: "Penalty-box presence; tap-in king. 14% per sim, highest in the pool.",
      quip: "Julián opens. Trust the spider.",
    },
  },
];

function useCountdown(iso: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = Math.max(0, new Date(iso).getTime() - now);
  return {
    d: Math.floor(diff / 86400000),
    h: Math.floor((diff % 86400000) / 3600000),
    m: Math.floor((diff % 3600000) / 60000),
    s: Math.floor((diff % 60000) / 1000),
    done: diff === 0,
  };
}

function PredictScreen() {
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [locked, setLocked] = useState(false);
  const [thunk, setThunk] = useState(0);
  const { d, h, m, s, done } = useCountdown(FIXTURE.kickoffAt);
  const frozen = locked || done;

  const potential = useMemo(
    () => MARKETS.reduce((sum, mk) => (picks[mk.id] ? sum + mk.points : sum), 0),
    [picks],
  );
  const selectedCount = Object.keys(picks).length;

  function select(marketId: string, value: string) {
    if (frozen) return;
    setPicks((p) => ({ ...p, [marketId]: p[marketId] === value ? p[marketId] : value }));
  }

  function lockIn() {
    if (frozen || selectedCount === 0) return;
    setLocked(true);
    setThunk((k) => k + 1);
  }

  return (
    <div className="min-h-screen text-foreground pb-40">
      {/* ============== HEADER ============== */}
      <header className="max-w-[1200px] mx-auto px-5 md:px-10 pt-6 md:pt-8 pb-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-white/50 hover:text-white transition text-xs tracking-[0.25em] uppercase">
          <ArrowLeft size={14} /> The Board
        </Link>
        <div className="flex items-baseline gap-3">
          <span className="display text-2xl md:text-3xl leading-none">ORACLE</span>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-5 md:px-10 grid grid-cols-12 gap-4 md:gap-6">
        {/* ============== MATCH HERO ============== */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 90, damping: 18 }}
          className="col-span-12 relative overflow-hidden rounded-[28px] bg-[#0F0F16] border border-white/10"
        >
          <PitchLines className="absolute inset-0 w-full h-full text-white" opacity={0.07} />
          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/60" />

          <div className="relative p-6 md:p-10">
            {/* meta */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3 text-[10px] tracking-[0.3em] uppercase text-white/50">
                <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/80">
                  Matchday {FIXTURE.matchday}
                </span>
                <span>{FIXTURE.group}</span>
                <span className="hidden md:inline">· {FIXTURE.venue}</span>
              </div>
              {frozen ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/15 border border-destructive/40 text-destructive text-[10px] tracking-[0.25em] uppercase font-semibold">
                  <Lock size={11} /> Locked
                </span>
              ) : (
                <span className="text-[10px] tracking-[0.3em] uppercase text-white/40">Live odds</span>
              )}
            </div>

            {/* teams + countdown */}
            <div className="grid grid-cols-7 items-center gap-4">
              <div className="col-span-3 flex flex-col items-start">
                <img src={FIXTURE.home.flag} alt="" className="w-16 h-11 rounded object-cover mb-3 border border-white/10" />
                <div className="display text-[64px] md:text-[110px] leading-[0.85] text-white">{FIXTURE.home.code}</div>
                <div className="text-xs tracking-[0.2em] uppercase text-white/40 mt-2">{FIXTURE.home.name}</div>
              </div>

              <div className="col-span-1 flex flex-col items-center text-center">
                <div className="text-[10px] tracking-[0.3em] uppercase text-white/40 mb-2">Kick-off in</div>
                <div className="num text-3xl md:text-4xl text-acid tabular-nums leading-none">
                  {String(d).padStart(2, "0")}:{String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
                </div>
                <div className="text-[9px] tracking-[0.35em] uppercase text-white/30 mt-2">D · H · M · S</div>
              </div>

              <div className="col-span-3 flex flex-col items-end">
                <img src={FIXTURE.away.flag} alt="" className="w-16 h-11 rounded object-cover mb-3 border border-white/10" />
                <div className="display text-[64px] md:text-[110px] leading-[0.85] text-white">{FIXTURE.away.code}</div>
                <div className="text-xs tracking-[0.2em] uppercase text-white/40 mt-2">{FIXTURE.away.name}</div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ============== SECTION TITLE ============== */}
        <div className="col-span-12 flex items-end justify-between mt-4">
          <div>
            <div className="text-[10px] tracking-[0.3em] uppercase text-white/40">Step 02</div>
            <h2 className="display text-4xl md:text-5xl leading-none mt-1">Make the Call</h2>
          </div>
          <div className="text-right">
            <div className="text-[10px] tracking-[0.3em] uppercase text-white/40">Selected</div>
            <div className="num text-2xl text-white mt-1">
              {selectedCount}<span className="text-white/30">/{MARKETS.length}</span>
            </div>
          </div>
        </div>

        {/* ============== MARKETS ============== */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-4">
          {MARKETS.map((mk, i) => {
            const userPick = picks[mk.id];
            const oraclePicked = mk.options.find((o) => o.value === mk.oracle.pick);
            const isFade = userPick && userPick !== mk.oracle.pick;

            return (
              <motion.div
                key={mk.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 100, damping: 18, delay: i * 0.04 }}
                className="rounded-[24px] bg-[#0F0F16] border border-white/10 overflow-hidden"
              >
                {/* market header */}
                <div className="p-5 md:p-6 flex items-center justify-between border-b border-white/5">
                  <div>
                    <div className="text-[10px] tracking-[0.3em] uppercase text-white/40">Market {String(i + 1).padStart(2, "0")}</div>
                    <div className="display text-xl md:text-2xl mt-1">{mk.label}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] tracking-[0.3em] uppercase text-white/40">Reward</div>
                    <div className="num text-2xl text-acid mt-0.5">+{mk.points}</div>
                  </div>
                </div>

                {/* options */}
                <div className="p-5 md:p-6">
                  <div className={`grid gap-2 ${mk.options.length <= 2 ? "grid-cols-2" : mk.options.length === 3 ? "grid-cols-3" : "grid-cols-3 md:grid-cols-6"}`}>
                    {mk.options.map((opt) => {
                      const active = userPick === opt.value;
                      const isOracle = mk.oracle.pick === opt.value;
                      return (
                        <motion.button
                          key={opt.value}
                          whileTap={frozen ? {} : { scale: 0.93 }}
                          transition={{ type: "spring", stiffness: 400, damping: 18 }}
                          onClick={() => select(mk.id, opt.value)}
                          disabled={frozen}
                          className={[
                            "relative px-3 py-3.5 rounded-2xl border text-left transition-colors",
                            "flex flex-col items-start justify-center min-h-[64px]",
                            active
                              ? "bg-acid border-acid text-acid-foreground"
                              : "bg-white/[0.03] border-white/10 hover:border-white/25 hover:bg-white/[0.06] text-white",
                            frozen && !active ? "opacity-40" : "",
                          ].join(" ")}
                        >
                          {active && (
                            <span className="absolute top-2 right-2">
                              <Check size={14} strokeWidth={3} />
                            </span>
                          )}
                          {isOracle && !active && (
                            <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-oracle" />
                          )}
                          <span className={`num text-lg leading-none ${active ? "" : "text-white"}`}>{opt.label}</span>
                          {opt.sub && (
                            <span className={`text-[10px] tracking-[0.2em] uppercase mt-1 ${active ? "text-acid-foreground/70" : "text-white/40"}`}>
                              {opt.sub}
                            </span>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* oracle pick row */}
                  <div
                    className="mt-5 rounded-2xl border border-oracle/30 p-4 md:p-5 flex gap-4 items-start"
                    style={{ background: "color-mix(in oklab, var(--oracle) 10%, #0A0A0F)" }}
                  >
                    <div className="shrink-0 w-12 h-12 rounded-full bg-oracle/20 border border-oracle/40 flex items-center justify-center">
                      <Sparkles size={18} className="text-oracle" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="flex items-baseline gap-2">
                          <span className="text-[10px] tracking-[0.3em] uppercase text-oracle font-bold">Oracle</span>
                          <span className="text-[10px] tracking-[0.2em] uppercase text-white/40">picks</span>
                          <span className="num text-lg text-white">{oraclePicked?.label}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="num text-3xl md:text-4xl text-oracle leading-none tabular-nums">
                            {Math.round(mk.oracle.confidence * 100)}<span className="text-base text-oracle/70">%</span>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-white/70 mt-2 leading-snug">{mk.oracle.reasoning}</p>
                      <p className="text-xs italic text-oracle/80 mt-1.5">"{mk.oracle.quip}"</p>
                      {isFade && (
                        <div className="mt-3 inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-acid/15 border border-acid/40 text-acid text-[10px] tracking-[0.25em] uppercase font-semibold">
                          Fading the Oracle
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* ============== SIDE PANEL ============== */}
        <aside className="col-span-12 lg:col-span-4 flex flex-col gap-4">
          <div className="rounded-[24px] bg-[#0F0F16] border border-white/10 p-6 sticky top-6">
            <div className="text-[10px] tracking-[0.3em] uppercase text-white/40">Your slip</div>
            <div className="flex items-baseline gap-2 mt-2">
              <div className="num text-6xl text-acid leading-none tabular-nums">+{potential}</div>
              <div className="text-xs tracking-[0.2em] uppercase text-white/40">pts max</div>
            </div>
            <div className="h-px bg-white/10 my-5" />
            <ul className="space-y-2.5 max-h-[280px] overflow-y-auto">
              {MARKETS.map((mk) => {
                const picked = picks[mk.id];
                const opt = picked ? mk.options.find((o) => o.value === picked) : null;
                return (
                  <li key={mk.id} className="flex items-center justify-between text-sm">
                    <span className="text-white/50 truncate">{mk.label}</span>
                    <span className={opt ? "num text-white" : "text-white/20 text-xs tracking-[0.2em] uppercase"}>
                      {opt ? opt.label : "—"}
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="h-px bg-white/10 my-5" />
            <div className="flex items-center justify-between text-[10px] tracking-[0.3em] uppercase text-white/40">
              <span>Selected</span>
              <span className="text-white">{selectedCount}/{MARKETS.length}</span>
            </div>
          </div>
        </aside>
      </main>

      {/* ============== STICKY LOCK BAR ============== */}
      <div className="fixed bottom-0 left-0 right-0 z-30 pointer-events-none">
        <div className="max-w-[1200px] mx-auto px-5 md:px-10 pb-5">
          <motion.div
            key={thunk}
            initial={false}
            animate={thunk ? { scale: [1, 0.96, 1] } : {}}
            transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
            className="pointer-events-auto rounded-2xl border border-white/10 bg-[#0F0F16]/95 backdrop-blur-xl p-3 flex items-center gap-3 shadow-2xl shadow-black/60"
          >
            <div className="pl-3 pr-2 py-1 flex-1 min-w-0">
              <div className="text-[9px] tracking-[0.3em] uppercase text-white/40">Potential</div>
              <AnimatePresence mode="popLayout">
                <motion.div
                  key={potential}
                  initial={{ y: 8, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -8, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 380, damping: 22 }}
                  className="num text-2xl md:text-3xl text-white tabular-nums leading-none mt-1"
                >
                  +{potential} <span className="text-white/30 text-base">pts</span>
                </motion.div>
              </AnimatePresence>
            </div>

            <motion.button
              whileTap={frozen || selectedCount === 0 ? {} : { scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
              onClick={lockIn}
              disabled={frozen || selectedCount === 0}
              className={[
                "relative px-6 md:px-8 py-4 rounded-xl font-bold uppercase tracking-[0.2em] text-sm flex items-center gap-2 transition-colors",
                frozen
                  ? "bg-white/5 text-white/40 border border-white/10"
                  : selectedCount === 0
                    ? "bg-white/5 text-white/30 border border-white/10"
                    : "bg-acid text-acid-foreground hover:brightness-110",
              ].join(" ")}
            >
              {frozen ? <><Lock size={14} /> Locked</> : <>Lock it in</>}
            </motion.button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
