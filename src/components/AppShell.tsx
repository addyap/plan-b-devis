import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

const nav = [
  { to: "/dashboard", label: "Devis" },
  { to: "/clients", label: "Clients" },
  { to: "/settings", label: "Settings" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-3">
            <div className="size-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold text-xs tracking-wider">PB</div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-foreground">Plan B Concept</div>
              <div className="text-[10px] text-muted-foreground tracking-wide uppercase">Côte d'Azur</div>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {nav.map((n) => {
              const active = path.startsWith(n.to) || (n.to === "/dashboard" && path.startsWith("/devis"));
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`px-3 py-1.5 rounded-md text-sm transition-colors ${active ? "bg-accent text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="size-4" />
            <span className="hidden sm:inline ml-2">Sign out</span>
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
