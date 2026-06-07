import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const scoreFixture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fixtureId: string }) => {
    if (!input?.fixtureId || typeof input.fixtureId !== "string") {
      throw new Error("fixtureId required");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: roleRow, error: roleErr } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (roleErr) throw new Error(roleErr.message);
    if (!roleRow) throw new Error("Not authorized");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.schema("private" as never).rpc("score_fixture" as never, { _fixture_id: data.fixtureId } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
