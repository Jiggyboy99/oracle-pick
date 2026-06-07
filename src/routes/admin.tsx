import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdmin } from "@/lib/useAuth";
import { Layout } from "@/components/Layout";
import { toast } from "sonner";
import { scoreFixture } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Predictor" }] }),
  component: AdminPage,
});

function AdminPage() {
  const { user, loading } = useAuth();
  const isAdmin = useIsAdmin(user?.id);
  const navigate = useNavigate();
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [markets, setMarkets] = useState<any[]>([]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    supabase.from("fixtures").select("id, matchday, status, home:teams!fixtures_home_team_id_fkey(code), away:teams!fixtures_away_team_id_fkey(code), home_goals, away_goals").order("matchday").then(({ data }) => setFixtures(data ?? []));
    supabase.from("markets").select("id, label, fixture_id, type, options").then(({ data }) => setMarkets(data ?? []));
  }, [isAdmin]);

  if (loading) return <Layout><div className="text-center py-20">…</div></Layout>;
  if (!isAdmin) {
    return (
      <Layout>
        <div className="card-bento p-6 text-center">
          <h1 className="text-2xl mb-2">Admins only</h1>
          <p className="text-muted-foreground text-sm mb-4">
            Your user ID:<br/><code className="text-acid break-all">{user?.id}</code>
          </p>
          <p className="text-xs text-muted-foreground">
            Open the backend dashboard and insert a row into <code>user_roles</code> with this user_id and role <code>admin</code>.
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <h1 className="text-4xl mb-6">Admin</h1>

      <Section title="Finalize fixture">
        <FinalizeForm fixtures={fixtures} onDone={() => location.reload()} />
      </Section>

      <Section title="Add Oracle pick">
        <OraclePickForm markets={markets} />
      </Section>

      <Section title="Post matchday recap">
        <RecapForm />
      </Section>
    </Layout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card-bento p-5 mb-4">
      <h2 className="text-lg mb-3 font-bold">{title}</h2>
      {children}
    </div>
  );
}

function FinalizeForm({ fixtures, onDone }: { fixtures: any[]; onDone: () => void }) {
  const [fid, setFid] = useState("");
  const [hg, setHg] = useState("");
  const [ag, setAg] = useState("");
  async function go() {
    if (!fid) return;
    const { error } = await supabase.from("fixtures").update({ home_goals: Number(hg), away_goals: Number(ag), status: "finished" }).eq("id", fid);
    if (error) { toast.error(error.message); return; }
    // call scoring via RPC — service role needed, so do via server-side direct SQL not possible from client
    // alternative: call a public RPC; we'll just run an update and rely on a separate trigger if needed
    try {
      await scoreFixture({ data: { fixtureId: fid } });
      toast.success("Finalized + scored.");
    } catch (e: any) {
      toast.error("Saved goals but scoring failed: " + (e?.message ?? "unknown"));
    }
    onDone();
  }
  return (
    <div className="space-y-2">
      <select value={fid} onChange={(e) => setFid(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border">
        <option value="">Select fixture…</option>
        {fixtures.map((f) => (
          <option key={f.id} value={f.id}>MD{f.matchday} · {f.home?.code} vs {f.away?.code} ({f.status})</option>
        ))}
      </select>
      <div className="grid grid-cols-2 gap-2">
        <input placeholder="Home goals" type="number" value={hg} onChange={(e) => setHg(e.target.value)} className="px-3 py-2 rounded-lg bg-secondary border border-border" />
        <input placeholder="Away goals" type="number" value={ag} onChange={(e) => setAg(e.target.value)} className="px-3 py-2 rounded-lg bg-secondary border border-border" />
      </div>
      <button onClick={go} className="w-full py-2 bg-acid text-acid-foreground rounded-lg font-bold">Finalize & score</button>
    </div>
  );
}

function OraclePickForm({ markets }: { markets: any[] }) {
  const [mid, setMid] = useState("");
  const [pred, setPred] = useState("");
  const [conf, setConf] = useState("0.6");
  const [reason, setReason] = useState("");
  const market = markets.find((m) => m.id === mid);
  async function go() {
    if (!mid) return;
    const { error } = await supabase.from("oracle_picks").upsert({
      market_id: mid,
      fixture_id: market.fixture_id,
      prediction: pred,
      confidence: Number(conf),
      reasoning: reason,
    }, { onConflict: "market_id" });
    if (error) toast.error(error.message); else { toast.success("Saved"); setPred(""); setReason(""); }
  }
  return (
    <div className="space-y-2">
      <select value={mid} onChange={(e) => setMid(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border">
        <option value="">Select market…</option>
        {markets.map((m) => <option key={m.id} value={m.id}>{m.label} ({m.type})</option>)}
      </select>
      {market && (
        <select value={pred} onChange={(e) => setPred(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border">
          <option value="">Pick…</option>
          {(market.options as any[]).map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}
      <input placeholder="Confidence (0-1)" value={conf} onChange={(e) => setConf(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border" />
      <textarea placeholder="Reasoning" value={reason} onChange={(e) => setReason(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border" rows={3} />
      <button onClick={go} className="w-full py-2 bg-oracle text-white rounded-lg font-bold">Save Oracle pick</button>
    </div>
  );
}

function RecapForm() {
  const [md, setMd] = useState("");
  const [body, setBody] = useState("");
  async function go() {
    if (!md || !body) return;
    const { error } = await supabase.from("recaps").insert({ matchday: Number(md), body });
    if (error) toast.error(error.message); else { toast.success("Posted"); setBody(""); setMd(""); }
  }
  return (
    <div className="space-y-2">
      <input placeholder="Matchday" type="number" value={md} onChange={(e) => setMd(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border" />
      <textarea placeholder="Recap body" value={body} onChange={(e) => setBody(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border" rows={5} />
      <button onClick={go} className="w-full py-2 bg-acid text-acid-foreground rounded-lg font-bold">Post recap</button>
    </div>
  );
}
