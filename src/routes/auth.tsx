import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — Predictor" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setResetSent(true);
        return;
      }
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Welcome to the prediction game.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function google() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) { toast.error("Google sign-in failed"); setLoading(false); return; }
    if (result.redirected) return;
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 chip bg-acid mb-4">
          <Sparkles size={12} /> Predictor
        </div>
        <h1 className="text-5xl mb-2">Fade<br/>the Oracle.</h1>
        <p className="text-muted-foreground">Predict matches. Beat the AI. Run up the board.</p>
      </div>

      <div className="w-full max-w-sm card-bento p-6">
        <button
          onClick={google}
          disabled={loading}
          className="w-full py-3 rounded-xl bg-white text-black font-semibold mb-4 active:scale-[0.97] transition-transform"
        >
          Continue with Google
        </button>
        <div className="text-center text-xs text-muted-foreground mb-4">or</div>
        {mode === "forgot" && resetSent ? (
          <div className="text-center space-y-4 py-2">
            <p className="text-sm text-foreground">
              Reset link sent to <span className="text-acid font-semibold">{email}</span>.
            </p>
            <p className="text-xs text-muted-foreground">Check your inbox and click the link to set a new password.</p>
            <button
              onClick={() => { setMode("signin"); setResetSent(false); }}
              className="w-full mt-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" && (
              <input
                type="text"
                placeholder="Display name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-secondary border border-border focus:border-acid outline-none"
              />
            )}
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl bg-secondary border border-border focus:border-acid outline-none"
            />
            {mode !== "forgot" && (
              <div className="space-y-1">
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-3 rounded-xl bg-secondary border border-border focus:border-acid outline-none"
                />
                {mode === "signin" && (
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => setMode("forgot")}
                      className="text-xs text-muted-foreground hover:text-acid transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-acid text-acid-foreground font-bold active:scale-[0.97] transition-transform"
            >
              {loading ? "..." : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
            </button>
          </form>
        )}
        {!resetSent && (
          <button
            onClick={() => setMode(mode === "signup" ? "signin" : mode === "forgot" ? "signin" : "signup")}
            className="w-full mt-4 text-sm text-muted-foreground hover:text-foreground"
          >
            {mode === "signup"
              ? "Have an account? Sign in"
              : mode === "forgot"
              ? "Back to sign in"
              : "New here? Create an account"}
          </button>
        )}
      </div>
    </div>
  );
}
