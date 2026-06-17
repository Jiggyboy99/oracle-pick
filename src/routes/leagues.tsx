import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { Layout } from "@/components/Layout";
import { PageTransition } from "@/components/motion/PageTransition";
import { StaggerGroup, StaggerItem } from "@/components/motion/Stagger";
import { toast } from "sonner";
import { ChevronRight, Lock, Users } from "lucide-react";

export const Route = createFileRoute("/leagues")({
  head: () => ({ meta: [{ title: "Leagues — The Eye" }] }),
  component: LeaguesPage,
});

function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

const inp =
  "w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:ring-1 focus:ring-acid/50 placeholder:text-muted-foreground";

function LeaguesPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [leagues, setLeagues] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [joinType, setJoinType] = useState<"code" | "approval">("code");
  const [showPastResults, setShowPastResults] = useState(true);
  const [joinCode, setJoinCode] = useState("");
  const [busyCreate, setBusyCreate] = useState(false);
  const [busyJoin, setBusyJoin] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  async function load() {
    if (!user) return;
    const { data: mem, error: loadErr } = await supabase
      .from("league_members")
      .select("leagues(id, name, invite_code, creator_id, join_type, show_past_results)")
      .eq("user_id", user.id);
    console.log("[leagues] load →", { mem, error: loadErr });
    if (loadErr) { toast.error(loadErr.message); return; }
    setLeagues((mem ?? []).map((m: any) => m.leagues).filter(Boolean));
  }
  useEffect(() => { load(); }, [user]);

  async function create() {
    if (!user || !name.trim()) return toast.error("Enter a league name");
    setBusyCreate(true);
    const code = genCode();
    const { data, error } = await supabase
      .from("leagues")
      .insert({ name: name.trim(), invite_code: code, creator_id: user.id, join_type: joinType, show_past_results: showPastResults })
      .select()
      .single();
    console.log("[leagues] insert league →", { data, error });
    if (error) { toast.error(error.message); setBusyCreate(false); return; }
    const { error: memErr } = await supabase
      .from("league_members")
      .insert({ league_id: data.id, user_id: user.id });
    console.log("[leagues] insert member →", { error: memErr });
    if (memErr) { toast.error(memErr.message); setBusyCreate(false); return; }
    toast.success(`League created — code: ${code}`);
    setName(""); setCreating(false); setBusyCreate(false);
    load();
  }

  async function join() {
    if (!user || !joinCode.trim()) return toast.error("Enter an invite code");
    setBusyJoin(true);
    const { data: lg } = await supabase
      .from("leagues")
      .select("id, name, join_type")
      .eq("invite_code", joinCode.trim().toUpperCase())
      .maybeSingle();
    if (!lg) { toast.error("Code not found — check and try again"); setBusyJoin(false); return; }
    if (lg.join_type === "approval") {
      toast.info(`"${lg.name}" requires creator approval. Share your username with the league creator.`);
      setBusyJoin(false); return;
    }
    const { error } = await supabase.from("league_members").insert({ league_id: lg.id, user_id: user.id });
    if (error) {
      toast.error(error.message.includes("duplicate") ? "You're already in this league" : error.message);
      setBusyJoin(false); return;
    }
    toast.success(`Joined "${lg.name}"`);
    setJoinCode(""); setBusyJoin(false);
    load();
  }

  return (
    <Layout>
      <PageTransition>
        <div className="mb-8">
          <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] mb-1">Private</p>
          <h1 className="display text-5xl leading-none text-foreground">LEAGUES</h1>
          <p className="text-muted-foreground text-xs mt-1.5">Compete with your crew. Settle it properly.</p>
        </div>

        <StaggerGroup>
          {/* ── Create + Join row ── */}
          <StaggerItem index={0}>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setCreating(!creating)}
                className={`card-bento p-4 text-left active:scale-[0.97] transition-all border ${creating ? "border-acid/60" : "border-border"}`}
              >
                <Users size={18} className="text-acid mb-2" />
                <div className="font-bold text-sm">Create league</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Start fresh with your group</div>
              </button>

              <div className="card-bento p-4">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Have a code?</div>
                <div className="flex gap-1.5">
                  <input
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="ABC123"
                    maxLength={6}
                    className={`${inp} uppercase font-mono tracking-[0.3em] flex-1 text-center`}
                  />
                  <button
                    onClick={join}
                    disabled={busyJoin}
                    className="px-3 rounded-xl bg-acid text-acid-foreground font-bold text-sm active:scale-95 disabled:opacity-50"
                  >
                    {busyJoin ? "…" : "Go"}
                  </button>
                </div>
              </div>
            </div>
          </StaggerItem>

          {/* ── Create form ── */}
          <AnimatePresence>
            {creating && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="overflow-hidden"
              >
                <StaggerItem index={1} className="mt-3">
                  <div className="card-bento p-5 space-y-4 border-acid/30">
                    <h2 className="display text-2xl text-acid">New League</h2>

                    <div>
                      <label className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5 block">League name</label>
                      <input
                        placeholder="The Bants United"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className={inp}
                        onKeyDown={(e) => e.key === "Enter" && create()}
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5 block">Who can join?</label>
                      <div className="grid grid-cols-2 gap-2">
                        {(["code", "approval"] as const).map((t) => (
                          <button
                            key={t}
                            onClick={() => setJoinType(t)}
                            className={`py-2.5 px-3 rounded-xl border text-sm font-semibold flex items-center gap-2 transition-all active:scale-95 ${
                              joinType === t ? "bg-acid border-acid text-acid-foreground" : "bg-secondary border-border text-foreground"
                            }`}
                          >
                            {t === "approval" && <Lock size={12} />}
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
                      onClick={create}
                      disabled={busyCreate}
                      className="w-full py-2.5 rounded-xl bg-acid text-acid-foreground font-bold text-sm active:scale-95 disabled:opacity-50"
                    >
                      {busyCreate ? "Creating…" : "+ Create League"}
                    </button>
                  </div>
                </StaggerItem>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── League list ── */}
          <StaggerItem index={2} className="mt-6">
            <div className="flex items-end justify-between mb-4 px-1">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em]">Your squads</p>
                <h2 className="display text-3xl leading-none mt-0.5">My Leagues</h2>
              </div>
              <span className="num text-2xl text-muted-foreground">{leagues.length}</span>
            </div>

            {leagues.length === 0 ? (
              <div className="card-bento p-8 text-center text-muted-foreground text-sm">
                No leagues yet — create one or ask a friend for their code.
              </div>
            ) : (
              <div className="space-y-2">
                {leagues.map((l) => (
                  <Link
                    key={l.id}
                    to="/leagues/$id"
                    params={{ id: l.id }}
                    className="card-bento p-4 flex items-center gap-3 active:scale-[0.98] transition-transform"
                  >
                    <div className="w-10 h-10 rounded-xl bg-acid/10 border border-acid/20 flex items-center justify-center flex-shrink-0">
                      <Users size={16} className="text-acid" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold truncate">{l.name}</div>
                      <div className="text-xs text-muted-foreground font-mono mt-0.5 flex items-center gap-2">
                        <span className="text-acid">{l.invite_code}</span>
                        {l.join_type === "approval" && (
                          <span className="inline-flex items-center gap-0.5"><Lock size={9} /> Approval</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-acid flex-shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </StaggerItem>
        </StaggerGroup>
      </PageTransition>
    </Layout>
  );
}
