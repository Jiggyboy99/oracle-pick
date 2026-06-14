import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, LayoutGroup } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { Layout } from "@/components/Layout";
import { PageTransition } from "@/components/motion/PageTransition";
import { BoardRow } from "@/components/motion/BoardRow";
import type { BoardRowData } from "@/components/motion/BoardRow";
import { toast } from "sonner";
import { ArrowLeft, Copy, Lock, Settings } from "lucide-react";

export const Route = createFileRoute("/leagues/$id")({
  head: () => ({ meta: [{ title: "League — The Eye" }] }),
  component: LeaguePage,
});

function LeaguePage() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [league, setLeague] = useState<any>(null);
  const [board, setBoard] = useState<BoardRowData[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [joinType, setJoinType] = useState<"code" | "approval">("code");
  const [showPastResults, setShowPastResults] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    (async () => {
      const { data: lg } = await supabase.from("leagues").select("*").eq("id", id).maybeSingle();
      if (!lg) return;
      setLeague(lg);
      setJoinType(lg.join_type ?? "code");
      setShowPastResults(lg.show_past_results ?? true);

      const { data: mem } = await supabase
        .from("league_members")
        .select("profiles(id, display_name, total_points, current_streak, rank_prev)")
        .eq("league_id", id);
      const profiles = (mem ?? []).map((m: any) => m.profiles).filter(Boolean);

      // Sort by points to get current league rank, then compute league-scoped delta
      const sorted = [...profiles].sort((a: any, b: any) => b.total_points - a.total_points);

      // Oracle row — compute from oracle_picks matching finished fixtures
      const { data: ops } = await supabase
        .from("oracle_picks")
        .select("prediction, market_id, markets(points, type, fixtures(home_goals, away_goals))");
      let oraclePts = 0;
      (ops ?? []).forEach((op: any) => {
        const fx = op.markets?.fixtures;
        if (fx?.home_goals == null) return;
        const t = op.markets.type;
        const result = fx.home_goals > fx.away_goals ? "home" : fx.home_goals < fx.away_goals ? "away" : "draw";
        if (t === "result" && op.prediction === result) oraclePts += op.markets.points;
        else if ((t === "scoreline" || t === "exact_score") && op.prediction === `${fx.home_goals}-${fx.away_goals}`) oraclePts += op.markets.points;
      });

      const oracle: BoardRowData = {
        id: "oracle",
        name: "The Oracle",
        country: null,
        delta: 0,
        streak: 0,
        points: oraclePts,
        isOracle: true,
      };

      const rows: BoardRowData[] = sorted.map((p: any) => ({
        id: p.id,
        name: p.display_name,
        country: null,
        delta: 0,
        streak: p.current_streak,
        points: p.total_points,
        isMe: user?.id === p.id,
      }));

      // Insert oracle at the right rank position
      const withOracle = [...rows, oracle].sort((a, b) => b.points - a.points);
      setBoard(withOracle);
    })();
  }, [id, user]);

  async function saveSettings() {
    if (!league) return;
    setSavingSettings(true);
    const { error } = await supabase
      .from("leagues")
      .update({ join_type: joinType, show_past_results: showPastResults })
      .eq("id", league.id);
    setSavingSettings(false);
    if (error) { toast.error(error.message); return; }
    setLeague({ ...league, join_type: joinType, show_past_results: showPastResults });
    toast.success("Settings saved");
    setShowSettings(false);
  }

  async function leaveLeague() {
    if (!user || !league) return;
    if (league.creator_id === user.id) { toast.error("Transfer ownership before leaving"); return; }
    const { error } = await supabase.from("league_members").delete().eq("league_id", league.id).eq("user_id", user.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Left the league");
    navigate({ to: "/leagues" });
  }

  if (!league) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 rounded-full border-2 border-acid border-t-transparent animate-spin" />
        </div>
      </Layout>
    );
  }

  const isCreator = user?.id === league.creator_id;

  return (
    <Layout>
      <PageTransition>
        {/* Back nav */}
        <button
          onClick={() => navigate({ to: "/leagues" })}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition text-xs tracking-[0.2em] uppercase mb-6 active:scale-95"
        >
          <ArrowLeft size={14} /> Leagues
        </button>

        {/* Hero header */}
        <div className="mb-8">
          <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] mb-1">Private League</p>
          <h1 className="display text-5xl leading-none break-words">{league.name}</h1>
          <button
            onClick={() => { navigator.clipboard.writeText(league.invite_code); toast.success("Code copied"); }}
            className="mt-2 inline-flex items-center gap-2 text-sm font-mono text-acid hover:text-acid/80 active:scale-95 transition"
          >
            <Copy size={13} />
            {league.invite_code}
            {league.join_type === "approval" && (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground ml-1">
                <Lock size={9} /> Approval only
              </span>
            )}
          </button>
        </div>

        {/* THE BOARD */}
        <div className="mb-6">
          <div className="flex items-end justify-between mb-4 px-1">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em]">Standings</p>
              <h2 className="display text-4xl leading-none mt-0.5">The Board</h2>
            </div>
            <span className="num text-2xl text-muted-foreground">{board.length}</span>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-[#0F0F16] overflow-hidden">
            <div className="grid grid-cols-[40px_1fr_70px_90px] md:grid-cols-[56px_1fr_90px_110px] px-5 md:px-6 py-3 text-[10px] tracking-[0.25em] text-white/35 uppercase border-b border-white/5">
              <span>#</span>
              <span>Player</span>
              <span className="text-right">Form</span>
              <span className="text-right">Points</span>
            </div>
            <LayoutGroup id={`league-board-${id}`}>
              <ul>
                {board.length === 0 ? (
                  <li className="px-5 py-8 text-center text-white/30 text-sm tracking-[0.25em] uppercase">
                    No members yet
                  </li>
                ) : (
                  board.map((row, idx) => (
                    <BoardRow key={row.id} id={row.id} rank={idx + 1} data={row} index={idx} />
                  ))
                )}
              </ul>
            </LayoutGroup>
          </div>
        </div>

        {/* Past results notice */}
        {!league.show_past_results && (
          <div className="card-bento p-3 mb-4 flex items-center gap-2 text-xs text-muted-foreground border-border/50">
            <Lock size={12} /> Past match results are hidden in this league
          </div>
        )}

        {/* Creator settings */}
        {isCreator && (
          <motion.div
            initial={false}
            className="card-bento overflow-hidden"
          >
            <button
              onClick={() => setShowSettings((v) => !v)}
              className="w-full px-5 py-4 flex items-center justify-between border-b border-border"
            >
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Settings size={14} className="text-muted-foreground" /> League Settings
              </div>
              <span className="text-muted-foreground text-xs">{showSettings ? "▲" : "▼"}</span>
            </button>

            {showSettings && (
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2 block">Who can join?</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["code", "approval"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setJoinType(t)}
                        className={`py-2 px-3 rounded-xl border text-sm font-semibold flex items-center gap-2 transition-all active:scale-95 ${
                          joinType === t ? "bg-acid border-acid text-acid-foreground" : "bg-secondary border-border"
                        }`}
                      >
                        {t === "approval" && <Lock size={11} />}
                        {t === "code" ? "Anyone with code" : "Creator approval"}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => setShowPastResults((v) => !v)}
                  className="w-full flex items-center justify-between py-2.5 px-3 rounded-xl border border-border bg-secondary text-sm"
                >
                  <span>Show past results to members</span>
                  <span className={`w-9 h-5 rounded-full transition-colors ${showPastResults ? "bg-acid" : "bg-border"} relative flex-shrink-0`}>
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${showPastResults ? "translate-x-4" : "translate-x-0.5"}`} />
                  </span>
                </button>

                <button
                  onClick={saveSettings}
                  disabled={savingSettings}
                  className="w-full py-2.5 rounded-xl bg-acid text-acid-foreground font-bold text-sm active:scale-95 disabled:opacity-50"
                >
                  {savingSettings ? "Saving…" : "Save Settings"}
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* Leave button (non-creators) */}
        {!isCreator && (
          <button
            onClick={leaveLeague}
            className="mt-4 w-full py-3 rounded-xl border border-destructive/40 text-destructive text-sm font-semibold active:scale-[0.97] hover:bg-destructive/10 transition-colors"
          >
            Leave League
          </button>
        )}
      </PageTransition>
    </Layout>
  );
}
