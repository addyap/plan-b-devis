import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { fmtEUR, fmtDate, type Locale } from "@/lib/format";

export const Route = createFileRoute("/_app/factures")({
  component: FacturesPage,
});

type Row = {
  id: string; facture_number: string; issue_date: string; due_date: string;
  total_ttc: number; status: "draft"|"sent"|"paid"|"overdue"|"cancelled";
  client: { name: string } | null;
};

const STATUS: Record<Row["status"], string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-100 text-blue-900",
  paid: "bg-green-100 text-green-900",
  overdue: "bg-red-100 text-red-900",
  cancelled: "bg-zinc-200 text-zinc-700",
};

function FacturesPage() {
  const { t, i18n } = useTranslation();
  const lang: Locale = i18n.resolvedLanguage?.startsWith("en") ? "en" : "fr";
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  useEffect(() => {
    supabase.from("factures")
      .select("id, facture_number, issue_date, due_date, total_ttc, status, client:clients(name)")
      .order("issue_date", { ascending: false })
      .then(({ data }) => setRows((data ?? []) as unknown as Row[]));
  }, []);
  const filtered = rows.filter((r) =>
    !search || r.facture_number.toLowerCase().includes(search.toLowerCase()) || r.client?.name?.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{t("factures.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("factures.subtitle")}</p>
        </div>
        <Input placeholder={t("common.search")} value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
      </div>
      <Card className="hidden md:block overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left p-3">{t("factures.col_number")}</th>
              <th className="text-left p-3">{t("factures.col_client")}</th>
              <th className="text-left p-3">{t("factures.col_issued")}</th>
              <th className="text-left p-3">{t("factures.col_due")}</th>
              <th className="text-right p-3">{t("factures.col_total")}</th>
              <th className="text-left p-3">{t("factures.col_status")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t hover:bg-accent/50">
                <td className="p-3 font-mono"><Link to="/factures/$id" params={{ id: r.id }} className="text-primary hover:underline">{r.facture_number}</Link></td>
                <td className="p-3">{r.client?.name ?? "—"}</td>
                <td className="p-3">{fmtDate(r.issue_date, lang)}</td>
                <td className="p-3">{fmtDate(r.due_date, lang)}</td>
                <td className="p-3 text-right tabular-nums">{fmtEUR(r.total_ttc, lang)}</td>
                <td className="p-3"><Badge className={STATUS[r.status]} variant="secondary">{t(`status.${r.status}`)}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="md:hidden space-y-3">
        {filtered.map((r) => (
          <Link key={r.id} to="/factures/$id" params={{ id: r.id }} className="block border rounded-xl bg-card p-4 active:bg-muted/50">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-mono text-xs text-muted-foreground">{r.facture_number}</div>
                <div className="font-medium truncate">{r.client?.name ?? "—"}</div>
              </div>
              <Badge className={STATUS[r.status]} variant="secondary">{t(`status.${r.status}`)}</Badge>
            </div>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                <div>{fmtDate(r.issue_date, lang)}</div>
                <div>→ {fmtDate(r.due_date, lang)}</div>
              </div>
              <div className="text-lg font-semibold tabular-nums">{fmtEUR(r.total_ttc, lang)}</div>
            </div>
          </Link>
        ))}
      </div>

    </div>
  );
}
