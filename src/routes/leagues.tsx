import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { Layout } from "@/components/Layout";
import { toast } from "sonner";
import { Plus, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/leagues")({
  head: () => ({ meta: [{ title: "Leagues — Predictor" }] }),
  component: LeaguesPage,
});

function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function LeaguesPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [leagues, setLeagues] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  async function load() {
    if (!user) return;
    const { data: mem } = await supabase
      .from("league_members")
      .select("leagues(id, name, invite_code, creator_id)")
      .eq("user_id", user.id);
    setLeagues((mem ?? []).map((m: any) => m.leagues).filter(Boolean));
  }
  useEffect(() => { load(); }, [user]);

  async function create() {
    if (!user || !name) return;
    const code = genCode();
    const { data, error } = await supabase.from("leagues").insert({ name, invite_code: code, creator_id: user.id }).select().single();
    if (error) { toast.error(error.message); return; }
    await supabase.from("league_members").insert({ league_id: data.id, user_id: user.id });
    toast.success(`League created. Code: ${code}`);
    setName(""); setCreating(false);
    load();
  }

  async function join() {
    if (!user || !joinCode) return;
    const { data: lg } = await supabase.from("leagues").select("id").eq("invite_code", joinCode.toUpperCase()).maybeSingle();
    if (!lg) { toast.error("Invalid code"); return; }
    const { error } = await supabase.from("league_members").insert({ league_id: lg.id, user_id: user.id });
    if (error) { toast.error(error.message); return; }
    toast.success("Joined!");
    setJoinCode("");
    load();
  }

  return (
    <Layout>
      <h1 className="text-5xl mb-1">Leagues</h1>
      <p className="text-muted-foreground text-sm mb-6">Run it back with your group.</p>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <button onClick={() => setCreating(!creating)} className="card-bento p-4 text-left active:scale-[0.97]">
          <Plus className="text-acid mb-2" />
          <div className="font-bold">Create league</div>
        </button>
        <div className="card-bento p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Have a code?</div>
          <div className="flex gap-1">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="ABC123"
              maxLength={6}
              className="flex-1 px-2 py-2 rounded-lg bg-secondary border border-border text-sm uppercase"
            />
            <button onClick={join} className="px-3 rounded-lg bg-acid text-acid-foreground font-bold text-sm">Go</button>
          </div>
        </div>
      </div>

      {creating && (
        <div className="card-bento p-4 mb-4">
          <input
            placeholder="League name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-secondary border border-border mb-2"
          />
          <button onClick={create} className="w-full py-2 bg-acid text-acid-foreground rounded-lg font-bold">Create</button>
        </div>
      )}

      <div className="space-y-2">
        {leagues.length === 0 && <div className="text-muted-foreground text-sm">No leagues yet.</div>}
        {leagues.map((l) => (
          <Link key={l.id} to="/leagues/$id" params={{ id: l.id }} className="card-bento p-4 flex items-center justify-between active:scale-[0.98]">
            <div>
              <div className="font-bold">{l.name}</div>
              <div className="text-xs text-muted-foreground font-mono">Code: {l.invite_code}</div>
            </div>
            <ChevronRight className="text-acid" />
          </Link>
        ))}
      </div>
    </Layout>
  );
}
