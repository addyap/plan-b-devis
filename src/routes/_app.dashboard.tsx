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
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Download, FileText, Plus, Search, Sheet, TrendingUp, Wallet, Clock } from "lucide-react";
import { toast } from "sonner";
import { generateDevisPdf, type PdfClient, type PdfDevis, type PdfLine, type PdfProfile } from "@/lib/pdf";

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

type FactureLite = { devis_id: string | null };

const STATUS_STYLES: Record<DevisRow["status"], string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  accepted: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
  declined: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
  expired: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
};

function daysBetween(a: Date, b: Date) {
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

function Dashboard() {
  const { t, i18n } = useTranslation();
  const lang: Locale = i18n.resolvedLanguage?.startsWith("en") ? "en" : "fr";
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  type SortKey = "devis_number" | "client" | "issue_date" | "validity_until" | "total_ttc" | "status";
  const [sortKey, setSortKey] = useState<SortKey>("issue_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir(k === "total_ttc" || k === "issue_date" || k === "validity_until" ? "desc" : "asc"); }
  };

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

  const { data: factures } = useQuery({
    queryKey: ["factures-lite"],
    queryFn: async () => {
      const { data, error } = await supabase.from("factures").select("devis_id");
      if (error) throw error;
      return (data ?? []) as FactureLite[];
    },
  });

  const invoicedDevisIds = useMemo(
    () => new Set((factures ?? []).map((f) => f.devis_id).filter(Boolean) as string[]),
    [factures],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const arr = (data ?? []).filter((d) => {
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      if (!q) return true;
      return (
        d.devis_number.toLowerCase().includes(q) ||
        (d.client?.name ?? "").toLowerCase().includes(q)
      );
    });
    const dir = sortDir === "asc" ? 1 : -1;
    const get = (d: DevisRow) => {
      switch (sortKey) {
        case "client": return (d.client?.name ?? "").toLowerCase();
        case "total_ttc": return Number(d.total_ttc);
        case "devis_number": return d.devis_number;
        case "status": return d.status;
        case "validity_until": return d.validity_until;
        default: return d.issue_date;
      }
    };
    return [...arr].sort((a, b) => {
      const va = get(a), vb = get(b);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }, [data, statusFilter, search, sortKey, sortDir]);

  const yr = new Date().getFullYear();
  const rows = data ?? [];
  const acceptedThisYear = rows.filter(
    (d) => d.status === "accepted" && new Date(d.issue_date).getFullYear() === yr,
  );
  const acceptedTotal = acceptedThisYear.reduce((s, d) => s + Number(d.total_ttc), 0);

  // KPIs
  const pipelineValue = rows
    .filter((d) => d.status === "draft" || d.status === "sent")
    .reduce((s, d) => s + Number(d.total_ttc), 0);
  const sentCount = rows.filter((d) => d.status === "sent" || d.status === "accepted" || d.status === "declined").length;
  const acceptedCount = rows.filter((d) => d.status === "accepted").length;
  const winRate = sentCount > 0 ? Math.round((acceptedCount / sentCount) * 100) : 0;
  const readyToInvoice = rows.filter((d) => d.status === "accepted" && !invoicedDevisIds.has(d.id));
  const readyToInvoiceTotal = readyToInvoice.reduce((s, d) => s + Number(d.total_ttc), 0);

  // Expiring soon: sent, validity within 14 days
  const now = new Date();
  const expiringSoon = rows
    .filter((d) => d.status === "sent")
    .map((d) => ({ ...d, daysLeft: daysBetween(new Date(d.validity_until), now) }))
    .filter((d) => d.daysLeft >= 0 && d.daysLeft <= 14)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  // 12-month chart data (issued vs accepted, by issue_date)
  const chart = useMemo(() => {
    const months: { key: string; label: string; issued: number; accepted: number }[] = [];
    const base = new Date(now.getFullYear(), now.getMonth(), 1);
    for (let i = 11; i >= 0; i--) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR", { month: "short" }),
        issued: 0,
        accepted: 0,
      });
    }
    const idx = new Map(months.map((m, i) => [m.key, i]));
    for (const d of rows) {
      const dt = new Date(d.issue_date);
      const key = `${dt.getFullYear()}-${dt.getMonth()}`;
      const i = idx.get(key);
      if (i === undefined) continue;
      months[i].issued += Number(d.total_ttc);
      if (d.status === "accepted") months[i].accepted += Number(d.total_ttc);
    }
    return months;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, lang]);

  const chartMax = Math.max(1, ...chart.map((m) => Math.max(m.issued, m.accepted)));

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

  const downloadRow = async (devisId: string) => {
    const t0 = toast.loading("PDF…");
    try {
      const [{ data: dev, error: dErr }, { data: lns, error: lErr }, { data: prof, error: pErr }] = await Promise.all([
        supabase.from("devis").select("*, client:clients(*)").eq("id", devisId).maybeSingle(),
        supabase.from("devis_lines").select("*").eq("devis_id", devisId).order("position"),
        supabase.from("business_profile").select("*").limit(1).maybeSingle(),
      ]);
      if (dErr || lErr || pErr || !dev || !prof) throw new Error(dErr?.message || lErr?.message || pErr?.message || "Missing data");
      const pdfDevis: PdfDevis = {
        devis_number: dev.devis_number,
        issue_date: dev.issue_date,
        validity_until: dev.validity_until,
        language: (dev.language ?? "fr") as PdfDevis["language"],
        project_description: dev.project_description ?? null,
        project_start: dev.project_start ?? null,
        project_duration: dev.project_duration ?? null,
        subtotal_ht: Number(dev.subtotal_ht ?? 0),
        vat_amount: Number(dev.vat_amount ?? 0),
        total_ttc: Number(dev.total_ttc ?? 0),
        deposit_amount: dev.deposit_amount != null ? Number(dev.deposit_amount) : null,
        notes: dev.notes ?? null,
      };
      const pdfLines: PdfLine[] = (lns ?? []).map((l: any) => ({
        description: l.description,
        quantity: Number(l.quantity ?? 0),
        unit: l.unit ?? null,
        unit_price_ht: Number(l.unit_price_ht ?? 0),
        line_total_ht: Number(l.line_total_ht ?? 0),
      }));
      const pdfClient: PdfClient = dev.client
        ? {
            name: dev.client.name,
            contact_name: dev.client.contact_name ?? null,
            address_line1: dev.client.address_line1 ?? null,
            address_line2: dev.client.address_line2 ?? null,
            postcode: dev.client.postcode ?? null,
            city: dev.client.city ?? null,
            country: dev.client.country ?? null,
            email: dev.client.email ?? null,
            phone: dev.client.phone ?? null,
          }
        : null;
      const doc = await generateDevisPdf(pdfDevis, pdfLines, prof as PdfProfile, pdfClient);
      doc.save(`${dev.devis_number}.pdf`);
      toast.success("PDF", { id: t0 });
    } catch (e) {
      toast.error(`PDF: ${(e as Error).message}`, { id: t0 });
    }
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

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={<Wallet className="size-4" />}
          label={lang === "en" ? "Pipeline (draft + sent)" : "Pipeline (brouillon + envoyé)"}
          value={fmtEUR(pipelineValue, lang)}
          sub={`${rows.filter((d) => d.status === "draft" || d.status === "sent").length} ${lang === "en" ? "devis" : "devis"}`}
        />
        <KpiCard
          icon={<TrendingUp className="size-4" />}
          label={lang === "en" ? "Win rate" : "Taux d'acceptation"}
          value={`${winRate}%`}
          sub={`${acceptedCount}/${sentCount} ${lang === "en" ? "responded" : "répondus"}`}
        />
        <KpiCard
          icon={<FileText className="size-4" />}
          label={lang === "en" ? "Ready to invoice" : "À facturer"}
          value={fmtEUR(readyToInvoiceTotal, lang)}
          sub={`${readyToInvoice.length} ${lang === "en" ? "devis accepted" : "devis acceptés"}`}
          accent={readyToInvoice.length > 0}
        />
        <KpiCard
          icon={<Clock className="size-4" />}
          label={lang === "en" ? "Expiring ≤14d" : "Expire ≤14j"}
          value={String(expiringSoon.length)}
          sub={
            expiringSoon.length
              ? fmtEUR(expiringSoon.reduce((s, d) => s + Number(d.total_ttc), 0), lang)
              : "—"
          }
          accent={expiringSoon.length > 0}
        />
      </div>

      {/* Action lists + chart */}
      <div className="grid lg:grid-cols-3 gap-4">
        <ActionList
          title={lang === "en" ? "Expiring soon" : "Expirent bientôt"}
          icon={<AlertTriangle className="size-4 text-amber-600" />}
          empty={lang === "en" ? "Nothing expiring in 14 days." : "Aucun devis n'expire dans 14 jours."}
          items={expiringSoon.slice(0, 6).map((d) => ({
            id: d.id,
            primary: d.client?.name ?? d.devis_number,
            secondary: d.devis_number,
            right: (
              <div className="text-right">
                <div className="text-xs text-muted-foreground">{fmtDate(d.validity_until, lang)}</div>
                <div className={`text-xs font-medium ${d.daysLeft <= 3 ? "text-rose-600" : "text-amber-600"}`}>
                  {d.daysLeft === 0
                    ? lang === "en" ? "today" : "aujourd'hui"
                    : `${d.daysLeft}${lang === "en" ? "d" : "j"}`}
                </div>
              </div>
            ),
          }))}
          onOpen={(id) => navigate({ to: "/devis/$id", params: { id } })}
        />
        <ActionList
          title={lang === "en" ? "Ready to invoice" : "À facturer"}
          icon={<FileText className="size-4 text-emerald-600" />}
          empty={lang === "en" ? "No accepted devis awaiting invoicing." : "Aucun devis accepté à facturer."}
          items={readyToInvoice.slice(0, 6).map((d) => ({
            id: d.id,
            primary: d.client?.name ?? d.devis_number,
            secondary: d.devis_number,
            right: (
              <div className="text-right text-sm font-medium tabular-nums">
                {fmtEUR(Number(d.total_ttc), lang)}
              </div>
            ),
          }))}
          onOpen={(id) => navigate({ to: "/devis/$id", params: { id } })}
        />
        <div className="border rounded-xl bg-card p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="size-4 text-muted-foreground" />
            <h3 className="font-medium text-sm">
              {lang === "en" ? "Last 12 months" : "12 derniers mois"}
            </h3>
          </div>
          <div className="flex items-end gap-1.5 h-32">
            {chart.map((m) => (
              <div key={m.key} className="flex-1 flex flex-col items-center gap-1 group">
                <div className="w-full flex items-end justify-center gap-0.5 flex-1" title={`${m.label} — ${lang === "en" ? "Issued" : "Émis"}: ${fmtEUR(m.issued, lang)} · ${lang === "en" ? "Accepted" : "Acceptés"}: ${fmtEUR(m.accepted, lang)}`}>
                  <div
                    className="w-1/2 bg-muted rounded-t"
                    style={{ height: `${(m.issued / chartMax) * 100}%`, minHeight: m.issued > 0 ? 2 : 0 }}
                  />
                  <div
                    className="w-1/2 bg-primary rounded-t"
                    style={{ height: `${(m.accepted / chartMax) * 100}%`, minHeight: m.accepted > 0 ? 2 : 0 }}
                  />
                </div>
                <div className="text-[10px] text-muted-foreground">{m.label}</div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-muted inline-block" /> {lang === "en" ? "Issued" : "Émis"}</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-primary inline-block" /> {lang === "en" ? "Accepted" : "Acceptés"}</span>
          </div>
        </div>
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
        <Button
          variant="outline"
          onClick={() => exportCsv(filtered, lang)}
          disabled={filtered.length === 0}
        >
          <Sheet className="size-4" /> {lang === "en" ? "Export CSV" : "Exporter CSV"}
        </Button>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block border rounded-xl overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <SortableTh label={t("dashboard.col_number")} k="devis_number" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
              <SortableTh label={t("dashboard.col_client")} k="client" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
              <SortableTh label={t("dashboard.col_issue")} k="issue_date" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
              <SortableTh label={t("dashboard.col_validity")} k="validity_until" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
              <SortableTh label={t("dashboard.col_total")} k="total_ttc" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
              <SortableTh label={t("dashboard.col_status")} k="status" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
              <th className="px-4 py-3 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">{t("dashboard.empty")}</td></tr>
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
                <td className="px-2 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t("devis.pdf")}
                    title={t("devis.pdf")}
                    onClick={() => downloadRow(d.id)}
                  >
                    <Download className="size-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground border rounded-xl bg-card">{t("dashboard.empty")}</div>
        )}
        {filtered.map((d) => (
          <div
            key={d.id}
            className="border rounded-xl bg-card p-4 active:bg-muted/50 cursor-pointer"
            onClick={() => navigate({ to: "/devis/$id", params: { id: d.id } })}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-mono text-xs text-muted-foreground">{d.devis_number}</div>
                <div className="font-medium truncate">{d.client?.name ?? "—"}</div>
              </div>
              <Badge className={STATUS_STYLES[d.status]} variant="secondary">{t(`status.${d.status}`)}</Badge>
            </div>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                <div>{fmtDate(d.issue_date, lang)}</div>
                <div>→ {fmtDate(d.validity_until, lang)}</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold tabular-nums">{fmtEUR(Number(d.total_ttc), lang)}</div>
              </div>
            </div>
            <div className="mt-3 flex justify-end" onClick={(e) => e.stopPropagation()}>
              <Button variant="outline" size="sm" onClick={() => downloadRow(d.id)}>
                <Download className="size-4" /> {t("devis.pdf")}
              </Button>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className={`border rounded-xl bg-card p-4 ${accent ? "ring-1 ring-primary/40" : ""}`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1 truncate">{sub}</div>}
    </div>
  );
}

function ActionList({
  title,
  icon,
  items,
  empty,
  onOpen,
}: {
  title: string;
  icon: React.ReactNode;
  items: { id: string; primary: string; secondary: string; right: React.ReactNode }[];
  empty: string;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="border rounded-xl bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="font-medium text-sm">{title}</h3>
        <span className="ml-auto text-xs text-muted-foreground">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="text-xs text-muted-foreground py-6 text-center">{empty}</div>
      ) : (
        <ul className="divide-y">
          {items.map((it) => (
            <li
              key={it.id}
              className="py-2 flex items-center gap-3 cursor-pointer hover:bg-muted/40 -mx-2 px-2 rounded"
              onClick={() => onOpen(it.id)}
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{it.primary}</div>
                <div className="text-xs text-muted-foreground font-mono">{it.secondary}</div>
              </div>
              {it.right}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SortableTh({
  label,
  k,
  sortKey,
  sortDir,
  onClick,
  align = "left",
}: {
  label: string;
  k: "devis_number" | "client" | "issue_date" | "validity_until" | "total_ttc" | "status";
  sortKey: string;
  sortDir: "asc" | "desc";
  onClick: (k: any) => void;
  align?: "left" | "right";
}) {
  const active = sortKey === k;
  const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className={`px-4 py-3 ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        type="button"
        onClick={() => onClick(k)}
        className={`inline-flex items-center gap-1 uppercase tracking-wide text-xs hover:text-foreground ${active ? "text-foreground" : ""}`}
      >
        {label}
        <Icon className="size-3" />
      </button>
    </th>
  );
}

function exportCsv(
  rows: {
    devis_number: string;
    client: { name: string } | null;
    issue_date: string;
    validity_until: string;
    total_ttc: number;
    status: string;
  }[],
  lang: "en" | "fr",
) {
  const header = lang === "en"
    ? ["Number", "Client", "Issued", "Valid until", "Total TTC (EUR)", "Status"]
    : ["Numéro", "Client", "Émis le", "Valide jusqu'au", "Total TTC (EUR)", "Statut"];
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [header.map(esc).join(",")];
  for (const r of rows) {
    lines.push([
      r.devis_number,
      r.client?.name ?? "",
      r.issue_date,
      r.validity_until,
      Number(r.total_ttc).toFixed(2),
      r.status,
    ].map((v) => esc(String(v))).join(","));
  }
  const csv = "\uFEFF" + lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `devis-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
