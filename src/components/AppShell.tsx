import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import logoAsset from "@/assets/plan-b-logo.png.asset.json";

const NAV = [
  { to: "/dashboard", key: "nav.devis" },
  { to: "/factures", key: "nav.factures" },
  { to: "/clients", key: "nav.clients" },
  { to: "/settings", key: "nav.settings" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { t, i18n } = useTranslation();

  const setLang = (lng: "fr" | "en") => i18n.changeLanguage(lng);
  const current = (i18n.resolvedLanguage ?? i18n.language ?? "fr").startsWith("fr") ? "fr" : "en";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-brand-maroon-dark bg-brand-maroon text-white shadow-sm">
        <div className="mx-auto max-w-7xl px-6 h-20 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-3">
            <div className="size-14 rounded-md overflow-hidden shadow-sm">
              <img src={logoAsset.url} alt="Plan B Côte d'Azur" className="size-full object-contain" />
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <nav className="hidden md:flex items-center gap-1">
              {NAV.map((n) => {
                const active = path.startsWith(n.to) || (n.to === "/dashboard" && path.startsWith("/devis"));
                return (
                  <Link
                    key={n.to}
                    to={n.to}
                    className={`px-3 py-1.5 rounded-md text-sm transition-colors ${active ? "bg-brand-gold text-brand-maroon font-semibold" : "text-white/75 hover:text-white hover:bg-white/10"}`}
                  >
                    {t(n.key)}
                  </Link>
                );
              })}
            </nav>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5 text-white hover:bg-white/10 hover:text-white" aria-label={t("common.language")}>
                  <Globe className="size-4" />
                  <span className="text-xs font-semibold uppercase">{current}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setLang("fr")} className={current === "fr" ? "font-semibold" : ""}>
                  🇫🇷 Français
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLang("en")} className={current === "en" ? "font-semibold" : ""}>
                  🇬🇧 English
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
