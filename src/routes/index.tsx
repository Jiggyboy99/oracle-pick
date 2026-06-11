import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion, LayoutGroup, useReducedMotion } from "framer-motion";
import { Sparkles, ChevronRight, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { PitchLines } from "@/components/PitchLines";
import { PageTransition } from "@/components/motion/PageTransition";
import { CountUp } from "@/components/motion/CountUp";
import { BoardRow } from "@/components/motion/BoardRow";
import type { BoardRowData } from "@/components/motion/BoardRow";
import { NoiseOverlay } from "@/components/motion/NoiseOverlay";
import { StaggerGroup, StaggerItem } from "@/components/motion/Stagger";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CalledIt.gg — World Cup 2026 Predictions" },
      { name: "description", content: "Predict every match. Fade the Oracle. Climb the board." },
    ],
  }),
  component: Home,
});

type TeamLite = { code: string; name: string; flag: string };

type NextMatch = {
  matchday: number;
  kickoffAt: string;
  home: TeamLite;
  away: TeamLite;
};

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
  const reduce = useReducedMotion();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [points, setPoints] = useState<number | null>(null);
  const [nextMatch, setNextMatch] = useState<NextMatch | null>(null);
  const [boardRows, setBoardRows] = useState<BoardRowData[] | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("total_points")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setPoints(data?.total_points ?? 0));
  }, [user]);

  useEffect(() => {
    supabase
      .from("fixtures")
      .select(
        "id, matchday, kickoff_at, home:teams!fixtures_home_team_id_fkey(name,code,flag_url), away:teams!fixtures_away_team_id_fkey(name,code,flag_url)"
      )
      .in("status", ["upcoming", "locked"])
      .order("kickoff_at", { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const h = data.home as { name: string; code: string; flag_url: string | null };
        const a = data.away as { name: string; code: string; flag_url: string | null };
        setNextMatch({
          matchday: data.matchday,
          kickoffAt: data.kickoff_at,
          home: {
            code: h.code,
            name: h.name,
            flag: h.flag_url ?? `https://flagcdn.com/w160/${h.code.toLowerCase()}.png`,
          },
          away: {
            code: a.code,
            name: a.name,
            flag: a.flag_url ?? `https://flagcdn.com/w160/${a.code.toLowerCase()}.png`,
          },
        });
      });

    supabase
      .from("profiles")
      .select("id, display_name, total_points, current_streak")
      .order("total_points", { ascending: false })
      .limit(8)
      .then(({ data }) => {
        setBoardRows(
          (data ?? []).map((p) => ({
            id: p.id,
            name: p.display_name,
            country: null,
            points: p.total_points,
            delta: 0,
            streak: p.current_streak,
          }))
        );
      });
  }, []);

  const board = useMemo<BoardRowData[]>(() => {
    if (!boardRows) return [];
    return boardRows.map((row) => ({ ...row, isMe: row.id === user?.id }));
  }, [boardRows, user]);

  const sorted = useMemo(() => [...board].sort((a, b) => b.points - a.points), [board]);
  const { d, h, m, s } = useCountdown(
    nextMatch?.kickoffAt ?? new Date(Date.now() + 86400000).toISOString()
  );

  return (
    <PageTransition>
      <div className="min-h-screen text-foreground">
        {/* ============== HEADER ============== */}
        <header className="max-w-[1200px] mx-auto px-5 md:px-10 pt-6 md:pt-8 pb-4 flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <span className="display text-3xl md:text-4xl leading-none">CalledIt</span>
            <span className="hidden md:inline text-[10px] tracking-[0.3em] text-white/40 uppercase">
              World Cup · 2026
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right leading-none">
              <div className="text-[10px] tracking-[0.25em] text-white/40 uppercase">Balance</div>
              <div className="mt-1">
                <CountUp
                  value={points ?? 0}
                  className="num text-2xl md:text-3xl text-white"
                />
                <span className="num text-2xl md:text-3xl text-acid"> pts</span>
              </div>
            </div>
            <Link
              to={user ? "/profile" : "/auth"}
              className="w-11 h-11 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-sm font-semibold hover:bg-white/10 transition"
            >
              {(user?.email?.[0] ?? "U").toUpperCase()}
            </Link>
          </div>
        </header>

        {/* ============== ASYMMETRIC GRID ============== */}
        <main className="max-w-[1200px] mx-auto px-5 md:px-10 pb-28 grid grid-cols-12 gap-4 md:gap-6">
          <StaggerGroup baseDelay={0} itemDelay={0.08}>
            {/* ---------- NEXT MATCH HERO ---------- */}
            <StaggerItem index={0} className="col-span-12 lg:col-span-8">
              <section
                className="relative overflow-hidden rounded-[28px] bg-[#0F0F16] border border-white/10"
                style={{ minHeight: 480 }}
              >
                <motion.div
                  className="absolute inset-0 scale-110"
                  animate={
                    reduce
                      ? {}
                      : { x: [0, 8, 0, -8, 0], y: [0, -6, 0, 6, 0] }
                  }
                  transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
                >
                  <PitchLines className="w-full h-full text-white" opacity={0.07} />
                </motion.div>
                <NoiseOverlay opacity={0.04} />
                <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/60" />

                <div className="relative p-6 md:p-10 h-full flex flex-col justify-between min-h-[480px]">
                  {/* meta row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-acid text-black text-[10px] font-bold tracking-[0.18em] uppercase">
                        <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" /> Next Match
                      </span>
                      {nextMatch && (
                        <span className="text-[10px] tracking-[0.25em] text-white/50 uppercase hidden sm:inline">
                          MD {nextMatch.matchday}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* teams */}
                  {nextMatch ? (
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 md:gap-8 my-6">
                      <TeamBlock team={nextMatch.home} side="home" />
                      <div className="flex flex-col items-center">
                        <div className="num text-white/30 text-2xl md:text-3xl leading-none">VS</div>
                      </div>
                      <TeamBlock team={nextMatch.away} side="away" />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center flex-1 my-6">
                      <div className="text-white/30 text-sm tracking-[0.25em] uppercase animate-pulse">
                        Loading fixture…
                      </div>
                    </div>
                  )}

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
                      className="group relative inline-flex items-center justify-between gap-4 px-6 md:px-7 py-4 rounded-2xl bg-acid text-black font-bold uppercase tracking-[0.15em] text-sm md:text-base shadow-[0_10px_40px_-10px_rgba(57,231,95,0.55)] anim-glow"
                    >
                      Predict this match
                      <ChevronRight size={20} strokeWidth={3} />
                    </motion.button>
                  </div>
                </div>
              </section>
            </StaggerItem>

            {/* ---------- ORACLE MOOD STRIP ---------- */}
            <StaggerItem index={1} className="col-span-12 lg:col-span-4">
              <aside
                className="relative rounded-[28px] border border-oracle/20 bg-[#0F0F16] p-6 md:p-7 flex flex-col anim-oracle-glow"
                style={{ minHeight: 480 }}
              >
                <NoiseOverlay opacity={0.03} />
                <div className="relative flex items-center gap-2 mb-6">
                  <span className="text-[10px] tracking-[0.3em] text-white/40 uppercase">Oracle says</span>
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-[10px] tracking-[0.2em] text-oracle uppercase font-semibold">
                    78% conf.
                  </span>
                </div>

                {/* avatar */}
                <div className="relative flex items-center gap-4">
                  <div className="relative">
                    <div
                      className="w-16 h-16 rounded-2xl flex items-center justify-center"
                      style={{
                        background: "#7B61FF",
                        boxShadow: "0 0 24px 4px rgba(123,97,255,0.45)",
                      }}
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
                <div className="relative mt-6 rounded-2xl bg-white/[0.03] border border-white/10 p-5">
                  <div className="text-[10px] tracking-[0.25em] text-white/40 uppercase mb-2">Headline pick</div>
                  <div className="display text-3xl md:text-4xl leading-[0.95]">
                    ARG <span className="text-oracle">2 – 1</span> ESP
                  </div>
                  <div className="mt-3 text-[11px] tracking-[0.2em] text-white/50 uppercase">
                    Messi to score · BTTS yes
                  </div>
                </div>

                {/* one-liner */}
                <p className="relative mt-6 text-[15px] leading-snug text-white/85 italic">
                  "Spain look pretty on paper. Argentina just refuse to lose finals. You won't fade me. You can't."
                </p>

                <div className="relative mt-auto pt-6 flex items-center justify-between">
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
              </aside>
            </StaggerItem>

            {/* ---------- LEADERBOARD ---------- */}
            <StaggerItem index={2} className="col-span-12 lg:col-span-8 mt-2">
              <section>
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
                  <LayoutGroup id="home-board">
                    <ul>
                      {boardRows === null ? (
                        <li className="px-5 md:px-6 py-6 text-center text-white/30 text-sm tracking-[0.25em] uppercase animate-pulse">
                          Loading…
                        </li>
                      ) : sorted.length === 0 ? (
                        <li className="px-5 md:px-6 py-6 text-center text-white/30 text-sm tracking-[0.25em] uppercase">
                          No players yet
                        </li>
                      ) : (
                        sorted.map((row, idx) => (
                          <BoardRow
                            key={row.id}
                            id={row.id}
                            rank={idx + 1}
                            data={row}
                            index={idx}
                          />
                        ))
                      )}
                    </ul>
                  </LayoutGroup>
                </div>
              </section>
            </StaggerItem>

            {/* ---------- RECAP CARD ---------- */}
            <StaggerItem index={3} className="col-span-12 lg:col-span-4 mt-2">
              <section>
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
              </section>
            </StaggerItem>
          </StaggerGroup>
        </main>
      </div>
    </PageTransition>
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
