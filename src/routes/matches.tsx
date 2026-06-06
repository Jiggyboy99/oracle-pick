import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { Layout } from "@/components/Layout";
import { formatDistanceToNow } from "date-fns";
import { Lock, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/matches")({
  head: () => ({ meta: [{ title: "Matches — Predictor" }] }),
  component: MatchesPage,
});

function MatchesPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [fixtures, setFixtures] = useState<any[]>([]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    supabase
      .from("fixtures")
      .select("id, matchday, kickoff_at, status, home_goals, away_goals, home:teams!fixtures_home_team_id_fkey(name,code,flag_url), away:teams!fixtures_away_team_id_fkey(name,code,flag_url)")
      .order("kickoff_at", { ascending: true })
      .then(({ data }) => setFixtures(data ?? []));
  }, []);

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-5xl mb-1">Matches</h1>
        <p className="text-muted-foreground text-sm">Lock in your picks before kickoff.</p>
      </div>
      <div className="space-y-3">
        {fixtures.map((fx) => {
          const locked = new Date(fx.kickoff_at) < new Date() || fx.status !== "upcoming";
          return (
            <Link
              key={fx.id}
              to="/match/$id"
              params={{ id: fx.id }}
              className="card-bento p-4 flex items-center gap-3 active:scale-[0.98] transition-transform"
            >
              <div className="flex-1">
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Matchday {fx.matchday}</div>
                <div className="flex items-center gap-2">
                  {fx.home.flag_url && <img src={fx.home.flag_url} alt="" className="w-6 h-4 rounded-sm object-cover" />}
                  <span className="font-bold">{fx.home.code}</span>
                  <span className="text-muted-foreground">vs</span>
                  <span className="font-bold">{fx.away.code}</span>
                  {fx.away.flag_url && <img src={fx.away.flag_url} alt="" className="w-6 h-4 rounded-sm object-cover" />}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {locked ? (
                    fx.status === "finished" && fx.home_goals != null
                      ? `Final ${fx.home_goals}-${fx.away_goals}`
                      : "Locked"
                  ) : (
                    `Kicks off ${formatDistanceToNow(new Date(fx.kickoff_at), { addSuffix: true })}`
                  )}
                </div>
              </div>
              {locked ? <Lock size={18} className="text-muted-foreground" /> : <ChevronRight size={18} className="text-acid" />}
            </Link>
          );
        })}
      </div>
    </Layout>
  );
}
