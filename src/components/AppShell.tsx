import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

const nav = [
  { to: "/dashboard", label: "Devis" },
  { to: "/factures", label: "Factures" },
  { to: "/clients", label: "Clients" },
  { to: "/settings", label: "Settings" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });

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
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
