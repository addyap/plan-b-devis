import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Globe, FileText, Receipt, Users, Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { persistLocale } from "@/i18n";
import logoUrl from "@/assets/plan-b-logo.png";

const NAV = [
  { to: "/dashboard", key: "nav.devis", Icon: FileText },
  { to: "/factures", key: "nav.factures", Icon: Receipt },
  { to: "/clients", key: "nav.clients", Icon: Users },
  { to: "/settings", key: "nav.settings", Icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { t, i18n } = useTranslation();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setHydrated(true); }, []);

  const setLang = (lng: "fr" | "en") => { persistLocale(lng); void i18n.changeLanguage(lng); };
  const active = (i18n.resolvedLanguage ?? i18n.language ?? "fr").startsWith("fr") ? "fr" : "en";
  const current = hydrated ? active : "fr";

  const isActive = (to: string) =>
    path.startsWith(to) || (to === "/dashboard" && path.startsWith("/devis"));

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-brand-maroon-dark bg-brand-maroon text-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-3">
          <Link to="/dashboard" className="flex items-center gap-3 min-w-0">
            <div className="size-10 sm:size-14 shrink-0 rounded-md overflow-hidden shadow-sm">
              <img src={logoUrl} alt="Plan B Côte d'Azur" className="size-full object-contain" />
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <nav className="hidden md:flex items-center gap-1">
              {NAV.map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`px-3 py-1.5 rounded-md text-sm transition-colors ${isActive(n.to) ? "bg-brand-gold text-brand-maroon font-semibold" : "text-white/75 hover:text-white hover:bg-white/10"}`}
                >
                  <span suppressHydrationWarning>{t(n.key)}</span>
                </Link>
              ))}
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

      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-5 sm:py-8 pb-32 md:pb-8">{children}</main>

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-brand-maroon text-white border-t border-brand-maroon-dark shadow-lg"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid grid-cols-4">
          {NAV.map(({ to, key, Icon }) => {
            const a = isActive(to);
            return (
              <Link
                key={to}
                to={to}
                className={`flex flex-col items-center justify-center gap-1 py-2.5 min-h-14 text-[11px] ${a ? "text-brand-gold font-semibold" : "text-white/75"}`}
              >
                <Icon className="size-5" />
                <span suppressHydrationWarning className="leading-none">{t(key)}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
