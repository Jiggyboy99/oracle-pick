import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUp, ArrowDown, Minus, Flame, Sparkles, ChevronRight, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { PitchLines } from "@/components/PitchLines";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Oracle — World Cup 2026 Predictions" },
      { name: "description", content: "Predict every match. Fade the Oracle. Climb the board." },
    ],
  }),
  component: Home,
});

// ---------- Placeholder data (used as fallback so the screen always looks alive) ----------
type TeamLite = { code: string; name: string; flag: string };
const flag = (cc: string) => `https://flagcdn.com/w160/${cc}.png`;

const FALLBACK_NEXT = {
  matchday: 3,
  group: "Group F",
  venue: "MetLife Stadium · East Rutherford",
  kickoffAt: new Date(Date.now() + 1000 * 60 * 60 * 27 + 1000 * 60 * 14).toISOString(),
  home: { code: "ARG", name: "Argentina", flag: flag("ar") } as TeamLite,
  away: { code: "ESP", name: "Spain", flag: flag("es") } as TeamLite,
};

const FALLBACK_BOARD = [
  { id: "1", name: "Mateo Rivas", country: "ar", points: 2480, delta: 2, streak: 6 },
  { id: "oracle", name: "The Oracle", country: null, points: 2310, delta: 0, streak: 0, isOracle: true },
  { id: "2", name: "Yuki Tanaka", country: "jp", points: 2185, delta: -1, streak: 3 },
  { id: "3", name: "Amara Okonkwo", country: "ng", points: 2104, delta: 4, streak: 0 },
  { id: "me", name: "You", country: "us", points: 1987, delta: 1, streak: 2, isMe: true },
  { id: "4", name: "Lukas Müller", country: "de", points: 1902, delta: -3, streak: 0 },
  { id: "5", name: "Sofia Marchetti", country: "it", points: 1844, delta: 0, streak: 1 },
  { id: "6", name: "Hugo Laurent", country: "fr", points: 1780, delta: 2, streak: 0 },
];

function useCountdown(iso: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = Math.max(0, new Date(iso).getTime() - now);
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return { d, h, m, s, done: diff === 0 };
}

