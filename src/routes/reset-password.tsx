import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset password — The Eye" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);   // recovery session confirmed
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Supabase fires PASSWORD_RECOVERY when the page loads with a recovery token
    // in the URL hash. Listen for it and mark the session as ready.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });

    // Also check for an existing recovery session (page reload after token parsed)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated — signing you in.");
    navigate({ to: "/" });
  }

  const inp = "w-full px-4 py-3 rounded-xl bg-secondary border border-border focus:border-acid outline-none";
  const btnAcid = "w-full py-3 rounded-xl bg-acid text-acid-foreground font-bold active:scale-[0.97] transition-transform disabled:opacity-50";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 chip bg-acid mb-4">
          <Sparkles size={12} /> The Eye
        </div>
        <h1 className="text-5xl mb-2">New<br/>password.</h1>
        <p className="text-muted-foreground">Choose something you'll remember.</p>
      </div>

      <div className="w-full max-w-sm card-bento p-6">
        {!ready ? (
          <div className="text-center space-y-3 py-4">
            <div className="w-8 h-8 rounded-full border-2 border-acid border-t-transparent animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">Verifying reset link…</p>
            <p className="text-xs text-muted-foreground">
              If nothing happens, the link may have expired.{" "}
              <button
                onClick={() => navigate({ to: "/auth" })}
                className="text-acid hover:underline"
              >
                Request a new one.
              </button>
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <input
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className={inp}
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={6}
              className={inp}
            />
            <button type="submit" disabled={loading} className={btnAcid}>
              {loading ? "Updating…" : "Set new password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
