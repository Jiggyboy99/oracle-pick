import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { Layout } from "@/components/Layout";
import { ConsensusBar } from "@/components/ConsensusBar";
import { PredictionReceipt } from "@/components/PredictionReceipt";
import { ShareCard } from "@/components/ShareCard";
import { Confetti } from "@/components/Confetti";
import { PitchLines } from "@/components/PitchLines";
import { ArrowLeft, Check, Download, Lock, Sparkles } from "lucide-react";
import { toast } from "sonner";
import * as htmlToImage from "html-to-image";

export const Route = createFileRoute("/match/$id")({
  component: MatchPage,
});

function useCountdown(iso: string | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!iso) return { d: 0, h: 0, m: 0, s: 0 };
  const diff = Math.max(0, new Date(iso).getTime() - now);
  return {
    d: Math.floor(diff / 86400000),
    h: Math.floor((diff % 86400000) / 3600000),
    m: Math.floor((diff % 3600000) / 60000),
    s: Math.floor((diff % 60000) / 1000),
  };
}

function MatchPage() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [fixture, setFixture] = useState<any>(null);
  const [markets, setMarkets] = useState<any[]>([]);
  const [oraclePicks, setOraclePicks] = useState<Record<string, any>>({});
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [allPredictions, setAllPredictions] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [submitted, setSubmitted] = useState(false);
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  const [thunkKey, setThunkKey] = useState(0);
  const receiptRef = useRef<HTMLDivElement>(null);
  const calledItFiredRef = useRef(false);
  const [customOpen, setCustomOpen] = useState<Record<string, boolean>>({});
  const [customHg, setCustomHg] = useState<Record<string, string>>({});
  const [customAg, setCustomAg] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    async function load() {
      const { data: fx } = await supabase
        .from("fixtures")
        .select(
          "id, matchday, kickoff_at, status, home_goals, away_goals, home:teams!fixtures_home_team_id_fkey(name,code,flag_url), away:teams!fixtures_away_team_id_fkey(name,code,flag_url)",
        )
        .eq("id", id)
        .maybeSingle();
      setFixture(fx);

      const { data: mks } = await supabase.from("markets").select("*").eq("fixture_id", id);
      setMarkets(mks ?? []);

      const { data: ops } = await supabase.from("oracle_picks").select("*").eq("fixture_id", id);
      const om: Record<string, any> = {};
      (ops ?? []).forEach((o) => { om[o.market_id] = o; });
      setOraclePicks(om);

      const { data: all } = await supabase.from("predictions").select("market_id, pick").eq("fixture_id", id);
      setAllPredictions(all ?? []);

      if (user) {
        const { data: mine } = await supabase
          .from("predictions")
          .select("market_id, pick, faded_oracle")
          .eq("fixture_id", id)
          .eq("user_id", user.id);
        const p: Record<string, string> = {};
        (mine ?? []).forEach((row) => { p[row.market_id] = row.pick; });
        setPicks(p);
        if ((mine ?? []).length > 0) setSubmitted(true);

        const { data: prof } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", user.id)
          .maybeSingle();
        setProfile(prof);
      }
    }
    load();
  }, [id, user]);

  const locked = fixture && (new Date(fixture.kickoff_at) < new Date() || fixture.status !== "upcoming");
  const selectedCount = Object.keys(picks).length;

  // "I CALLED IT" — exact score market where the user's pick matches the final score
  const calledScore =
    fixture?.status === "finished" && fixture.home_goals != null && fixture.away_goals != null
      ? `${fixture.home_goals}-${fixture.away_goals}`
      : null;
  const calledIt =
    calledScore != null &&
    markets.some((mk) => mk.type === "exact_score" && picks[mk.id] === calledScore);

  useEffect(() => {
    if (calledIt && !calledItFiredRef.current) {
      calledItFiredRef.current = true;
      setConfettiTrigger((c) => c + 1);
    }
  }, [calledIt]);

  const potential = useMemo(
    () => markets.reduce((sum, m) => (picks[m.id] ? sum + m.points : sum), 0),
    [markets, picks],
  );

  const { d, h, m: mins, s } = useCountdown(fixture?.kickoff_at);

  function selectPick(marketId: string, value: string) {
    if (locked) return;
    setPicks((p) => ({ ...p, [marketId]: value }));
  }

  function applyCustomScore(marketId: string) {
    const hgN = Number(customHg[marketId]);
    const agN = Number(customAg[marketId]);
    if (
      customHg[marketId] === undefined || customAg[marketId] === undefined ||
      customHg[marketId] === "" || customAg[marketId] === "" ||
      isNaN(hgN) || isNaN(agN) || hgN < 0 || agN < 0 || hgN > 15 || agN > 15
    ) {
      toast.error("Enter valid scores (0-15) for both teams");
      return;
    }
    selectPick(marketId, `${hgN}-${agN}`);
    setCustomOpen((o) => ({ ...o, [marketId]: false }));
  }

  async function lockIn() {
    if (!user) return;
    if (selectedCount === 0) { toast.error("Pick at least one market."); return; }
    const rows = markets
      .filter((mk) => picks[mk.id])
      .map((mk) => ({
        user_id: user.id,
        fixture_id: id,
        market_id: mk.id,
        pick: picks[mk.id],
        faded_oracle: oraclePicks[mk.id] ? oraclePicks[mk.id].prediction !== picks[mk.id] : false,
      }));
    const { error } = await supabase.from("predictions").upsert(rows, { onConflict: "user_id,market_id" });
    if (error) { toast.error(error.message); return; }
    setSubmitted(true);
    setThunkKey((k) => k + 1);
    setConfettiTrigger((c) => c + 1);
    toast.success("Locked in.");
    const { data: all } = await supabase.from("predictions").select("market_id, pick").eq("fixture_id", id);
    setAllPredictions(all ?? []);
  }

  async function saveImage() {
    if (!receiptRef.current) return;
    try {
      const dataUrl = await htmlToImage.toPng(receiptRef.current, { cacheBust: true, pixelRatio: 2 });
      const link = document.createElement("a");
      link.download = `oracle-${fixture?.home?.code ?? "home"}-${fixture?.away?.code ?? "away"}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      toast.error("Couldn't save image");
    }
  }

  if (!fixture) {
    return (
      <Layout>
        <div className="text-center text-muted-foreground py-20">Loading…</div>
      </Layout>
    );
  }

  return (
    <Layout fullWidth>
      <Confetti trigger={confettiTrigger} />

      {/* ── top bar ── */}
      <header className="max-w-[1200px] mx-auto px-5 md:px-10 pt-6 pb-4 flex items-center justify-between">
        <button
          onClick={() => navigate({ to: "/matches" })}
          className="flex items-center gap-2 text-white/50 hover:text-white transition text-xs tracking-[0.25em] uppercase"
        >
          <ArrowLeft size={14} /> Matches
        </button>
        <span className="display text-2xl md:text-3xl leading-none">CalledIt</span>
      </header>

      {/* ── 12-col editorial grid ── */}
      <main className="max-w-[1200px] mx-auto px-5 md:px-10 grid grid-cols-12 gap-4 md:gap-6 pb-36">

        {/* ── MATCH HERO ── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 90, damping: 18 }}
          className="col-span-12 relative overflow-hidden rounded-[28px] bg-[#0F0F16] border border-white/10"
        >
          <PitchLines className="absolute inset-0 w-full h-full text-white" opacity={0.07} />
          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/60" />

          <div className="relative p-6 md:p-10">
            {/* meta row */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3 text-[10px] tracking-[0.3em] uppercase text-white/50">
                <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/80">
                  Matchday {fixture.matchday}
                </span>
              </div>
              {locked ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/15 border border-destructive/40 text-destructive text-[10px] tracking-[0.25em] uppercase font-semibold">
                  <Lock size={11} /> Locked
                </span>
              ) : (
                <span className="text-[10px] tracking-[0.3em] uppercase text-white/40 hidden sm:inline">
                  {new Date(fixture.kickoff_at).toLocaleString()}
                </span>
              )}
            </div>

            {/* teams + countdown */}
            <div className="grid grid-cols-7 items-center gap-4">
              <div className="col-span-3 flex flex-col items-start">
                {fixture.home.flag_url && (
                  <img
                    src={fixture.home.flag_url}
                    alt=""
                    className="w-16 h-11 rounded object-cover mb-3 border border-white/10"
                  />
                )}
                <div className="display text-[64px] md:text-[96px] leading-[0.85] text-white">
                  {fixture.home.code}
                </div>
                <div className="text-xs tracking-[0.2em] uppercase text-white/40 mt-2">{fixture.home.name}</div>
              </div>

              <div className="col-span-1 flex flex-col items-center text-center">
                {!locked ? (
                  <>
                    <div className="text-[10px] tracking-[0.3em] uppercase text-white/40 mb-2">Kick-off in</div>
                    <div className="num text-xl md:text-3xl text-acid tabular-nums leading-none">
                      {String(d).padStart(2, "0")}:{String(h).padStart(2, "0")}:{String(mins).padStart(2, "0")}:{String(s).padStart(2, "0")}
                    </div>
                    <div className="text-[9px] tracking-[0.35em] uppercase text-white/30 mt-1">D · H · M · S</div>
                  </>
                ) : (
                  <div className="num text-white/30 text-2xl md:text-3xl">VS</div>
                )}
              </div>

              <div className="col-span-3 flex flex-col items-end">
                {fixture.away.flag_url && (
                  <img
                    src={fixture.away.flag_url}
                    alt=""
                    className="w-16 h-11 rounded object-cover mb-3 border border-white/10"
                  />
                )}
                <div className="display text-[64px] md:text-[96px] leading-[0.85] text-white text-right">
                  {fixture.away.code}
                </div>
                <div className="text-xs tracking-[0.2em] uppercase text-white/40 mt-2 text-right">
                  {fixture.away.name}
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ── section heading ── */}
        <div className="col-span-12 flex items-end justify-between mt-4">
          <div>
            <div className="text-[10px] tracking-[0.3em] uppercase text-white/40">Step 02</div>
            <h2 className="display text-4xl md:text-5xl leading-none mt-1">Make the Call</h2>
          </div>
          <div className="text-right">
            <div className="text-[10px] tracking-[0.3em] uppercase text-white/40">Selected</div>
            <div className="num text-2xl text-white mt-1">
              {selectedCount}<span className="text-white/30">/{markets.length}</span>
            </div>
          </div>
        </div>

        {/* ── markets ── */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-4">
          {markets.map((mk, i) => {
            const opts: { value: string; label: string; sub?: string }[] = mk.options;
            const oraclePick = oraclePicks[mk.id];
            const userPick = picks[mk.id];
            const isFade = !!(oraclePick && userPick && oraclePick.prediction !== userPick);

            // consensus
            const marketPreds = allPredictions.filter((p) => p.market_id === mk.id);
            const counts: Record<string, number> = {};
            opts.forEach((o) => (counts[o.value] = 0));
            marketPreds.forEach((p) => { counts[p.pick] = (counts[p.pick] ?? 0) + 1; });
            const total = Math.max(1, marketPreds.length);
            const consensusOpts = opts.map((o) => ({
              value: o.value,
              label: o.label,
              pct: (counts[o.value] / total) * 100,
            }));
            const userPct = userPick ? ((counts[userPick] ?? 0) / total) * 100 : 0;

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
                    <div className="text-[10px] tracking-[0.3em] uppercase text-white/40">
                      Market {String(i + 1).padStart(2, "0")}
                    </div>
                    <div className="display text-xl md:text-2xl mt-1">{mk.label}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <div className="text-right">
                      <div className="text-[10px] tracking-[0.3em] uppercase text-white/40">Reward</div>
                      <div className="num text-2xl text-acid mt-0.5">+{mk.points}</div>
                    </div>
                    <AnimatePresence>
                      {isFade && (
                        <motion.span
                          initial={{ opacity: 0, scale: 0.85 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.85 }}
                          transition={{ type: "spring", stiffness: 400, damping: 20 }}
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] tracking-[0.2em] uppercase font-bold"
                          style={{
                            background: "rgba(123,97,255,0.15)",
                            border: "1px solid rgba(123,97,255,0.35)",
                            color: "#7B61FF",
                          }}
                        >
                          <Sparkles size={9} /> Fading
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* options + consensus + oracle */}
                <div className="p-5 md:p-6">
                  <div
                    className={`grid gap-2 ${
                      opts.length <= 2
                        ? "grid-cols-2"
                        : opts.length === 3
                          ? "grid-cols-3"
                          : "grid-cols-3 md:grid-cols-6"
                    }`}
                  >
                    {opts.map((o) => {
                      const active = userPick === o.value;
                      const isOracle = oraclePick?.prediction === o.value;
                      const isExactWin =
                        calledScore != null &&
                        mk.type === "exact_score" &&
                        o.value === calledScore &&
                        active;
                      return (
                        <motion.button
                          key={o.value}
                          whileTap={locked ? {} : { scale: 0.93 }}
                          transition={{ type: "spring", stiffness: 400, damping: 18 }}
                          onClick={() => selectPick(mk.id, o.value)}
                          disabled={!!locked}
                          className={[
                            "relative px-3 py-3.5 rounded-2xl border text-left transition-colors",
                            "flex flex-col items-start justify-center min-h-[64px]",
                            isExactWin
                              ? "bg-acid border-acid text-acid-foreground ring-2 ring-acid/60 ring-offset-2 ring-offset-[#0F0F16]"
                              : active
                              ? "bg-acid border-acid text-acid-foreground"
                              : "bg-white/[0.03] border-white/10 hover:border-white/25 hover:bg-white/[0.06] text-white",
                            locked && !active ? "opacity-40" : "",
                          ].join(" ")}
                        >
                          {isExactWin ? (
                            <span className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/30 text-[9px] font-black tracking-wider uppercase">
                              EXACT
                            </span>
                          ) : active ? (
                            <span className="absolute top-2 right-2">
                              <Check size={14} strokeWidth={3} />
                            </span>
                          ) : null}
                          {isOracle && !active && (
                            <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-oracle" />
                          )}
                          <span className={`num text-lg leading-none ${active ? "" : "text-white"}`}>
                            {o.label}
                          </span>
                          {o.sub && (
                            <span
                              className={`text-[10px] tracking-[0.2em] uppercase mt-1 ${
                                active ? "text-acid-foreground/70" : "text-white/40"
                              }`}
                            >
                              {o.sub}
                            </span>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* free-form exact score entry */}
                  {mk.type === "exact_score" && (
                    <div className="mt-2">
                      {!customOpen[mk.id] ? (
                        <button
                          onClick={() => !locked && setCustomOpen((o) => ({ ...o, [mk.id]: true }))}
                          disabled={!!locked}
                          className={[
                            "w-full px-3 py-3 rounded-2xl border text-sm font-semibold tracking-wide uppercase transition-colors",
                            userPick && !opts.some((o) => o.value === userPick)
                              ? userPick === calledScore
                                ? "bg-acid border-acid text-acid-foreground ring-2 ring-acid/60 ring-offset-2 ring-offset-[#0F0F16]"
                                : "bg-acid border-acid text-acid-foreground"
                              : "bg-white/[0.03] border-white/10 hover:border-white/25 hover:bg-white/[0.06] text-white/70",
                            locked && !(userPick && !opts.some((o) => o.value === userPick)) ? "opacity-40" : "",
                          ].join(" ")}
                        >
                          {userPick && !opts.some((o) => o.value === userPick)
                            ? `Custom: ${userPick}`
                            : "+ Custom score"}
                        </button>
                      ) : (
                        <div className="flex items-end gap-2 p-3 rounded-2xl border border-white/10 bg-white/[0.03]">
                          <div className="flex-1">
                            <label className="text-[9px] tracking-[0.25em] uppercase text-white/40 block mb-1">
                              {fixture.home.code}
                            </label>
                            <input
                              type="number" min={0} max={15} placeholder="0"
                              value={customHg[mk.id] ?? ""}
                              onChange={(e) => setCustomHg((s) => ({ ...s, [mk.id]: e.target.value }))}
                              className="w-full px-3 py-2 rounded-xl bg-white/[0.05] border border-white/10 text-center num text-lg text-white focus:outline-none focus:border-acid/50"
                            />
                          </div>
                          <span className="text-white/30 pb-2">–</span>
                          <div className="flex-1">
                            <label className="text-[9px] tracking-[0.25em] uppercase text-white/40 block mb-1">
                              {fixture.away.code}
                            </label>
                            <input
                              type="number" min={0} max={15} placeholder="0"
                              value={customAg[mk.id] ?? ""}
                              onChange={(e) => setCustomAg((s) => ({ ...s, [mk.id]: e.target.value }))}
                              className="w-full px-3 py-2 rounded-xl bg-white/[0.05] border border-white/10 text-center num text-lg text-white focus:outline-none focus:border-acid/50"
                            />
                          </div>
                          <button
                            onClick={() => applyCustomScore(mk.id)}
                            className="px-3 py-2.5 rounded-xl bg-acid text-acid-foreground font-bold text-xs uppercase tracking-wider active:scale-95"
                          >
                            Use
                          </button>
                          <button
                            onClick={() => setCustomOpen((o) => ({ ...o, [mk.id]: false }))}
                            className="px-2 py-2.5 text-white/40 text-xs"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* consensus bar */}
                  {marketPreds.length > 0 && (
                    <div className="mt-5">
                      <ConsensusBar
                        options={consensusOpts}
                        oraclePick={oraclePick?.prediction}
                        userPick={userPick}
                      />
                      {userPick && (
                        <div className="text-xs text-white/40 mt-2">
                          You're with {Math.round(userPct)}% of players
                          {isFade ? ", against the Oracle." : "."}
                        </div>
                      )}
                    </div>
                  )}

                  {/* oracle block */}
                  {oraclePick && (
                    <div
                      className="mt-5 rounded-2xl border border-oracle/30 p-4 md:p-5 flex gap-4 items-start"
                      style={{ background: "color-mix(in oklab, var(--oracle) 10%, #0A0A0F)" }}
                    >
                      <div className="shrink-0 w-12 h-12 rounded-full bg-oracle/20 border border-oracle/40 flex items-center justify-center">
                        <Sparkles size={18} className="text-oracle" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-3">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="text-[10px] tracking-[0.3em] uppercase text-oracle font-bold">
                              Oracle
                            </span>
                            <span className="text-[10px] tracking-[0.2em] uppercase text-white/40">picks</span>
                            <span className="num text-lg text-white">
                              {opts.find((o) => o.value === oraclePick.prediction)?.label ??
                                oraclePick.prediction}
                            </span>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="num text-3xl md:text-4xl text-oracle leading-none tabular-nums">
                              {Math.round(oraclePick.confidence * 100)}
                              <span className="text-base text-oracle/70">%</span>
                            </div>
                          </div>
                        </div>
                        {oraclePick.reasoning && (
                          <p className="text-sm text-white/70 mt-2 leading-snug italic">
                            "{oraclePick.reasoning}"
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* ── side panel (desktop) ── */}
        <aside className="col-span-12 lg:col-span-4 flex flex-col gap-4">
          <div className="rounded-[24px] bg-[#0F0F16] border border-white/10 p-6 sticky top-6">
            <div className="text-[10px] tracking-[0.3em] uppercase text-white/40">Your slip</div>
            <div className="flex items-baseline gap-2 mt-2">
              <div className="num text-6xl text-acid leading-none tabular-nums">+{potential}</div>
              <div className="text-xs tracking-[0.2em] uppercase text-white/40">pts max</div>
            </div>
            <div className="h-px bg-white/10 my-5" />
            <ul className="space-y-2.5 max-h-[320px] overflow-y-auto">
              {markets.map((mk) => {
                const picked = picks[mk.id];
                const opt = picked ? (mk.options as any[]).find((o) => o.value === picked) : null;
                return (
                  <li key={mk.id} className="flex items-center justify-between text-sm">
                    <span className="text-white/50 truncate pr-2">{mk.label}</span>
                    <span
                      className={
                        picked ? "num text-white" : "text-white/20 text-xs tracking-[0.2em] uppercase"
                      }
                    >
                      {picked ? (opt?.label ?? picked) : "—"}
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="h-px bg-white/10 my-5" />
            <div className="flex items-center justify-between text-[10px] tracking-[0.3em] uppercase text-white/40">
              <span>Selected</span>
              <span className="text-white">
                {selectedCount}/{markets.length}
              </span>
            </div>
          </div>
        </aside>

        {/* ── receipt (after lock-in) ── */}
        {submitted && (
          <div className="col-span-12 mt-4">
            <h2 className="display text-3xl mb-3">Your Receipt</h2>
            <PredictionReceipt
              ref={receiptRef}
              displayName={profile?.display_name ?? "Player"}
              home={fixture.home.name}
              away={fixture.away.name}
              homeCode={fixture.home.code}
              awayCode={fixture.away.code}
              potential={potential}
              variant={calledIt ? "called-it" : "default"}
              calledScore={calledScore ?? undefined}
              picks={markets
                .filter((mk) => picks[mk.id])
                .map((mk) => {
                  const opts: any[] = mk.options;
                  const label = opts.find((o) => o.value === picks[mk.id])?.label ?? picks[mk.id];
                  return {
                    market: mk.label,
                    pick: label,
                    faded: !!(oraclePicks[mk.id] && oraclePicks[mk.id].prediction !== picks[mk.id]),
                    correct: calledScore != null && mk.type === "exact_score" && picks[mk.id] === calledScore,
                  };
                })}
            />
            <button
              onClick={saveImage}
              className="mt-4 w-full py-3 rounded-2xl border border-white/10 bg-white/[0.04] font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.97] hover:bg-white/[0.08] transition-colors tracking-[0.15em] uppercase"
            >
              <Download size={16} /> Save image
            </button>
            <ShareCard
              homeCode={fixture.home.code}
              awayCode={fixture.away.code}
              home={fixture.home.name}
              away={fixture.away.name}
              variant={calledIt ? "called-it" : "default"}
              calledScore={calledScore ?? undefined}
              picks={markets
                .filter((mk) => picks[mk.id])
                .map((mk) => {
                  const opts: any[] = mk.options;
                  const label = opts.find((o) => o.value === picks[mk.id])?.label ?? picks[mk.id];
                  return {
                    market: mk.label,
                    pick: label,
                    faded: !!(oraclePicks[mk.id] && oraclePicks[mk.id].prediction !== picks[mk.id]),
                  };
                })}
            />
          </div>
        )}
      </main>

      {/* ── sticky lock bar (only when match is upcoming) ── */}
      {!locked && (
        <div className="fixed bottom-[76px] left-0 right-0 z-30 pointer-events-none">
          <div className="max-w-[1200px] mx-auto px-5 md:px-10">
            <motion.div
              key={thunkKey}
              initial={false}
              animate={thunkKey ? { scale: [1, 0.96, 1] } : {}}
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
                whileTap={submitted || selectedCount === 0 ? {} : { scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
                onClick={submitted ? undefined : lockIn}
                disabled={submitted || selectedCount === 0}
                className={[
                  "relative px-6 md:px-8 py-4 rounded-xl font-bold uppercase tracking-[0.2em] text-sm flex items-center gap-2 transition-colors",
                  submitted
                    ? "bg-white/5 text-white/40 border border-white/10"
                    : selectedCount === 0
                      ? "bg-white/5 text-white/30 border border-white/10"
                      : "bg-acid text-acid-foreground hover:brightness-110",
                ].join(" ")}
              >
                {submitted ? (
                  <>
                    <Lock size={14} /> Locked
                  </>
                ) : (
                  <>Lock it in</>
                )}
              </motion.button>
            </motion.div>
          </div>
        </div>
      )}
    </Layout>
  );
}
