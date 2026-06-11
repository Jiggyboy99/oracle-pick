import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdmin } from "@/lib/useAuth";
import { Layout } from "@/components/Layout";
import { PageTransition } from "@/components/motion/PageTransition";
import { StaggerGroup, StaggerItem } from "@/components/motion/Stagger";
import { finalizeFixture } from "@/lib/admin.functions";
import { toast } from "sonner";
import { CheckCircle, Clock, Lock, Zap } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Command — The Eye" }] }),
  component: AdminPage,
});

// ────────────────────────────────────────────────
// Domain types
// ────────────────────────────────────────────────
type Team = { id: string; name: string; code: string };
type Fixture = {
  id: string;
  matchday: number;
  status: string;
  kickoff_at: string;
  home_goals: number | null;
  away_goals: number | null;
  home: { code: string; name: string } | null;
  away: { code: string; name: string } | null;
};
type Market = {
  id: string;
  fixture_id: string;
  type: string;
  label: string;
  points: number;
  options: Array<{ label: string; value: string }>;
};
type OraclePick = { market_id: string; prediction: string; confidence: number; reasoning: string | null };

// ────────────────────────────────────────────────
// Shared style tokens
// ────────────────────────────────────────────────
const inp =
  "w-full px-3 py-2 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:ring-1 focus:ring-acid/50 placeholder:text-muted-foreground";
const sel = "w-full px-3 py-2 rounded-xl bg-secondary border border-border text-sm cursor-pointer";
const btnAcid =
  "w-full py-2.5 rounded-xl bg-acid text-acid-foreground font-bold text-sm hover:brightness-110 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100";
const btnOracle =
  "w-full py-2.5 rounded-xl bg-oracle text-white font-bold text-sm hover:brightness-110 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed";
const btnGhost =
  "px-3 py-1.5 rounded-lg border border-border text-xs font-semibold hover:bg-secondary active:scale-95 transition-all";
const btnDanger =
  "px-3 py-1.5 rounded-lg border border-destructive text-destructive text-xs font-semibold hover:bg-destructive/10 active:scale-95 transition-all";

// ────────────────────────────────────────────────
// Market presets + scoring helpers
// ────────────────────────────────────────────────
const PRESETS: Record<string, { label: string; points: number; options: Array<{ label: string; value: string }> }> = {
  result: {
    label: "Match Result",
    points: 10,
    options: [
      { label: "Home Win", value: "home" },
      { label: "Draw", value: "draw" },
      { label: "Away Win", value: "away" },
    ],
  },
  btts: {
    label: "Both Teams to Score",
    points: 8,
    options: [
      { label: "Yes", value: "yes" },
      { label: "No", value: "no" },
    ],
  },
  over_under: {
    label: "Total Goals Over/Under 2.5",
    points: 8,
    options: [
      { label: "Over 2.5", value: "over" },
      { label: "Under 2.5", value: "under" },
    ],
  },
  exact_score: {
    label: "Exact Score",
    points: 25,
    options: [],
  },
};

const DEFAULT_SCORES =
  "0-0\n1-0\n0-1\n1-1\n2-0\n0-2\n2-1\n1-2\n2-2\n3-0\n0-3\n3-1\n1-3\n3-2\n2-3\n4-0\n0-4";

function autoCorrect(type: string, hg: number, ag: number): string | null {
  if (type === "result") return hg > ag ? "home" : hg < ag ? "away" : "draw";
  if (type === "btts") return hg > 0 && ag > 0 ? "yes" : "no";
  if (type === "over_under") return hg + ag > 2 ? "over" : "under";
  if (type === "exact_score" || type === "scoreline") return `${hg}-${ag}`;
  return null;
}

// ────────────────────────────────────────────────
// Status badge
// ────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cls = status === "upcoming" ? "text-acid" : status === "locked" ? "text-oracle" : "text-muted-foreground";
  const Icon = status === "upcoming" ? Clock : status === "locked" ? Lock : CheckCircle;
  return (
    <span className={`chip text-xs font-bold uppercase tracking-wider ${cls}`}>
      <Icon size={10} />
      {status}
    </span>
  );
}

