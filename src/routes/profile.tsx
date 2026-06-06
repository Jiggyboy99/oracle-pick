import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { Layout } from "@/components/Layout";
import { StreakFlame } from "@/components/StreakFlame";
import { LogOut, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile — Predictor" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [rank, setRank] = useState<number | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      setProfile(p);
      setName(p?.display_name ?? "");
      const { data: all } = await supabase.from("profiles").select("id, total_points").order("total_points", { ascending: false });
      const idx = (all ?? []).findIndex((r) => r.id === user.id);
      setRank(idx >= 0 ? idx + 1 : null);
      const { data: hist } = await supabase
        .from("predictions")
        .select("pick, points_awarded, faded_oracle, created_at, markets(label), fixtures(home_goals,away_goals, home:teams!fixtures_home_team_id_fkey(code), away:teams!fixtures_away_team_id_fkey(code))")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      setHistory(hist ?? []);
    })();
  }, [user]);

  async function save() {
    if (!user) return;
    await supabase.from("profiles").update({ display_name: name }).eq("id", user.id);
    setProfile({ ...profile, display_name: name });
    setEditing(false);
    toast.success("Saved");
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  if (!profile) return <Layout><div className="text-center text-muted-foreground py-20">Loading…</div></Layout>;

  const oracleRecord = profile.oracle_wins + profile.oracle_losses;

  return (
    <Layout>
      <div className="card-bento p-6 mb-5">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-acid to-oracle flex items-center justify-center text-3xl font-bold">
            {profile.display_name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1">
            {editing ? (
              <div className="flex gap-2">
                <input value={name} onChange={(e) => setName(e.target.value)} className="bg-secondary px-3 py-2 rounded-lg flex-1 border border-border" />
                <button onClick={save} className="px-3 py-2 bg-acid text-acid-foreground rounded-lg font-semibold">Save</button>
              </div>
            ) : (
              <>
                <h1 className="text-3xl">{profile.display_name}</h1>
                <button onClick={() => setEditing(true)} className="text-xs text-muted-foreground underline">edit</button>
              </>
            )}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-4">
          <Stat label="Points" value={profile.total_points} accent />
          <Stat label="Global Rank" value={rank ? `#${rank}` : "—"} />
          <Stat label="Best Streak" value={profile.best_streak} />
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="card-bento p-3 flex-1" style={{ background: "color-mix(in oklab, var(--oracle) 14%, var(--surface-2))" }}>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Sparkles size={10} className="text-oracle" /> vs Oracle
            </div>
            <div className="text-xl font-bold">
              {oracleRecord > 0 ? `${profile.oracle_wins}-${profile.oracle_losses}` : "Not yet"}
            </div>
          </div>
          <div className="card-bento p-3 flex-1">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Current Streak</div>
            <div className="text-xl font-bold flex items-center gap-1">
              {profile.current_streak} <StreakFlame streak={profile.current_streak} />
            </div>
          </div>
        </div>
      </div>

      <h2 className="text-xl mb-3">Recent Predictions</h2>
      <div className="space-y-2">
        {history.length === 0 && <div className="text-muted-foreground text-sm">No predictions yet. Make some picks.</div>}
        {history.map((h, i) => (
          <div key={i} className="card-bento p-3 flex items-center justify-between text-sm">
            <div>
              <div className="font-semibold">{h.fixtures?.home?.code} vs {h.fixtures?.away?.code}</div>
              <div className="text-xs text-muted-foreground">{h.markets?.label} → {h.pick} {h.faded_oracle && <span className="chip bg-oracle ml-1">FADE</span>}</div>
            </div>
            <div className="text-acid font-bold tabular-nums">+{h.points_awarded}</div>
          </div>
        ))}
      </div>

      <button onClick={signOut} className="mt-8 w-full py-3 rounded-xl bg-secondary border border-border text-muted-foreground flex items-center justify-center gap-2 active:scale-[0.97]">
        <LogOut size={16} /> Sign out
      </button>
    </Layout>
  );
}

function Stat({ label, value, accent }: { label: string; value: any; accent?: boolean }) {
  return (
    <div className="card-bento p-3 text-center">
      <div className={`text-2xl font-bold tabular-nums ${accent ? "text-acid" : ""}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
