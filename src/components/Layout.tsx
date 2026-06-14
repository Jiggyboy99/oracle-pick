import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Trophy, User, Users, Shield } from "lucide-react";
import { useAuth, useIsAdmin } from "@/lib/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ReactNode } from "react";

type Sponsor = { name: string; logo_url: string; website_url: string | null };

function useSponsor() {
  const [sponsor, setSponsor] = useState<Sponsor | null>(null);
  useEffect(() => {
    supabase
      .from("sponsors")
      .select("name, logo_url, website_url")
      .order("display_order", { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setSponsor(data ?? null));
  }, []);
  return sponsor;
}

export function Layout({ children, fullWidth = false }: { children: ReactNode; fullWidth?: boolean }) {
  const { user } = useAuth();
  const isAdmin = useIsAdmin(user?.id);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const sponsor = useSponsor();

  const Item = ({ to, icon: Icon, label }: { to: string; icon: typeof Home; label: string }) => {
    const active = pathname === to || (to !== "/" && pathname.startsWith(to));
    return (
      <Link
        to={to}
        className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all active:scale-90 ${
          active ? "text-acid" : "text-muted-foreground"
        }`}
      >
        <Icon size={22} strokeWidth={active ? 2.5 : 2} />
        <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
      </Link>
    );
  };

  return (
    <div className="min-h-screen pb-24">
      {sponsor && (
        <div className="w-full border-b border-white/5 bg-[#0A0A0F]/80 backdrop-blur-sm">
          <div className="max-w-2xl mx-auto px-4 py-2 flex items-center justify-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.25em] text-white/30">Powered by</span>
            {sponsor.website_url ? (
              <a
                href={sponsor.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
              >
                <img
                  src={sponsor.logo_url}
                  alt={sponsor.name}
                  className="h-5 w-auto object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                    (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                  }}
                />
                <span className="hidden text-xs font-semibold text-white/70">{sponsor.name}</span>
              </a>
            ) : (
              <div className="flex items-center gap-1.5">
                <img
                  src={sponsor.logo_url}
                  alt={sponsor.name}
                  className="h-5 w-auto object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                    (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                  }}
                />
                <span className="hidden text-xs font-semibold text-white/70">{sponsor.name}</span>
              </div>
            )}
          </div>
        </div>
      )}
      <main className={fullWidth ? "" : "max-w-2xl mx-auto px-4 pt-6"}>{children}</main>
      <nav className="fixed bottom-3 left-1/2 -translate-x-1/2 glass rounded-2xl px-2 py-1 flex gap-1 z-40 shadow-2xl">
        <Item to="/" icon={Trophy} label="Board" />
        <Item to="/matches" icon={Home} label="Matches" />
        <Item to="/leagues" icon={Users} label="Leagues" />
        <Item to="/profile" icon={User} label="Me" />
        {isAdmin && <Item to="/admin" icon={Shield} label="Admin" />}
      </nav>
    </div>
  );
}