// ────────────────────────────────────────────────
// Custom tab bar
// ────────────────────────────────────────────────
const TABS = ["fixtures", "markets", "oracle", "results", "recaps"] as const;
type Tab = typeof TABS[number];

function TabBar({ active, set }: { active: Tab; set: (t: Tab) => void }) {
  return (
    <div className="flex gap-1 p-1 bg-surface border border-border rounded-xl mb-5 overflow-x-auto">
      {TABS.map(t => (
        <button
          key={t}
          onClick={() => set(t)}
          className={`flex-1 py-2 px-1 rounded-lg text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all active:scale-95 ${
            active === t
              ? "bg-acid text-acid-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────
// Root page
// ────────────────────────────────────────────────
function AdminPage() {
  const { user, loading } = useAuth();
  const isAdmin = useIsAdmin(user?.id);
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("fixtures");

  const [teams, setTeams] = useState<Team[]>([]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  const reload = useCallback(async () => {
    const [{ data: ts }, { data: fxs }, { data: mks }] = await Promise.all([
      supabase.from("teams").select("id,name,code").order("name"),
      supabase
        .from("fixtures")
        .select(
          "id,matchday,status,kickoff_at,home_goals,away_goals," +
          "home:teams!fixtures_home_team_id_fkey(code,name)," +
          "away:teams!fixtures_away_team_id_fkey(code,name)"
        )
        .order("kickoff_at"),
      supabase.from("markets").select("id,fixture_id,type,label,points,options"),
    ]);
    setTeams((ts ?? []) as Team[]);
    setFixtures((fxs ?? []) as unknown as Fixture[]);
    setMarkets(
      (mks ?? []).map(m => ({ ...m, options: (m.options as unknown as Market["options"]) ?? [] })) as Market[]
    );
  }, []);

  useEffect(() => {
    if (isAdmin) reload();
  }, [isAdmin, reload]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 rounded-full border-2 border-acid border-t-transparent animate-spin" />
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return (
      <Layout>
        <div className="card-bento p-8 text-center space-y-4 mt-8">
          <div className="text-5xl">🛡️</div>
          <h1 className="display text-3xl text-acid">Access Denied</h1>
          <p className="text-muted-foreground text-sm">
            Add a row to <code className="text-acid/80">user_roles</code> with your user_id and role{" "}
            <code className="text-acid/80">admin</code>.
          </p>
          <p className="text-xs text-muted-foreground break-all font-mono text-acid/60">{user?.id}</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageTransition>
        <div className="mb-6">
          <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] mb-1">The Eye</p>
          <h1 className="display text-5xl text-acid leading-none">COMMAND</h1>
          <p className="text-muted-foreground text-xs mt-1.5">
            {fixtures.length} fixtures · {markets.length} markets · {teams.length} teams
          </p>
        </div>

        <TabBar active={tab} set={setTab} />

        {tab === "fixtures" && <FixturesTab fixtures={fixtures} teams={teams} onDone={reload} />}
        {tab === "markets" && <MarketsTab fixtures={fixtures} markets={markets} onDone={reload} />}
        {tab === "oracle" && <OracleTab fixtures={fixtures} markets={markets} />}
        {tab === "results" && <ResultsTab fixtures={fixtures} markets={markets} onDone={reload} />}
        {tab === "recaps" && <RecapsTab />}
      </PageTransition>
    </Layout>
  );
}

// ════════════════════════════════════════════════
// FIXTURES tab
// ════════════════════════════════════════════════
function FixturesTab({ fixtures, teams, onDone }: { fixtures: Fixture[]; teams: Team[]; onDone: () => void }) {
  return (
    <StaggerGroup>
      <StaggerItem index={0}>
        <AddFixtureForm teams={teams} onDone={onDone} />
      </StaggerItem>
      <StaggerItem index={1} className="mt-4">
        <FixtureList fixtures={fixtures} onDone={onDone} />
      </StaggerItem>
    </StaggerGroup>
  );
}

function AddFixtureForm({ teams, onDone }: { teams: Team[]; onDone: () => void }) {
  const [homeId, setHomeId] = useState("");
  const [awayId, setAwayId] = useState("");
  const [matchday, setMatchday] = useState("1");
  const [kickoff, setKickoff] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!homeId || !awayId || !kickoff) return toast.error("Fill all fields");
    if (homeId === awayId) return toast.error("Home and away must differ");
    setBusy(true);
    const { error } = await supabase.from("fixtures").insert({
      home_team_id: homeId,
      away_team_id: awayId,
      matchday: Number(matchday),
      kickoff_at: new Date(kickoff).toISOString(),
      status: "upcoming",
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Fixture created");
    setHomeId(""); setAwayId(""); setKickoff("");
    onDone();
  }

  return (
    <div className="card-bento p-5 space-y-4">
      <h2 className="display text-2xl text-acid">Add Fixture</h2>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5 block">Home</label>
          <select value={homeId} onChange={e => setHomeId(e.target.value)} className={sel}>
            <option value="">Select…</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.code} — {t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5 block">Away</label>
          <select value={awayId} onChange={e => setAwayId(e.target.value)} className={sel}>
            <option value="">Select…</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.code} — {t.name}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5 block">Matchday</label>
          <input type="number" min={1} value={matchday} onChange={e => setMatchday(e.target.value)} className={inp} />
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5 block">Kickoff</label>
          <input type="datetime-local" value={kickoff} onChange={e => setKickoff(e.target.value)} className={inp} />
        </div>
      </div>
      <button onClick={submit} disabled={busy} className={btnAcid}>
        {busy ? "Creating…" : "+ Create Fixture"}
      </button>
    </div>
  );
}

function FixtureList({ fixtures, onDone }: { fixtures: Fixture[]; onDone: () => void }) {
  async function setStatus(id: string, status: "upcoming" | "locked" | "finished") {
    const { error } = await supabase.from("fixtures").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(status === "locked" ? "Locked for predictions" : "Reopened"); onDone(); }
  }

  return (
    <div className="card-bento overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h2 className="display text-2xl text-acid">All Fixtures</h2>
      </div>
      {fixtures.length === 0 && (
        <p className="px-5 py-6 text-muted-foreground text-sm text-center">No fixtures yet — create one above.</p>
      )}
      <div className="divide-y divide-border">
        {fixtures.map(f => (
          <div key={f.id} className="px-5 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-semibold text-sm">
                MD{f.matchday} · {f.home?.code ?? "?"} vs {f.away?.code ?? "?"}
              </div>
              <div className="text-xs text-muted-foreground">
                {new Date(f.kickoff_at).toLocaleString(undefined, {
                  month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                })}
                {f.status === "finished" && f.home_goals != null &&
                  ` · ${f.home_goals}–${f.away_goals}`}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <StatusBadge status={f.status} />
              {f.status === "upcoming" && (
                <button onClick={() => setStatus(f.id, "locked")} className={btnGhost}>Lock</button>
              )}
              {f.status === "locked" && (
                <button onClick={() => setStatus(f.id, "upcoming")} className={btnGhost}>Unlock</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
// MARKETS tab
// ════════════════════════════════════════════════
function MarketsTab({ fixtures, markets, onDone }: { fixtures: Fixture[]; markets: Market[]; onDone: () => void }) {
  const [fid, setFid] = useState("");
  const fixtureMarkets = markets.filter(m => m.fixture_id === fid);

  return (
    <StaggerGroup>
      <StaggerItem index={0}>
        <div className="card-bento p-5 space-y-3">
          <h2 className="display text-2xl text-acid">Markets</h2>
          <div>
            <label className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5 block">Fixture</label>
            <select value={fid} onChange={e => setFid(e.target.value)} className={sel}>
              <option value="">Select fixture…</option>
              {fixtures.map(f => (
                <option key={f.id} value={f.id}>
                  MD{f.matchday} · {f.home?.code} vs {f.away?.code} ({f.status})
                </option>
              ))}
            </select>
          </div>
        </div>
      </StaggerItem>

      {fid && (
        <>
          <StaggerItem index={1} className="mt-4">
            <AddMarketForm fixtureId={fid} onDone={onDone} />
          </StaggerItem>
          <StaggerItem index={2} className="mt-4">
            <MarketList markets={fixtureMarkets} onDone={onDone} />
          </StaggerItem>
        </>
      )}
    </StaggerGroup>
  );
}

function AddMarketForm({ fixtureId, onDone }: { fixtureId: string; onDone: () => void }) {
  const [type, setType] = useState("result");
  const [label, setLabel] = useState(PRESETS.result.label);
  const [points, setPoints] = useState(String(PRESETS.result.points));
  const [scoreLines, setScoreLines] = useState(DEFAULT_SCORES);
  const [customJSON, setCustomJSON] = useState('[{"label":"Yes","value":"yes"},{"label":"No","value":"no"}]');
  const [busy, setBusy] = useState(false);

  function onTypeChange(t: string) {
    setType(t);
    const p = PRESETS[t];
    if (p) { setLabel(p.label); setPoints(String(p.points)); }
  }

  function buildOptions(): Array<{ label: string; value: string }> | null {
    if (type === "exact_score" || type === "scoreline") {
      return scoreLines.split("\n").map(s => s.trim()).filter(Boolean).map(s => ({ label: s, value: s }));
    }
    if (PRESETS[type]) return PRESETS[type].options;
    try { return JSON.parse(customJSON); } catch { return null; }
  }

  async function submit() {
    const options = buildOptions();
    if (!options) return toast.error("Invalid options JSON");
    if (options.length === 0) return toast.error("At least one option required");
    setBusy(true);
    const { error } = await supabase.from("markets").insert({
      fixture_id: fixtureId, type, label, points: Number(points), options,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Market created");
    onDone();
  }

  const preset = PRESETS[type];

  return (
    <div className="card-bento p-5 space-y-4">
      <h2 className="display text-2xl text-acid">Add Market</h2>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5 block">Type</label>
          <select value={type} onChange={e => onTypeChange(e.target.value)} className={sel}>
            <option value="result">Result</option>
            <option value="btts">Both Teams Score</option>
            <option value="over_under">Over/Under 2.5</option>
            <option value="exact_score">Exact Score</option>
            <option value="scoreline">Scoreline</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5 block">Points</label>
          <input type="number" min={1} value={points} onChange={e => setPoints(e.target.value)} className={inp} />
        </div>
      </div>
      <div>
        <label className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5 block">Label</label>
        <input value={label} onChange={e => setLabel(e.target.value)} className={inp} />
      </div>
      {(type === "exact_score" || type === "scoreline") && (
        <div>
          <label className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5 block">
            Score options (one per line)
          </label>
          <textarea value={scoreLines} onChange={e => setScoreLines(e.target.value)} className={inp} rows={7} />
        </div>
      )}
      {type === "custom" && (
        <div>
          <label className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5 block">
            Options (JSON array)
          </label>
          <textarea value={customJSON} onChange={e => setCustomJSON(e.target.value)} className={`${inp} font-mono text-xs`} rows={4} />
        </div>
      )}
      {preset && type !== "exact_score" && type !== "scoreline" && (
        <p className="text-xs text-muted-foreground">
          Options: {preset.options.map(o => o.label).join(" · ")}
        </p>
      )}
      <button onClick={submit} disabled={busy} className={btnAcid}>
        {busy ? "Creating…" : "+ Add Market"}
      </button>
    </div>
  );
}

function MarketList({ markets, onDone }: { markets: Market[]; onDone: () => void }) {
  async function del(id: string) {
    const { error } = await supabase.from("markets").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Market deleted"); onDone(); }
  }
  return (
    <div className="card-bento overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h2 className="display text-2xl text-acid">Existing Markets</h2>
      </div>
      {markets.length === 0 && (
        <p className="px-5 py-6 text-muted-foreground text-sm text-center">No markets yet for this fixture.</p>
      )}
      <div className="divide-y divide-border">
        {markets.map(m => (
          <div key={m.id} className="px-5 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-semibold text-sm">{m.label}</div>
              <div className="text-xs text-muted-foreground">
                {m.type} · {m.points} pts · {m.options.length} options
              </div>
            </div>
            <button onClick={() => del(m.id)} className={btnDanger}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
// ORACLE tab
// ════════════════════════════════════════════════
function OracleTab({ fixtures, markets }: { fixtures: Fixture[]; markets: Market[] }) {
  const [fid, setFid] = useState("");
  const [picks, setPicks] = useState<Record<string, OraclePick>>({});
  const fixtureMarkets = markets.filter(m => m.fixture_id === fid);

  async function loadPicks(fixtureId: string) {
    const { data } = await supabase.from("oracle_picks").select("*").eq("fixture_id", fixtureId);
    const map: Record<string, OraclePick> = {};
    (data ?? []).forEach(o => { map[o.market_id] = o; });
    setPicks(map);
  }

  function onFixtureChange(id: string) {
    setFid(id);
    if (id) loadPicks(id);
    else setPicks({});
  }

  return (
    <StaggerGroup>
      <StaggerItem index={0}>
        <div className="card-bento p-5 space-y-3">
          <h2 className="display text-2xl text-oracle">Oracle Picks</h2>
          <div>
            <label className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5 block">Fixture</label>
            <select value={fid} onChange={e => onFixtureChange(e.target.value)} className={sel}>
              <option value="">Select fixture…</option>
              {fixtures
                .filter(f => f.status !== "finished")
                .map(f => (
                  <option key={f.id} value={f.id}>
                    MD{f.matchday} · {f.home?.code} vs {f.away?.code} ({f.status})
                  </option>
                ))}
            </select>
          </div>
          {fid && fixtureMarkets.length === 0 && (
            <p className="text-xs text-muted-foreground">No markets yet — create them in the Markets tab first.</p>
          )}
        </div>
      </StaggerItem>

      {fixtureMarkets.map((m, i) => (
        <StaggerItem key={m.id} index={i + 1} className="mt-3">
          <OraclePickCard
            market={m}
            existing={picks[m.id] ?? null}
            onSaved={() => loadPicks(fid)}
          />
        </StaggerItem>
      ))}
    </StaggerGroup>
  );
}

function OraclePickCard({ market, existing, onSaved }: { market: Market; existing: OraclePick | null; onSaved: () => void }) {
  const [pred, setPred] = useState(existing?.prediction ?? "");
  const [conf, setConf] = useState(String(existing?.confidence ?? 0.65));
  const [reason, setReason] = useState(existing?.reasoning ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPred(existing?.prediction ?? "");
    setConf(String(existing?.confidence ?? 0.65));
    setReason(existing?.reasoning ?? "");
  }, [existing]);

  async function save() {
    if (!pred) return toast.error("Select a prediction");
    setBusy(true);
    const { error } = await supabase.from("oracle_picks").upsert(
      { fixture_id: market.fixture_id, market_id: market.id, prediction: pred, confidence: Number(conf), reasoning: reason },
      { onConflict: "market_id" }
    );
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Oracle pick saved — ${market.label}`);
    onSaved();
  }

  return (
    <div className="card-bento p-4 space-y-3 border-oracle/20">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-sm">{market.label}</div>
          <div className="text-xs text-muted-foreground">{market.type} · {market.points} pts</div>
        </div>
        {existing && (
          <span className="chip text-xs text-oracle border border-oracle/30 flex-shrink-0">
            {existing.prediction} · {Math.round(existing.confidence * 100)}%
          </span>
        )}
      </div>
      <select value={pred} onChange={e => setPred(e.target.value)} className={sel}>
        <option value="">Oracle's pick…</option>
        {market.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Confidence</span>
          <span className="text-oracle font-bold">{Math.round(Number(conf) * 100)}%</span>
        </div>
        <input
          type="range" min="0.10" max="1" step="0.05"
          value={conf} onChange={e => setConf(e.target.value)}
          className="w-full accent-oracle"
        />
      </div>
      <textarea
        placeholder="Reasoning shown to users after kickoff…"
        value={reason}
        onChange={e => setReason(e.target.value)}
        className={inp}
        rows={2}
      />
      <button onClick={save} disabled={busy} className={btnOracle}>
        {busy ? "Saving…" : "Save Oracle Pick"}
      </button>
    </div>
  );
}

// ════════════════════════════════════════════════
// RESULTS tab  (Phase 2 — scoring engine)
// ════════════════════════════════════════════════
function ResultsTab({ fixtures, markets, onDone }: { fixtures: Fixture[]; markets: Market[]; onDone: () => void }) {
  const [fid, setFid] = useState("");
  const [hg, setHg] = useState("");
  const [ag, setAg] = useState("");
  // marketId → manual override for non-auto markets
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const nonFinished = fixtures.filter(f => f.status !== "finished");
  const fixture = fixtures.find(f => f.id === fid);
  const fixtureMarkets = markets.filter(m => m.fixture_id === fid);

  const hgNum = parseInt(hg, 10);
  const agNum = parseInt(ag, 10);
  const goalsValid = !isNaN(hgNum) && !isNaN(agNum) && hgNum >= 0 && agNum >= 0;

  const computed = goalsValid
    ? fixtureMarkets.map(m => {
        const auto = autoCorrect(m.type, hgNum, agNum);
        const correct = overrides[m.id] ?? auto ?? "";
        return { market: m, auto, correct, needsManual: auto === null };
      })
    : [];

  const allResolved = computed.length > 0 && computed.every(r => r.correct !== "");

  function reset() { setFid(""); setHg(""); setAg(""); setOverrides({}); }

  async function finalize() {
    if (!fid || !goalsValid) return toast.error("Select a fixture and enter a valid score");
    if (!allResolved) return toast.error("Every market needs a correct answer before scoring");
    setBusy(true);
    try {
      const result = await finalizeFixture({
        data: {
          fixtureId: fid,
          homeGoals: hgNum,
          awayGoals: agNum,
          marketResults: computed.map(r => ({ marketId: r.market.id, correctOption: r.correct })),
        },
      });
      toast.success(`Scored ${result.scored} prediction${result.scored === 1 ? "" : "s"} — leaderboard updated.`);
      reset();
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? "Scoring failed");
    }
    setBusy(false);
  }

  return (
    <StaggerGroup>
      {/* Fixture selector */}
      <StaggerItem index={0}>
        <div className="card-bento p-5 space-y-4">
          <h2 className="display text-2xl text-acid">Enter Results</h2>
          <div>
            <label className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5 block">Fixture</label>
            <select
              value={fid}
              onChange={e => { reset(); setFid(e.target.value); }}
              className={sel}
            >
              <option value="">Select fixture…</option>
              {nonFinished.map(f => (
                <option key={f.id} value={f.id}>
                  MD{f.matchday} · {f.home?.code} vs {f.away?.code} ({f.status})
                </option>
              ))}
            </select>
          </div>

          {/* Score entry */}
          {fid && (
            <div>
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2 block">Final Score</label>
              <div className="flex items-center gap-3">
                <div className="flex-1 text-center">
                  <div className="text-xs text-muted-foreground mb-1 font-semibold">
                    {fixture?.home?.code ?? "HOME"}
                  </div>
                  <input
                    type="number" min={0} placeholder="0"
                    value={hg} onChange={e => setHg(e.target.value)}
                    className={`${inp} text-center text-3xl font-bold num py-3`}
                  />
                </div>
                <span className="text-muted-foreground font-bold text-2xl pb-5">–</span>
                <div className="flex-1 text-center">
                  <div className="text-xs text-muted-foreground mb-1 font-semibold">
                    {fixture?.away?.code ?? "AWAY"}
                  </div>
                  <input
                    type="number" min={0} placeholder="0"
                    value={ag} onChange={e => setAg(e.target.value)}
                    className={`${inp} text-center text-3xl font-bold num py-3`}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </StaggerItem>

      {/* Market results review */}
      {fid && goalsValid && fixtureMarkets.length > 0 && (
        <StaggerItem index={1} className="mt-4">
          <div className="card-bento overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="display text-xl text-acid">Market Results</h3>
              <span className="text-xs text-muted-foreground">
                {computed.filter(r => r.correct).length}/{computed.length} resolved
              </span>
            </div>
            <div className="divide-y divide-border">
              {computed.map(r => (
                <div key={r.market.id} className="px-5 py-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm">{r.market.label}</div>
                      <div className="text-xs text-muted-foreground">{r.market.type} · {r.market.points} pts</div>
                    </div>
                    {r.auto !== null ? (
                      <span className="chip text-xs text-acid border border-acid/30 flex-shrink-0 font-bold">
                        {r.correct}
                      </span>
                    ) : (
                      <span className="chip text-xs text-oracle border border-oracle/30 flex-shrink-0">
                        Manual
                      </span>
                    )}
                  </div>
                  {r.needsManual && (
                    <select
                      value={overrides[r.market.id] ?? ""}
                      onChange={e => setOverrides(prev => ({ ...prev, [r.market.id]: e.target.value }))}
                      className={sel}
                    >
                      <option value="">Select correct answer…</option>
                      {r.market.options.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
            </div>
          </div>
        </StaggerItem>
      )}

      {fid && goalsValid && fixtureMarkets.length === 0 && (
        <StaggerItem index={1} className="mt-4">
          <div className="card-bento p-6 text-center text-muted-foreground text-sm">
            No markets for this fixture. Add markets in the Markets tab first.
          </div>
        </StaggerItem>
      )}

      {/* Finalize button */}
      {fid && goalsValid && (
        <StaggerItem index={2} className="mt-4">
          <div className="card-bento p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-acid" />
              <span className="text-sm font-semibold">Finalize & Score</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Marks the fixture finished, scores every prediction, and recalculates the leaderboard.
              Safe to re-run — scoring is fully idempotent.
            </p>
            <button onClick={finalize} disabled={busy || !allResolved} className={btnAcid}>
              {busy
                ? "Scoring…"
                : `Finalize · ${fixture?.home?.code} ${hg}–${ag} ${fixture?.away?.code}`}
            </button>
          </div>
        </StaggerItem>
      )}
    </StaggerGroup>
  );
}

// ════════════════════════════════════════════════
// RECAPS tab
// ════════════════════════════════════════════════
function RecapsTab() {
  const [md, setMd] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!md || !body.trim()) return toast.error("Matchday and body are required");
    setBusy(true);
    const { error } = await supabase.from("recaps").insert({ matchday: Number(md), body: body.trim() });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Recap posted");
    setMd(""); setBody("");
  }

  return (
    <StaggerGroup>
      <StaggerItem index={0}>
        <div className="card-bento p-5 space-y-4">
          <h2 className="display text-2xl text-acid">Post Recap</h2>
          <div>
            <label className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5 block">Matchday</label>
            <input
              type="number" min={1} placeholder="e.g. 3"
              value={md} onChange={e => setMd(e.target.value)}
              className={inp}
            />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5 block">Body</label>
            <textarea
              placeholder="What happened this matchday? Who scored? Who faded The Eye successfully?…"
              value={body}
              onChange={e => setBody(e.target.value)}
              className={inp}
              rows={7}
            />
          </div>
          <button onClick={submit} disabled={busy} className={btnAcid}>
            {busy ? "Posting…" : "Post Recap"}
          </button>
        </div>
      </StaggerItem>
    </StaggerGroup>
  );
}
