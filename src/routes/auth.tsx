import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Globe, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import brandLogo from "@/assets/plan-b-logo.png";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Plan B Côte d'Azur — Connexion" },
      { name: "robots", content: "noindex, nofollow, noarchive" },
    ],
  }),
  component: AuthPage,
});

type Lang = "fr" | "en";

const T = {
  title: { fr: "Connexion", en: "Sign in" },
  subtitle: {
    fr: "Espace privé Plan B Côte d'Azur",
    en: "Plan B Côte d'Azur — private workspace",
  },
  email: { fr: "Adresse e-mail", en: "Email address" },
  password: { fr: "Mot de passe", en: "Password" },
  submit: { fr: "Se connecter", en: "Sign in" },
  loading: { fr: "Connexion…", en: "Signing in…" },
  forgot: { fr: "Mot de passe oublié ?", en: "Forgot password?" },
  reset_sent: {
    fr: "E-mail envoyé. Vérifiez votre boîte de réception.",
    en: "Email sent. Check your inbox.",
  },
  reset_need_email: {
    fr: "Saisissez d'abord votre adresse e-mail.",
    en: "Enter your email address first.",
  },
  no_signup: {
    fr: "Accès sur invitation uniquement.",
    en: "Access by invitation only.",
  },
  bad_credentials: {
    fr: "E-mail ou mot de passe incorrect.",
    en: "Invalid email or password.",
  },
};

function AuthPage() {
  const navigate = useNavigate();
  const [lang, setLang] = useState<Lang>("fr");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ kind: "err" | "ok"; text: string } | null>(null);

  // Already signed-in → bounce to dashboard
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) navigate({ to: "/dashboard", replace: true });
    });
    return () => { active = false; };
  }, [navigate]);

  const t = (k: keyof typeof T) => T[k][lang];

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      const text = /invalid|credentials/i.test(error.message) ? t("bad_credentials") : error.message;
      setMsg({ kind: "err", text });
      return;
    }
    navigate({ to: "/dashboard", replace: true });
  };

  const onReset = async () => {
    setMsg(null);
    if (!email.trim()) { setMsg({ kind: "err", text: t("reset_need_email") }); return; }
    const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/auth` : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    if (error) setMsg({ kind: "err", text: error.message });
    else setMsg({ kind: "ok", text: t("reset_sent") });
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col">
      <div className="absolute top-3 right-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5" aria-label="Language">
              <Globe className="size-4" />
              <span className="text-xs font-semibold uppercase">{lang}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setLang("fr")}>🇫🇷 Français</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLang("en")}>🇬🇧 English</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <main className="flex-1 grid place-items-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="size-20 rounded-md overflow-hidden bg-[#2E1011] p-2 shadow ring-1 ring-white/10">
              <img src={brandLogo} alt="Plan B Côte d'Azur" className="size-full object-contain" />
            </div>
            <h1 className="mt-5 text-2xl font-serif font-semibold tracking-tight text-foreground">{t("title")}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4 bg-card text-card-foreground border border-border rounded-2xl p-6 shadow-sm">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs">{t("email")}</Label>
              <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs">{t("password")}</Label>
              <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>

            {msg && (
              <div className={`text-xs rounded-md px-3 py-2 ${msg.kind === "err" ? "bg-[#9B2E2A]/10 text-[#9B2E2A]" : "bg-emerald-50 text-emerald-700"}`}>
                {msg.text}
              </div>
            )}

            <Button type="submit" className="w-full bg-[#F2CB3C] text-[#2E1011] hover:bg-[#F2CB3C]/90" disabled={loading}>
              {loading ? <><Loader2 className="size-4 animate-spin" /> {t("loading")}</> : t("submit")}
            </Button>

            <button type="button" onClick={onReset} className="block w-full text-center text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline">
              {t("forgot")}
            </button>
          </form>

          
        </div>
      </main>
    </div>
  );
}
