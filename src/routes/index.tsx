import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { Layout } from "@/components/Layout";
import { OracleAvatar } from "@/components/OracleAvatar";
import { StreakFlame } from "@/components/StreakFlame";
import { StoryRecap } from "@/components/StoryRecap";
import { oracleMood } from "@/lib/oracle";
import { Sparkles, BookOpen } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Leaderboard — Predictor" },
      { name: "description", content: "Live World Cup prediction leaderboard. Fade the Oracle." },
    ],
  }),
  component: Home,
});

type Row = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  total_points: number;
  current_streak: number;
  oracle_wins: number;
  oracle_losses: number;
};

function Home() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [oraclePoints, setOraclePoints] = useState(0);
  const [oracleAcc, setOracleAcc] = useState(0.5);
  const [recap, setRecap] = useState<{ matchday: number; body: string } | null>(null);
  const [showStory, setShowStory] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    async function load() {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, total_points, current_streak, oracle_wins, oracle_losses")
        .order("total_points", { ascending: false })
        .limit(100);
      setRows(profiles ?? []);

      // Oracle "score": sum of points it would have earned on finished fixtures
      const { data: oracle } = await supabase
        .from("oracle_picks")
        .select("prediction, confidence, market_id, markets(points, type, fixture_id, fixtures(home_goals, away_goals))");
      let pts = 0, hits = 0, total = 0;
      (oracle ?? []).forEach((op: any) => {
        const fx = op.markets?.fixtures;
        if (fx?.home_goals == null) return;
        total++;
        const result = fx.home_goals > fx.away_goals ? "home" : fx.home_goals < fx.away_goals ? "away" : "draw";
        const t = op.markets.type;
        let ok = false;
        if (t === "result" && op.prediction === result) ok = true;
        else if (t === "scoreline" && op.prediction === `${fx.home_goals}-${fx.away_goals}`) ok = true;
        else if (t === "btts" && ((op.prediction === "yes") === (fx.home_goals > 0 && fx.away_goals > 0))) ok = true;
        else if (t === "over_under" && ((op.prediction === "over") === (fx.home_goals + fx.away_goals > 2))) ok = true;
        if (ok) { pts += op.markets.points; hits++; }
      });
      setOraclePoints(pts);
      setOracleAcc(total ? hits / total : 0.55);

      const { data: r } = await supabase
        .from("recaps")
        .select("matchday, body")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (r) setRecap(r);
    }
    load();

    const ch = supabase
      .channel("leaderboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // build leaderboard with oracle pinned
  const fullList = [
    { id: "oracle", display_name: "The Oracle", total_points: oraclePoints, current_streak: 0, oracle_wins: 0, oracle_losses: 0, avatar_url: null, isOracle: true },
    ...rows,
  ].sort((a, b) => b.total_points - a.total_points);

  const mood = oracleMood(fullList.findIndex(r => (r as any).isOracle) + 1, fullList.length, oracleAcc);

  return (
    <Layout>
      {showStory && recap && <StoryRecap matchday={recap.matchday} body={recap.body} onClose={() => setShowStory(false)} />}

      <div className="mb-6">
        <div className="chip bg-acid inline-flex mb-2">
          <Sparkles size={12} /> Live
        </div>
        <h1 className="text-5xl mb-1">Leaderboard</h1>
        <p className="text-muted-foreground text-sm">Beat the board. Fade the Oracle.</p>
      </div>

      {recap && (
        <button
          onClick={() => setShowStory(true)}
          className="w-full card-bento p-4 mb-6 flex items-center gap-4 active:scale-[0.98] transition-transform text-left"
          style={{ background: "linear-gradient(135deg, color-mix(in oklab, var(--oracle) 30%, var(--surface)), var(--surface))" }}
        >
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-oracle to-acid flex items-center justify-center shrink-0">
            <BookOpen size={22} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="chip bg-oracle text-white inline-flex mb-1">Story · MD {recap.matchday}</div>
            <div className="font-bold truncate">Matchday {recap.matchday} Recap</div>
            <div className="text-xs text-muted-foreground truncate">Tap to watch</div>
          </div>
        </button>
      )}

      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {fullList.map((r, idx) => {
            const isOracle = (r as any).isOracle;
            const isMe = user && r.id === user.id;
            return (
              <motion.div
                key={r.id}
                layout
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className={`card-bento p-4 flex items-center gap-3 ${
                  isOracle ? "border-oracle/60" : ""
                } ${isMe ? "border-acid/60 anim-glow" : ""}`}
                style={isOracle ? { background: "linear-gradient(135deg, color-mix(in oklab, var(--oracle) 18%, var(--surface)), var(--surface))" } : undefined}
              >
                <div className="w-9 text-center">
                  <div className="text-2xl font-bold tabular-nums">{idx + 1}</div>
                </div>
                {isOracle ? (
                  <OracleAvatar mood={mood} size={44} />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-acid to-oracle flex items-center justify-center font-bold text-lg">
                    {r.display_name?.[0]?.toUpperCase() ?? "?"}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold truncate">{r.display_name}</span>
                    {isOracle && <span className="chip bg-oracle">AI</span>}
                    {isMe && <span className="chip bg-acid">You</span>}
                    {!isOracle && <StreakFlame streak={r.current_streak} />}
                  </div>
                  {!isOracle && (r.oracle_wins + r.oracle_losses > 0) && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {r.oracle_wins}-{r.oracle_losses} vs Oracle
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold tabular-nums text-acid">{r.total_points}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">pts</div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </Layout>
  );
}
