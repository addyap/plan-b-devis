import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

function AuthPage() {
  const { session, loading } = useSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard", replace: true });
  }, [loading, session, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    let { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error && /invalid login credentials/i.test(error.message)) {
      // First-time setup: create the owner account, then sign in
      const up = await supabase.auth.signUp({ email, password });
      if (up.error) {
        toast.error(up.error.message);
        setSubmitting(false);
        return;
      }
      const second = await supabase.auth.signInWithPassword({ email, password });
      error = second.error;
    }
    if (error) {
      toast.error(error.message);
    } else {
      navigate({ to: "/dashboard", replace: true });
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-10 text-primary-foreground">
          <div className="mx-auto size-16 rounded-xl bg-primary-foreground/10 border border-primary-foreground/20 flex items-center justify-center mb-5">
            <span className="text-2xl font-bold tracking-widest">PB</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Plan B Concept</h1>
          <p className="text-sm text-primary-foreground/70 mt-1 tracking-wide uppercase">
            Côte d'Azur — Devis Generator
          </p>
        </div>
        <form onSubmit={submit} className="bg-card rounded-xl p-8 space-y-5 shadow-2xl">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
