import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Trophy, User, Users, Shield } from "lucide-react";
import { useAuth, useIsAdmin } from "@/lib/useAuth";
import type { ReactNode } from "react";

export function Layout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const isAdmin = useIsAdmin(user?.id);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

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
      <main className="max-w-2xl mx-auto px-4 pt-6">{children}</main>
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
