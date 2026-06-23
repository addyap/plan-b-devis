import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { fmtDate, fmtEUR, todayISO, type Locale } from "@/lib/format";
import { Plus, Search } from "lucide-react";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

type DevisRow = {
  id: string;
  devis_number: string;
  issue_date: string;
  validity_until: string;
  total_ttc: number;
  status: "draft" | "sent" | "accepted" | "declined" | "expired";
  client: { name: string } | null;
};

const STATUS_STYLES: Record<DevisRow["status"], string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  accepted: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
  declined: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
  expired: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
};

function Dashboard() {
  const { t, i18n } = useTranslation();
  const lang: Locale = i18n.resolvedLanguage?.startsWith("en") ? "en" : "fr";
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    supabase
      .from("devis")
      .update({ status: "expired" })
      .lt("validity_until", todayISO())
      .in("status", ["draft", "sent"])
      .then(() => {});
  }, []);

  const { data, refetch } = useQuery({
    queryKey: ["devis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("devis")
        .select("id, devis_number, issue_date, validity_until, total_ttc, status, client:clients(name)")
        .order("issue_date", { ascending: false });
      if (error) throw error;
      return data as unknown as DevisRow[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((d) => {
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      if (!q) return true;
      return (
        d.devis_number.toLowerCase().includes(q) ||
        (d.client?.name ?? "").toLowerCase().includes(q)
      );
    });
  }, [data, statusFilter, search]);

  const yr = new Date().getFullYear();
  const acceptedThisYear = (data ?? []).filter(
    (d) => d.status === "accepted" && new Date(d.issue_date).getFullYear() === yr,
  );
  const acceptedTotal = acceptedThisYear.reduce((s, d) => s + Number(d.total_ttc), 0);

  const newDevis = async () => {
    const { data: numData } = await supabase.rpc("next_devis_number");
    const { data: profile } = await supabase
      .from("business_profile")
      .select("default_validity_days")
      .maybeSingle();
    const validity = profile?.default_validity_days ?? 90;
    const issue = todayISO();
    const until = new Date(issue);
    until.setDate(until.getDate() + validity);
    const { data: created, error } = await supabase
      .from("devis")
      .insert({
        devis_number: numData as string,
        issue_date: issue,
        validity_until: until.toISOString().slice(0, 10),
      })
      .select("id")
      .single();
    if (error) return;
    navigate({ to: "/devis/$id", params: { id: created.id } });
    refetch();
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{t("dashboard.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("dashboard.subtitle_one", {
              count: acceptedThisYear.length,
              year: yr,
              total: fmtEUR(acceptedTotal, lang),
            })}
          </p>
        </div>
        <Button onClick={newDevis} size="lg">
          <Plus className="size-4" /> {t("dashboard.new")}
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder={t("dashboard.search_placeholder")}
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("dashboard.all_statuses")}</SelectItem>
            <SelectItem value="draft">{t("status.draft")}</SelectItem>
            <SelectItem value="sent">{t("status.sent")}</SelectItem>
            <SelectItem value="accepted">{t("status.accepted")}</SelectItem>
            <SelectItem value="declined">{t("status.declined")}</SelectItem>
            <SelectItem value="expired">{t("status.expired")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-xl overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">{t("dashboard.col_number")}</th>
              <th className="text-left px-4 py-3">{t("dashboard.col_client")}</th>
              <th className="text-left px-4 py-3">{t("dashboard.col_issue")}</th>
              <th className="text-left px-4 py-3">{t("dashboard.col_validity")}</th>
              <th className="text-right px-4 py-3">{t("dashboard.col_total")}</th>
              <th className="text-left px-4 py-3">{t("dashboard.col_status")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">{t("dashboard.empty")}</td></tr>
            )}
            {filtered.map((d) => (
              <tr key={d.id} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => navigate({ to: "/devis/$id", params: { id: d.id } })}>
                <td className="px-4 py-3 font-mono text-xs">
                  <Link to="/devis/$id" params={{ id: d.id }} className="hover:underline">{d.devis_number}</Link>
                </td>
                <td className="px-4 py-3">{d.client?.name ?? <span className="text-muted-foreground">—</span>}</td>
                <td className="px-4 py-3">{fmtDate(d.issue_date, lang)}</td>
                <td className="px-4 py-3">{fmtDate(d.validity_until, lang)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{fmtEUR(Number(d.total_ttc), lang)}</td>
                <td className="px-4 py-3">
                  <Badge className={STATUS_STYLES[d.status]} variant="secondary">{t(`status.${d.status}`)}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