function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [points, setPoints] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("total_points")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setPoints(data?.total_points ?? 0));
  }, [user]);

  const next = FALLBACK_NEXT;
  const board = FALLBACK_BOARD;
  const { d, h, m, s } = useCountdown(next.kickoffAt);

  const sorted = useMemo(() => [...board].sort((a, b) => b.points - a.points), [board]);

  return (
    <div className="min-h-screen text-foreground">
      {/* ============== HEADER ============== */}
      <header className="max-w-[1200px] mx-auto px-5 md:px-10 pt-6 md:pt-8 pb-4 flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <span className="display text-3xl md:text-4xl leading-none">ORACLE</span>
          <span className="hidden md:inline text-[10px] tracking-[0.3em] text-white/40 uppercase">
            World Cup · 2026
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right leading-none">
            <div className="text-[10px] tracking-[0.25em] text-white/40 uppercase">Balance</div>
            <div className="num text-2xl md:text-3xl text-white mt-1">
              {(points ?? 1987).toLocaleString()}
              <span className="text-acid"> pts</span>
            </div>
          </div>
          <button
            onClick={() => (user ? navigate({ to: "/profile" }) : navigate({ to: "/auth" }))}
            className="w-11 h-11 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-sm font-semibold hover:bg-white/10 transition"
          >
            {(user?.email?.[0] ?? "U").toUpperCase()}
          </button>
        </div>
      </header>

      {/* ============== ASYMMETRIC GRID ============== */}
      <main className="max-w-[1200px] mx-auto px-5 md:px-10 pb-28 grid grid-cols-12 gap-4 md:gap-6">
        {/* ---------- NEXT MATCH HERO (8 cols) ---------- */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 90, damping: 18 }}
          className="col-span-12 lg:col-span-8 relative overflow-hidden rounded-[28px] bg-[#0F0F16] border border-white/10"
          style={{ minHeight: 480 }}
        >
          <PitchLines className="absolute inset-0 w-full h-full text-white" opacity={0.07} />
          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/60" />

          <div className="relative p-6 md:p-10 h-full flex flex-col justify-between min-h-[480px]">
            {/* meta row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-acid text-black text-[10px] font-bold tracking-[0.18em] uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" /> Next Match
                </span>
                <span className="text-[10px] tracking-[0.25em] text-white/50 uppercase hidden sm:inline">
                  MD {next.matchday} · {next.group}
                </span>
              </div>
              <span className="text-[10px] tracking-[0.25em] text-white/40 uppercase hidden md:inline">
                {next.venue}
              </span>
            </div>

            {/* teams */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 md:gap-8 my-6">
              <TeamBlock team={next.home} side="home" />
              <div className="flex flex-col items-center">
                <div className="num text-white/30 text-2xl md:text-3xl leading-none">VS</div>
              </div>
              <TeamBlock team={next.away} side="away" />
            </div>

            {/* countdown + cta */}
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
              <div>
                <div className="text-[10px] tracking-[0.3em] text-white/40 uppercase mb-2">
                  Kicks off in
                </div>
                <div className="flex items-baseline gap-3 md:gap-5">
                  <Tick value={d} label="Days" />
                  <Sep />
                  <Tick value={h} label="Hrs" />
                  <Sep />
                  <Tick value={m} label="Min" />
                  <Sep />
                  <Tick value={s} label="Sec" muted />
                </div>
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                whileHover={{ y: -2 }}
                transition={{ type: "spring", stiffness: 400, damping: 18 }}
                onClick={() => navigate({ to: "/matches" })}
                className="group relative inline-flex items-center justify-between gap-4 px-6 md:px-7 py-4 rounded-2xl bg-acid text-black font-bold uppercase tracking-[0.15em] text-sm md:text-base shadow-[0_10px_40px_-10px_rgba(57,231,95,0.55)]"
              >
                Predict this match
                <ChevronRight size={20} strokeWidth={3} />
              </motion.button>
            </div>
          </div>
        </motion.section>

        {/* ---------- ORACLE MOOD STRIP (4 cols) ---------- */}
        <motion.aside
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 90, damping: 18, delay: 0.05 }}
          className="col-span-12 lg:col-span-4 relative rounded-[28px] border border-white/10 bg-[#0F0F16] p-6 md:p-7 flex flex-col"
          style={{ minHeight: 480 }}
        >
          <div className="flex items-center gap-2 mb-6">
            <span className="text-[10px] tracking-[0.3em] text-white/40 uppercase">Oracle says</span>
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-[10px] tracking-[0.2em] text-oracle uppercase font-semibold">
              78% conf.
            </span>
          </div>

          {/* avatar */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: "#7B61FF" }}
              >
                <Sparkles className="text-white" size={28} strokeWidth={2.5} />
              </div>
              <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-black text-oracle border border-oracle/60">
                AI
              </span>
            </div>
            <div>
              <div className="text-[10px] tracking-[0.25em] text-white/40 uppercase">The Oracle</div>
              <div className="display text-2xl leading-tight mt-0.5">Smug Mode</div>
            </div>
          </div>

          {/* pick */}
          <div className="mt-6 rounded-2xl bg-white/[0.03] border border-white/10 p-5">
            <div className="text-[10px] tracking-[0.25em] text-white/40 uppercase mb-2">Headline pick</div>
            <div className="display text-3xl md:text-4xl leading-[0.95]">
              ARG <span className="text-oracle">2 – 1</span> ESP
            </div>
            <div className="mt-3 text-[11px] tracking-[0.2em] text-white/50 uppercase">
              Messi to score · BTTS yes
            </div>
          </div>

          {/* one-liner */}
          <p className="mt-6 text-[15px] leading-snug text-white/85 italic">
            "Spain look pretty on paper. Argentina just refuse to lose finals. You won't fade me. You can't."
          </p>

          <div className="mt-auto pt-6 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] text-white/50 uppercase tracking-[0.2em]">
              <span>Fade record</span>
              <span className="text-white">14W · 7L</span>
            </div>
            <Link
              to="/matches"
              className="text-[11px] uppercase tracking-[0.2em] font-bold text-oracle hover:text-white inline-flex items-center gap-1"
            >
              Fade it <ChevronRight size={14} />
            </Link>
          </div>
        </motion.aside>

        {/* ---------- LEADERBOARD (8 cols) ---------- */}
        <section className="col-span-12 lg:col-span-8 mt-2">
          <div className="flex items-end justify-between mb-5 px-1">
            <div>
              <div className="text-[10px] tracking-[0.3em] text-white/40 uppercase">Standings</div>
              <h2 className="display text-4xl md:text-5xl mt-1 leading-none">The Board</h2>
            </div>
            <Link
              to="/profile"
              className="text-[11px] uppercase tracking-[0.2em] font-bold text-white/60 hover:text-acid"
            >
              Full table →
            </Link>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-[#0F0F16] overflow-hidden">
            <div className="grid grid-cols-[40px_1fr_70px_90px] md:grid-cols-[56px_1fr_90px_110px] px-5 md:px-6 py-3 text-[10px] tracking-[0.25em] text-white/35 uppercase border-b border-white/5">
              <span>#</span>
              <span>Player</span>
              <span className="text-right">Form</span>
              <span className="text-right">Points</span>
            </div>
            <ul>
              {sorted.map((row, idx) => (
                <motion.li
                  key={row.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 22, delay: 0.04 * idx }}
                  className={`grid grid-cols-[40px_1fr_70px_90px] md:grid-cols-[56px_1fr_90px_110px] items-center px-5 md:px-6 py-4 border-b border-white/5 last:border-b-0 ${
                    (row as any).isMe ? "bg-acid/[0.04]" : ""
                  } ${(row as any).isOracle ? "bg-oracle/[0.06]" : ""}`}
                >
                  <span className="num text-xl md:text-2xl text-white/70">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <div className="flex items-center gap-3 min-w-0">
                    {(row as any).isOracle ? (
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: "#7B61FF" }}
                      >
                        <Sparkles size={18} className="text-white" strokeWidth={2.5} />
                      </div>
                    ) : row.country ? (
                      <img
                        src={flag(row.country)}
                        alt=""
                        className="w-10 h-7 object-cover rounded-md shrink-0 border border-white/10"
                      />
                    ) : (
                      <div className="w-10 h-7 rounded-md bg-white/10 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-[15px] truncate">{row.name}</span>
                        {(row as any).isOracle && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider text-oracle border border-oracle/60">
                            AI
                          </span>
                        )}
                        {(row as any).isMe && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-acid text-black">
                            You
                          </span>
                        )}
                        {row.streak >= 2 && (
                          <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-[color:var(--flame)]">
                            <Flame size={12} fill="currentColor" />
                            {row.streak}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <DeltaPill delta={row.delta} />
                  </div>
                  <div className="num text-2xl md:text-3xl text-right text-white">
                    {row.points.toLocaleString()}
                  </div>
                </motion.li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------- RECAP CARD (4 cols) ---------- */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 90, damping: 18, delay: 0.1 }}
          className="col-span-12 lg:col-span-4 mt-2"
        >
          <div className="flex items-end justify-between mb-5 px-1">
            <div>
              <div className="text-[10px] tracking-[0.3em] text-white/40 uppercase">Story</div>
              <h2 className="display text-4xl md:text-5xl mt-1 leading-none">Recap</h2>
            </div>
          </div>

          <button className="group w-full text-left relative overflow-hidden rounded-[24px] border border-white/10 bg-[#0F0F16] aspect-[4/5] lg:aspect-auto lg:h-[calc(100%-72px)]">
            <PitchLines className="absolute inset-0 w-full h-full text-acid" opacity={0.1} />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
            {/* story progress bars */}
            <div className="absolute top-4 left-4 right-4 flex gap-1.5 z-10">
              {[100, 100, 60, 0, 0].map((w, i) => (
                <div key={i} className="flex-1 h-0.5 bg-white/15 rounded-full overflow-hidden">
                  <div className="h-full bg-white" style={{ width: `${w}%` }} />
                </div>
              ))}
            </div>
            <div className="absolute top-10 left-5 flex items-center gap-2">
              <BookOpen size={14} className="text-acid" />
              <span className="text-[10px] tracking-[0.25em] text-white/70 uppercase">
                Matchday 2 · 3 min ago
              </span>
            </div>

            <div className="absolute inset-x-0 bottom-0 p-6">
              <div className="display text-3xl md:text-4xl leading-[0.95]">
                Brazil <span className="text-acid">stunned</span> by Morocco
              </div>
              <p className="mt-3 text-sm text-white/70 leading-snug">
                The Oracle ate dirt. 62% of you fade-bet against it. Streaks were broken. Tap to relive the chaos.
              </p>
              <div className="mt-5 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] font-bold text-acid">
                Watch story <ChevronRight size={14} />
              </div>
            </div>
          </button>
        </motion.section>
      </main>
    </div>
  );
}

// ---------- subcomponents ----------

function TeamBlock({ team, side }: { team: TeamLite; side: "home" | "away" }) {
  return (
    <div className={`flex flex-col ${side === "away" ? "items-end text-right" : "items-start"} gap-3`}>
      <img
        src={team.flag}
        alt={team.name}
        className="w-20 h-14 md:w-28 md:h-20 object-cover rounded-lg border border-white/15 shadow-2xl"
      />
      <div>
        <div className="display text-5xl md:text-7xl leading-[0.85]">{team.code}</div>
        <div className="text-[11px] tracking-[0.25em] text-white/50 uppercase mt-1">{team.name}</div>
      </div>
    </div>
  );
}

function Tick({ value, label, muted = false }: { value: number; label: string; muted?: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <div className={`num text-4xl md:text-6xl leading-none ${muted ? "text-white/40" : "text-white"}`}>
        {String(value).padStart(2, "0")}
      </div>
      <div className="text-[9px] md:text-[10px] tracking-[0.3em] text-white/40 uppercase mt-1">
        {label}
      </div>
    </div>
  );
}

function Sep() {
  return <span className="num text-3xl md:text-5xl text-white/15 leading-none pb-4">:</span>;
}

function DeltaPill({ delta }: { delta: number }) {
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
