import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { Layout } from "@/components/Layout";
import { OracleAvatar } from "@/components/OracleAvatar";
import { ConsensusBar } from "@/components/ConsensusBar";
import { PredictionReceipt } from "@/components/PredictionReceipt";
import { Confetti } from "@/components/Confetti";
import { oracleMood, oracleLine } from "@/lib/oracle";
import { Lock, Sparkles, Download, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import * as htmlToImage from "html-to-image";

export const Route = createFileRoute("/match/$id")({
  component: MatchPage,
});

function MatchPage() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [fixture, setFixture] = useState<any>(null);
  const [markets, setMarkets] = useState<any[]>([]);
  const [oraclePicks, setOraclePicks] = useState<Record<string, any>>({});
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [faded, setFaded] = useState<Record<string, boolean>>({});
  const [allPredictions, setAllPredictions] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [submitted, setSubmitted] = useState(false);
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  const [thunkKey, setThunkKey] = useState(0);
  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    async function load() {
      const { data: fx } = await supabase
        .from("fixtures")
        .select("id, matchday, kickoff_at, status, home_goals, away_goals, home:teams!fixtures_home_team_id_fkey(name,code,flag_url), away:teams!fixtures_away_team_id_fkey(name,code,flag_url)")
        .eq("id", id)
        .maybeSingle();
      setFixture(fx);

      const { data: mks } = await supabase.from("markets").select("*").eq("fixture_id", id);
      setMarkets(mks ?? []);

      const { data: ops } = await supabase.from("oracle_picks").select("*").eq("fixture_id", id);
      const m: Record<string, any> = {};
      (ops ?? []).forEach((o) => { m[o.market_id] = o; });
      setOraclePicks(m);

      const { data: all } = await supabase.from("predictions").select("market_id, pick").eq("fixture_id", id);
      setAllPredictions(all ?? []);

      if (user) {
        const { data: mine } = await supabase.from("predictions").select("market_id, pick, faded_oracle").eq("fixture_id", id).eq("user_id", user.id);
        const p: Record<string, string> = {};
        const f: Record<string, boolean> = {};
        (mine ?? []).forEach((m) => { p[m.market_id] = m.pick; f[m.market_id] = m.faded_oracle; });
        setPicks(p);
        setFaded(f);
        if ((mine ?? []).length > 0) setSubmitted(true);

        const { data: prof } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
        setProfile(prof);
      }
    }
    load();
  }, [id, user]);

  const locked = fixture && (new Date(fixture.kickoff_at) < new Date() || fixture.status !== "upcoming");

  const potential = useMemo(() => {
    return markets.reduce((sum, m) => (picks[m.id] ? sum + m.points : sum), 0);
  }, [markets, picks]);

  function selectPick(marketId: string, value: string) {
    if (locked) return;
    setPicks((p) => ({ ...p, [marketId]: value }));
  }

  async function lockIn() {
    if (!user) return;
    if (Object.keys(picks).length === 0) { toast.error("Pick at least one market."); return; }
    const rows = markets
      .filter((m) => picks[m.id])
      .map((m) => {
        const oraclePick = oraclePicks[m.id]?.prediction;
        const isFade = faded[m.id] === true || (oraclePick && oraclePick !== picks[m.id] && faded[m.id] !== false);
        return {
          user_id: user.id,
          fixture_id: id,
          market_id: m.id,
          pick: picks[m.id],
          faded_oracle: oraclePick ? oraclePick !== picks[m.id] : false,
        };
      });
    const { error } = await supabase.from("predictions").upsert(rows, { onConflict: "user_id,market_id" });
    if (error) { toast.error(error.message); return; }
    setSubmitted(true);
    setThunkKey((k) => k + 1);
    setConfettiTrigger((c) => c + 1);
    toast.success("Locked in.");
    // refresh consensus
    const { data: all } = await supabase.from("predictions").select("market_id, pick").eq("fixture_id", id);
    setAllPredictions(all ?? []);
  }

  async function saveImage() {
    if (!receiptRef.current) return;
    try {
      const dataUrl = await htmlToImage.toPng(receiptRef.current, { cacheBust: true, pixelRatio: 2 });
      const link = document.createElement("a");
      link.download = `predictor-${fixture.home.code}-${fixture.away.code}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      toast.error("Couldn't save image");
    }
  }

  if (!fixture) return <Layout><div className="text-center text-muted-foreground py-20">Loading…</div></Layout>;

  const accuracy = 0.55;
  const mood = oracleMood(2, 10, accuracy);

  return (
    <Layout>
      <Confetti trigger={confettiTrigger} />

      <button onClick={() => navigate({ to: "/matches" })} className="flex items-center gap-1 text-sm text-muted-foreground mb-4 active:scale-95">
        <ArrowLeft size={16} /> Matches
      </button>

      <div className="card-bento p-6 mb-5 text-center">
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Matchday {fixture.matchday}</div>
        <div className="flex items-center justify-around">
          <div>
            {fixture.home.flag_url && <img src={fixture.home.flag_url} className="w-16 h-12 mx-auto mb-2 rounded object-cover" alt="" />}
            <div className="text-3xl font-bold">{fixture.home.code}</div>
            <div className="text-xs text-muted-foreground">{fixture.home.name}</div>
          </div>
          <div className="text-2xl text-muted-foreground">vs</div>
          <div>
            {fixture.away.flag_url && <img src={fixture.away.flag_url} className="w-16 h-12 mx-auto mb-2 rounded object-cover" alt="" />}
            <div className="text-3xl font-bold">{fixture.away.code}</div>
            <div className="text-xs text-muted-foreground">{fixture.away.name}</div>
          </div>
        </div>
        {locked ? (
          <div className="chip bg-destructive text-destructive-foreground mt-4 inline-flex">
            <Lock size={12} /> Locked
          </div>
        ) : (
          <div className="text-xs text-muted-foreground mt-3">
            Lock in before {new Date(fixture.kickoff_at).toLocaleString()}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {markets.map((m) => {
          const opts: { value: string; label: string }[] = m.options;
          const oraclePick = oraclePicks[m.id];
          const userPick = picks[m.id];
          const isFade = oraclePick && userPick && oraclePick.prediction !== userPick;

          // consensus
          const marketPreds = allPredictions.filter((p) => p.market_id === m.id);
          const counts: Record<string, number> = {};
          opts.forEach((o) => (counts[o.value] = 0));
          marketPreds.forEach((p) => { counts[p.pick] = (counts[p.pick] ?? 0) + 1; });
          const total = Math.max(1, marketPreds.length);
          const consensusOpts = opts.map((o) => ({ value: o.value, label: o.label, pct: (counts[o.value] / total) * 100 }));
          const userPct = userPick ? (counts[userPick] / total) * 100 : 0;

          return (
            <div key={m.id} className="card-bento p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">{m.label}</div>
                  <div className="text-acid font-bold text-sm">+{m.points} pts</div>
                </div>
                {isFade && (
                  <span className="chip bg-oracle">
                    <Sparkles size={10} /> Fading
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4">
                {opts.map((o) => {
                  const active = userPick === o.value;
                  return (
                    <motion.button
                      key={o.value}
                      whileTap={{ scale: 0.92 }}
                      onClick={() => selectPick(m.id, o.value)}
                      disabled={locked}
                      className={`p-3 rounded-xl font-semibold text-sm border transition-all ${
                        active
                          ? "bg-acid text-acid-foreground border-acid"
                          : "bg-secondary border-border hover:border-acid/40"
                      } ${locked ? "opacity-50" : ""}`}
                    >
                      {o.label}
                    </motion.button>
                  );
                })}
              </div>

              {oraclePick && (
                <div
                  className="rounded-xl p-3 mb-3 flex gap-3 items-start"
                  style={{ background: "color-mix(in oklab, var(--oracle) 12%, var(--surface-2))" }}
                >
                  <OracleAvatar mood={mood} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs">
                      <span className="text-oracle font-bold">Oracle:</span>{" "}
                      <span className="font-semibold">
                        {opts.find((o) => o.value === oraclePick.prediction)?.label ?? oraclePick.prediction}
                      </span>{" "}
                      <span className="text-muted-foreground">· {Math.round(oraclePick.confidence * 100)}%</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{oracleLine(mood, oraclePick.confidence, opts.find(o => o.value === oraclePick.prediction)?.label ?? oraclePick.prediction)}</div>
                    {oraclePick.reasoning && <div className="text-xs text-muted-foreground/80 mt-1 italic">"{oraclePick.reasoning}"</div>}
                  </div>
                </div>
              )}

              {marketPreds.length > 0 && (
                <div className="mb-2">
                  <ConsensusBar options={consensusOpts} oraclePick={oraclePick?.prediction} userPick={userPick} />
                  {userPick && (
                    <div className="text-xs text-muted-foreground mt-2">
                      You're with {Math.round(userPct)}% of players{isFade ? ", against the Oracle." : "."}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!locked && (
        <motion.div
          key={thunkKey}
          animate={thunkKey ? { scale: [1, 0.95, 1] } : {}}
          transition={{ duration: 0.35 }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30 w-[calc(100%-2rem)] max-w-md"
        >
          <button
            onClick={lockIn}
            disabled={Object.keys(picks).length === 0}
            className="w-full py-4 rounded-2xl bg-acid text-acid-foreground font-bold text-lg flex items-center justify-between px-6 shadow-2xl shadow-acid/30 active:scale-[0.97] transition-transform disabled:opacity-40"
          >
            <span>Lock it in</span>
            <span className="tabular-nums">+{potential}</span>
          </button>
        </motion.div>
      )}

      {submitted && (
        <div className="mt-8">
          <h2 className="text-2xl mb-3">Your Receipt</h2>
          <PredictionReceipt
            ref={receiptRef}
            displayName={profile?.display_name ?? "Player"}
            home={fixture.home.name}
            away={fixture.away.name}
            homeCode={fixture.home.code}
            awayCode={fixture.away.code}
            potential={potential}
            picks={markets
              .filter((m) => picks[m.id])
              .map((m) => {
                const opts: any[] = m.options;
                const label = opts.find((o) => o.value === picks[m.id])?.label ?? picks[m.id];
                return {
                  market: m.label,
                  pick: label,
                  faded: oraclePicks[m.id] && oraclePicks[m.id].prediction !== picks[m.id],
                };
              })}
          />
          <button
            onClick={saveImage}
            className="mt-4 w-full py-3 rounded-xl bg-secondary border border-border font-semibold flex items-center justify-center gap-2 active:scale-[0.97]"
          >
            <Download size={16} /> Save image
          </button>
        </div>
      )}
    </Layout>
  );
}
