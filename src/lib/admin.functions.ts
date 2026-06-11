import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const ADMIN_EMAILS = ["akinloyetobi13@gmail.com", "emkaykudaisi@gmail.com"];

function parseScore(s: string): { home: number; away: number } | null {
  const m = s.match(/^(\d+)[-:](\d+)$/);
  return m ? { home: +m[1], away: +m[2] } : null;
}

function dir(h: number, a: number): "home" | "draw" | "away" {
  return h > a ? "home" : h < a ? "away" : "draw";
}

export const finalizeFixture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    fixtureId: string;
    homeGoals: number;
    awayGoals: number;
    marketResults: { marketId: string; correctOption: string }[];
  }) => {
    if (!input?.fixtureId || typeof input.fixtureId !== "string") throw new Error("fixtureId required");
    if (typeof input.homeGoals !== "number") throw new Error("homeGoals required");
    if (typeof input.awayGoals !== "number") throw new Error("awayGoals required");
    if (!Array.isArray(input.marketResults)) throw new Error("marketResults required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const email = ((context.claims as any)?.email ?? "").toLowerCase();
    if (!ADMIN_EMAILS.includes(email)) throw new Error("Not authorized");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { fixtureId, homeGoals, awayGoals, marketResults } = data;

    // Mark fixture finished — idempotent: safe to run twice
    const { error: fxErr } = await supabaseAdmin
      .from("fixtures")
      .update({ home_goals: homeGoals, away_goals: awayGoals, status: "finished" })
      .eq("id", fixtureId);
    if (fxErr) throw new Error(fxErr.message);

    const [{ data: markets }, { data: preds }] = await Promise.all([
      supabaseAdmin.from("markets").select("id,type,points").eq("fixture_id", fixtureId),
      supabaseAdmin.from("predictions").select("id,user_id,market_id,pick,faded_oracle").eq("fixture_id", fixtureId),
    ]);

    if (!preds?.length) return { ok: true, scored: 0 };

    const mktMap: Record<string, { points: number; type: string }> = {};
    (markets ?? []).forEach(m => { mktMap[m.id] = { points: m.points, type: m.type }; });

    const correctMap: Record<string, string> = {};
    marketResults.forEach(mr => { correctMap[mr.marketId] = mr.correctOption; });

    // Score rules:
    // - Exact correct pick → full points
    // - exact_score with correct result direction but wrong score → 40% (rounded)
    // - Everything else → 0
    const actualDir = dir(homeGoals, awayGoals);
    const scoreUpdates = preds.map(p => {
      const mkt = mktMap[p.market_id];
      const correct = correctMap[p.market_id];
      if (!mkt || !correct) return { id: p.id, points_awarded: 0 };
      if (p.pick === correct) return { id: p.id, points_awarded: mkt.points };
      if (mkt.type === "exact_score") {
        const parsed = parseScore(p.pick);
        if (parsed && dir(parsed.home, parsed.away) === actualDir) {
          return { id: p.id, points_awarded: Math.round(mkt.points * 0.4) };
        }
      }
      return { id: p.id, points_awarded: 0 };
    });

    // Apply score updates in parallel — resetting before recompute makes this idempotent
    await Promise.all(
      scoreUpdates.map(u =>
        supabaseAdmin.from("predictions").update({ points_awarded: u.points_awarded }).eq("id", u.id)
      )
    );

    // Load ALL finished fixtures (this one is now finished) for streak computation
    const { data: finishedFxs } = await supabaseAdmin
      .from("fixtures").select("id,kickoff_at").eq("status", "finished").order("kickoff_at");
    const finishedIds = new Set((finishedFxs ?? []).map(f => f.id));

    // Recompute all stats from scratch for each affected user — ensures idempotency
    const affectedUsers = [...new Set(preds.map(p => p.user_id))];
    await Promise.all(affectedUsers.map(async uid => {
      const { data: up } = await supabaseAdmin
        .from("predictions")
        .select("fixture_id,points_awarded,faded_oracle")
        .eq("user_id", uid);

      const rows = up ?? [];
      const totalPoints = rows.reduce((s, p) => s + (p.points_awarded ?? 0), 0);

      // Oracle stats: only count faded predictions on finalized fixtures
      const fadedDone = rows.filter(p => p.faded_oracle && finishedIds.has(p.fixture_id));
      const oracleWins = fadedDone.filter(p => (p.points_awarded ?? 0) === 0).length;
      const oracleLosses = fadedDone.filter(p => (p.points_awarded ?? 0) > 0).length;

      // Streaks: walk finalized fixtures chronologically
      // Fixtures where user has no predictions are skipped (don't break streak)
      const fxScore: Record<string, number> = {};
      const fxSeen = new Set<string>();
      rows.forEach(p => {
        fxScore[p.fixture_id] = (fxScore[p.fixture_id] ?? 0) + (p.points_awarded ?? 0);
        fxSeen.add(p.fixture_id);
      });

      let cur = 0, best = 0;
      for (const fx of (finishedFxs ?? [])) {
        if (!fxSeen.has(fx.id)) continue;
        if ((fxScore[fx.id] ?? 0) > 0) { cur++; if (cur > best) best = cur; }
        else cur = 0;
      }

      await supabaseAdmin.from("profiles").update({
        total_points: totalPoints,
        oracle_wins: oracleWins,
        oracle_losses: oracleLosses,
        current_streak: cur,
        best_streak: best,
      }).eq("id", uid);
    }));

    return { ok: true, scored: scoreUpdates.length };
  });
