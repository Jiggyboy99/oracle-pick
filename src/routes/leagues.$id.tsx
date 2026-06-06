import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { Layout } from "@/components/Layout";
import { OracleAvatar } from "@/components/OracleAvatar";
import { StreakFlame } from "@/components/StreakFlame";
import { ArrowLeft, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/leagues/$id")({
  component: LeaguePage,
});

function LeaguePage() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [league, setLeague] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [oraclePts, setOraclePts] = useState(0);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    (async () => {
      const { data: lg } = await supabase.from("leagues").select("*").eq("id", id).maybeSingle();
      setLeague(lg);
      const { data: mem } = await supabase
        .from("league_members")
        .select("profiles(id, display_name, total_points, current_streak, oracle_wins, oracle_losses)")
        .eq("league_id", id);
      setMembers((mem ?? []).map((m: any) => m.profiles).filter(Boolean));

      const { data: ops } = await supabase
        .from("oracle_picks")
        .select("prediction, market_id, markets(points, type, fixtures(home_goals, away_goals))");
      let pts = 0;
      (ops ?? []).forEach((op: any) => {
        const fx = op.markets?.fixtures;
        if (fx?.home_goals == null) return;
        const t = op.markets.type;
        const result = fx.home_goals > fx.away_goals ? "home" : fx.home_goals < fx.away_goals ? "away" : "draw";
        if (t === "result" && op.prediction === result) pts += op.markets.points;
        else if (t === "scoreline" && op.prediction === `${fx.home_goals}-${fx.away_goals}`) pts += op.markets.points;
      });
      setOraclePts(pts);
    })();
  }, [id]);

  if (!league) return <Layout><div className="text-center text-muted-foreground py-20">Loading…</div></Layout>;

  const list = [
    { id: "oracle", display_name: "The Oracle", total_points: oraclePts, current_streak: 0, oracle_wins: 0, oracle_losses: 0, isOracle: true } as any,
    ...members,
  ].sort((a, b) => b.total_points - a.total_points);

  return (
    <Layout>
      <button onClick={() => navigate({ to: "/leagues" })} className="flex items-center gap-1 text-sm text-muted-foreground mb-4 active:scale-95">
        <ArrowLeft size={16} /> Leagues
      </button>
      <h1 className="text-4xl mb-1">{league.name}</h1>
      <div
        className="text-sm text-muted-foreground mb-6 font-mono cursor-pointer active:scale-95 inline-block"
        onClick={() => { navigator.clipboard.writeText(league.invite_code); toast.success("Code copied"); }}
      >
        Code: <span className="text-acid">{league.invite_code}</span> · tap to copy
      </div>

      <div className="space-y-2">
        <AnimatePresence>
          {list.map((r, idx) => {
            const isOracle = (r as any).isOracle;
            const isMe = user && r.id === user.id;
            return (
              <motion.div
                key={r.id}
                layout
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className={`card-bento p-4 flex items-center gap-3 ${isOracle ? "border-oracle/60" : ""} ${isMe ? "border-acid/60" : ""}`}
                style={isOracle ? { background: "linear-gradient(135deg, color-mix(in oklab, var(--oracle) 18%, var(--surface)), var(--surface))" } : undefined}
              >
                <div className="w-9 text-center text-2xl font-bold tabular-nums">{idx + 1}</div>
                {isOracle ? (
                  <OracleAvatar mood="confident" size={44} />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-acid to-oracle flex items-center justify-center font-bold">
                    {r.display_name?.[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{r.display_name}</span>
                    {isOracle && <span className="chip bg-oracle"><Sparkles size={10} />AI</span>}
                    {isMe && <span className="chip bg-acid">You</span>}
                    {!isOracle && <StreakFlame streak={r.current_streak} />}
                  </div>
                </div>
                <div className="text-2xl font-bold tabular-nums text-acid">{r.total_points}</div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </Layout>
  );
}
