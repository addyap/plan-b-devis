import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import brandLogo from "@/assets/plan-b-logo.png";
import { L, type Lang } from "@/lib/i18n";
import { Download, Loader2 } from "lucide-react";
import {
  generateDevisPdf,
  type PdfClient,
  type PdfDevis,
  type PdfLine,
  type PdfProfile,
  type SchedulePdfRow,
} from "@/lib/pdf";

export const Route = createFileRoute("/v/$id")({
  head: () => ({
    meta: [
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "robots", content: "noindex, nofollow, noarchive" },
      { title: "Plan B Côte d'Azur — Devis" },
    ],
  }),
  component: PublicDevisView,
});

// ---------- Types (kept self-contained for this public route) ----------

type LineType = "produit" | "prestation" | "forfait" | "moe" | "remise";
type DiscountType = "percent" | "amount";
type PricingMode = "amount" | "percent";

type ScheduleRow = {
  label: string;
  mode: DiscountType;
  value: number;
  milestone: string;
};

type Line = {
  line_type: LineType;
  description: string;
  details: string | null;
  quantity: number;
  unit: string | null;
  unit_price_ht: number;
  discount_type: DiscountType;
  discount_value: number;
  vat_rate: number;
  sort_order: number;
  mission_code: string | null;
  pricing_mode: PricingMode;
  percent_of_budget: number;
};

type Devis = {
  id: string;
  devis_number: string;
  client_id: string | null;
  issue_date: string;
  validity_until: string;
  status: string;
  language: Lang;
  project_description: string | null;
  project_start: string | null;
  project_duration: string | null;
  notes: string | null;
  global_discount_type: DiscountType;
  global_discount_value: number;
  deposit_type: DiscountType;
  deposit_value: number;
  payment_terms_preset: string | null;
  payment_methods: string[];
  conditions_notes: string | null;
  legal_mentions: string[];
  project_name: string | null;
  site_address_line1: string | null;
  site_address_line2: string | null;
  site_postcode: string | null;
  site_city: string | null;
  site_country: string | null;
  operation_type: string | null;
  surface_m2: number | null;
  works_budget_ht: number | null;
  mission_phases: string[];
  payment_schedule: ScheduleRow[];
};

type Client = {
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postcode: string | null;
  city: string | null;
  country: string | null;
  siret: string | null;
  vat_number: string | null;
};

// ---------- Math (mirrors the editor's computeTotals) ----------

function lineNetHT(l: Pick<Line, "quantity" | "unit_price_ht" | "discount_type" | "discount_value" | "line_type">) {
  const gross = Number(l.quantity || 0) * Number(l.unit_price_ht || 0);
  const sign = l.line_type === "remise" ? -1 : 1;
  const base = Math.abs(gross);
  const disc = l.discount_type === "percent"
    ? base * (Number(l.discount_value || 0) / 100)
    : Number(l.discount_value || 0);
  return +(sign * Math.max(0, base - disc)).toFixed(2);
}

function computeTotals(lines: Line[], d: Devis) {
  const linesNet = lines.map(l => ({ vat: Number(l.vat_rate || 0), net: lineNetHT(l) }));
  const subtotalHT = +linesNet.reduce((s, x) => s + x.net, 0).toFixed(2);
  const positiveNet = linesNet.reduce((s, x) => (x.net > 0 ? s + x.net : s), 0);
  const globalDiscAmt = positiveNet === 0 ? 0
    : d.global_discount_type === "percent"
      ? +(positiveNet * (Number(d.global_discount_value || 0) / 100)).toFixed(2)
      : Math.min(Number(d.global_discount_value || 0), positiveNet);
  const factor = positiveNet === 0 ? 1 : Math.max(0, 1 - globalDiscAmt / positiveNet);

  const vatByRate = new Map<number, number>();
  let netAfter = 0;
  for (const x of linesNet) {
    const adjusted = x.net > 0 ? +(x.net * factor).toFixed(2) : x.net;
    netAfter += adjusted;
    const vatLine = +(adjusted * (x.vat / 100)).toFixed(2);
    vatByRate.set(x.vat, +((vatByRate.get(x.vat) ?? 0) + vatLine).toFixed(2));
  }
  netAfter = +netAfter.toFixed(2);
  const totalVAT = +Array.from(vatByRate.values()).reduce((s, v) => s + v, 0).toFixed(2);
  const totalTTC = +(netAfter + totalVAT).toFixed(2);

  const depositAmount = d.deposit_type === "percent"
    ? +(totalTTC * (Number(d.deposit_value || 0) / 100)).toFixed(2)
    : Math.min(Number(d.deposit_value || 0), totalTTC);
  const balance = +(totalTTC - depositAmount).toFixed(2);

  return {
    subtotalHT, globalDiscAmt, netAfterDiscount: netAfter,
    vatByRate: Array.from(vatByRate.entries()).filter(([, v]) => v !== 0).sort((a, b) => a[0] - b[0]),
    totalVAT, totalTTC, depositAmount, balance,
  };
}

// ---------- Formatting ----------

const locale = (l: Lang) => (l === "fr" ? "fr-FR" : "en-GB");
const money = (n: number, l: Lang) =>
  new Intl.NumberFormat(locale(l), { style: "currency", currency: "EUR" }).format(Number(n || 0));
const dateF = (d: string | null | undefined, l: Lang) =>
  d ? new Intl.DateTimeFormat(locale(l), { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(d)) : "—";

// ---------- Static i18n bits specific to this view ----------

const T = {
  yourQuote: { fr: "Votre devis", en: "Your quote" },
  issuedBy: { fr: "Établi par", en: "Issued by" },
  forClient: { fr: "Pour", en: "For" },
  project: { fr: "Projet", en: "Project" },
  site: { fr: "Chantier", en: "Site" },
  operation: { fr: "Nature de l'opération", en: "Operation" },
  surface: { fr: "Surface", en: "Surface" },
  works: { fr: "Montant des travaux HT", en: "Works budget (excl. VAT)" },
  phases: { fr: "Phases de mission", en: "Mission phases" },
  items: { fr: "Détail des prestations", en: "Items" },
  totals: { fr: "Récapitulatif", en: "Summary" },
  subtotal: { fr: "Sous-total HT", en: "Subtotal (excl. VAT)" },
  discount: { fr: "Remise globale", en: "Global discount" },
  netHt: { fr: "Net HT", en: "Net (excl. VAT)" },
  vat: { fr: "TVA", en: "VAT" },
  totalTTC: { fr: "Total TTC", en: "Total (incl. VAT)" },
  deposit: { fr: "Acompte à la commande", en: "Deposit on order" },
  balance: { fr: "Solde", en: "Balance" },
  schedule: { fr: "Échéancier de paiement", en: "Payment schedule" },
  milestone: { fr: "Jalon", en: "Milestone" },
  amount: { fr: "Montant", en: "Amount" },
  paymentMethods: { fr: "Modes de règlement acceptés", en: "Accepted payment methods" },
  paymentTerms: { fr: "Conditions de règlement", en: "Payment terms" },
  conditions: { fr: "Conditions particulières", en: "Special conditions" },
  notes: { fr: "Notes", en: "Notes" },
  legal: { fr: "Mentions légales", en: "Legal notices" },
  validity: { fr: "Validité", en: "Validity" },
  issued: { fr: "Émis le", en: "Issued on" },
  validUntil: { fr: "Valable jusqu'au", en: "Valid until" },
  qty: { fr: "Qté", en: "Qty" },
  unitPrice: { fr: "PU HT", en: "Unit price" },
  lineTotal: { fr: "Total HT", en: "Line total" },
  download: { fr: "Télécharger le PDF", en: "Download PDF" },
  generating: { fr: "Génération…", en: "Generating…" },
  notFound: { fr: "Devis introuvable.", en: "Quote not found." },
  loading: { fr: "Chargement…", en: "Loading…" },
  honoraires: { fr: "Total honoraires HT", en: "Total fees (excl. VAT)" },
  ofWorks: { fr: "du montant des travaux", en: "of works budget" },
  pctOfTotal: { fr: "du total TTC", en: "of total" },
};
const tt = (k: keyof typeof T, l: Lang) => T[k][l];

const UNIT_LABEL: Record<string, { fr: string; en: string }> = {
  unite: { fr: "u.", en: "u." },
  heure: { fr: "h", en: "h" },
  jour: { fr: "j", en: "d" },
  m2: { fr: "m²", en: "m²" },
  m3: { fr: "m³", en: "m³" },
  ml: { fr: "ml", en: "lm" },
  forfait: { fr: "forfait", en: "flat" },
  lot: { fr: "lot", en: "lot" },
};

const MISSION_LABELS: Record<string, { fr: string; en: string }> = {
  ESQ: { fr: "Esquisse", en: "Preliminary sketch" },
  APS: { fr: "Avant-Projet Sommaire", en: "Outline design" },
  APD: { fr: "Avant-Projet Définitif", en: "Detailed design" },
  PRO: { fr: "Projet", en: "Project design" },
  ACT: { fr: "Assistance Contrats de Travaux", en: "Tender assistance" },
  VISA: { fr: "Visa des études d'exécution", en: "Execution studies review" },
  DET: { fr: "Direction de l'Exécution des Travaux", en: "Works supervision" },
  AOR: { fr: "Assistance aux Opérations de Réception", en: "Handover assistance" },
};

const OPERATION_LABELS: Record<string, { fr: string; en: string }> = {
  neuf: { fr: "Construction neuve", en: "New construction" },
  renov: { fr: "Rénovation", en: "Renovation" },
  extension: { fr: "Extension", en: "Extension" },
  reamenagement: { fr: "Réaménagement", en: "Reconfiguration" },
  interieur: { fr: "Aménagement intérieur", en: "Interior fit-out" },
  autre: { fr: "Autre", en: "Other" },
};

const PAYMENT_METHOD_LABELS: Record<string, { fr: string; en: string }> = {
  transfer: { fr: "Virement bancaire", en: "Bank transfer" },
  check: { fr: "Chèque", en: "Cheque" },
  card: { fr: "Carte bancaire", en: "Card" },
  cash: { fr: "Espèces", en: "Cash" },
};

const PAYMENT_TERMS_LABELS: Record<string, { fr: string; en: string }> = {
  cash: { fr: "Paiement comptant à réception", en: "Payment due on receipt" },
  "30d": { fr: "Paiement à 30 jours fin de mois", en: "Net 30 days end of month" },
  "5050": { fr: "50% à la commande, 50% à la livraison", en: "50% on order, 50% on delivery" },
  custom: { fr: "Conditions personnalisées", en: "Custom terms" },
};

const LEGAL_MENTION_LABELS: Record<string, { fr: string; en: string }> = {
  free: {
    fr: "Devis gratuit, non contractuel jusqu'à acceptation signée.",
    en: "Free quote, non-binding until signed acceptance.",
  },
  vat293b: {
    fr: "TVA non applicable, article 293 B du CGI.",
    en: "VAT not applicable, article 293 B of the French CGI.",
  },
  late: {
    fr: "Pénalités de retard : 3 fois le taux d'intérêt légal. Indemnité forfaitaire pour frais de recouvrement : 40 €.",
    en: "Late payment penalties: three times the legal interest rate. Fixed recovery cost indemnity: €40.",
  },
  discount: {
    fr: "Pas d'escompte pour règlement anticipé.",
    en: "No discount for early payment.",
  },
};

// ---------- Component ----------

function PublicDevisView() {
  const { id } = Route.useParams();
  const [devis, setDevis] = useState<Devis | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [client, setClient] = useState<Client | null>(null);
  const [profile, setProfile] = useState<PdfProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    (async () => {
      const [d, l, p] = await Promise.all([
        supabase.from("devis").select("*").eq("id", id).maybeSingle(),
        supabase.from("devis_lines").select("*").eq("devis_id", id).order("sort_order"),
        supabase.from("business_profile").select("*").limit(1).maybeSingle(),
      ]);
      const dd = d.data as any;
      if (!dd) { setNotFound(true); setLoading(false); return; }
      const lang: Lang = dd.language === "en" ? "en" : "fr";
      setDevis({
        ...dd,
        language: lang,
        global_discount_value: Number(dd.global_discount_value ?? 0),
        deposit_value: Number(dd.deposit_value ?? 0),
        works_budget_ht: dd.works_budget_ht != null ? Number(dd.works_budget_ht) : null,
        surface_m2: dd.surface_m2 != null ? Number(dd.surface_m2) : null,
        payment_methods: dd.payment_methods ?? [],
        legal_mentions: dd.legal_mentions ?? [],
        mission_phases: dd.mission_phases ?? [],
        payment_schedule: Array.isArray(dd.payment_schedule) ? dd.payment_schedule : [],
      } as Devis);
      setLines(((l.data ?? []) as any[]).map(x => ({
        line_type: (x.line_type ?? "prestation") as LineType,
        description: x.description ?? "",
        details: x.details ?? null,
        quantity: Number(x.quantity ?? 1),
        unit: x.unit ?? "forfait",
        unit_price_ht: Number(x.unit_price_ht ?? 0),
        discount_type: (x.discount_type ?? "percent") as DiscountType,
        discount_value: Number(x.discount_value ?? 0),
        vat_rate: Number(x.vat_rate ?? 20),
        sort_order: Number(x.sort_order ?? 0),
        mission_code: x.mission_code ?? null,
        pricing_mode: (x.pricing_mode ?? "amount") as PricingMode,
        percent_of_budget: Number(x.percent_of_budget ?? 0),
      })));
      if (dd.client_id) {
        const c = await supabase.from("clients").select("*").eq("id", dd.client_id).maybeSingle();
        setClient((c.data as Client) ?? null);
      }
      setProfile((p.data as unknown as PdfProfile) ?? null);
      setLoading(false);
    })();
  }, [id]);

  const lang: Lang = devis?.language ?? "fr";

  // Resolve % MOE lines against works budget
  const linesView = useMemo<Line[]>(() => {
    if (!devis) return [];
    const b = Number(devis.works_budget_ht || 0);
    return lines.map(l =>
      l.pricing_mode === "percent"
        ? { ...l, unit_price_ht: +(b * (Number(l.percent_of_budget || 0) / 100)).toFixed(2), quantity: 1, unit: "forfait" }
        : l,
    );
  }, [lines, devis?.works_budget_ht]);

  const totals = useMemo(() => devis ? computeTotals(linesView, devis) : null, [linesView, devis]);

  const honorairesHT = useMemo(
    () => +linesView.filter(l => l.line_type === "moe").reduce((s, l) => s + lineNetHT(l), 0).toFixed(2),
    [linesView],
  );
  const honorairesPct = useMemo(() => {
    const b = Number(devis?.works_budget_ht || 0);
    return b > 0 ? +((honorairesHT / b) * 100).toFixed(2) : 0;
  }, [honorairesHT, devis?.works_budget_ht]);

  const downloadPdf = async () => {
    if (!devis || !profile || !totals) return;
    setDownloading(true);
    try {
      const pdfLines: PdfLine[] = linesView.map(l => ({
        description: [l.mission_code, l.description].filter(Boolean).join(" — "),
        quantity: l.quantity,
        unit: l.unit,
        unit_price_ht: l.unit_price_ht,
        line_total_ht: lineNetHT(l),
      }));
      const site = [devis.site_address_line1, devis.site_address_line2, [devis.site_postcode, devis.site_city].filter(Boolean).join(" "), devis.site_country]
        .filter(Boolean).join(", ") || null;
      const schedule: SchedulePdfRow[] = (devis.payment_schedule ?? []).map(r => {
        const amt = r.mode === "percent"
          ? +(totals.totalTTC * (Number(r.value || 0) / 100)).toFixed(2)
          : Number(r.value || 0);
        const pct = totals.totalTTC > 0 ? +((amt / totals.totalTTC) * 100).toFixed(2) : 0;
        return { label: r.label, milestone: r.milestone, amount: amt, pct };
      });
      const pdfDevis: PdfDevis = {
        devis_number: devis.devis_number,
        issue_date: devis.issue_date,
        validity_until: devis.validity_until,
        language: lang,
        project_description: devis.project_description,
        project_start: devis.project_start,
        project_duration: devis.project_duration,
        subtotal_ht: totals.netAfterDiscount,
        vat_amount: totals.totalVAT,
        total_ttc: totals.totalTTC,
        deposit_amount: totals.depositAmount || null,
        notes: devis.notes,
        project_name: devis.project_name,
        site_address: site,
        operation_type: devis.operation_type ? OPERATION_LABELS[devis.operation_type]?.[lang] ?? devis.operation_type : null,
        surface_m2: devis.surface_m2,
        works_budget_ht: devis.works_budget_ht,
        mission_phases: devis.mission_phases,
        honoraires_ht: honorairesHT,
        honoraires_pct: honorairesPct,
        payment_schedule: schedule,
      };
      const pdfClient: PdfClient = client ? {
        name: client.name,
        contact_name: client.contact_name,
        address_line1: client.address_line1,
        address_line2: client.address_line2,
        postcode: client.postcode,
        city: client.city,
        country: client.country,
        email: client.email,
        phone: client.phone,
      } : null;
      const pdf = await generateDevisPdf(pdfDevis, pdfLines, profile, pdfClient);
      pdf.save(`${devis.devis_number}.pdf`);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#FAFAFA] text-[#2E1011] text-base font-sans">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }
  if (notFound || !devis || !profile || !totals) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#FAFAFA] text-[#2E1011] p-6 text-center font-sans">
        <p>{tt("notFound", lang)}</p>
      </div>
    );
  }

  const issuerAddr = [
    profile.address_line1,
    profile.address_line2,
    [profile.postcode, profile.city].filter(Boolean).join(" "),
    profile.country,
  ].filter(Boolean).join(", ");
  const clientAddr = client ? [
    client.address_line1,
    client.address_line2,
    [client.postcode, client.city].filter(Boolean).join(" "),
    client.country,
  ].filter(Boolean).join(", ") : "";
  const siteAddr = [
    devis.site_address_line1,
    devis.site_address_line2,
    [devis.site_postcode, devis.site_city].filter(Boolean).join(" "),
    devis.site_country,
  ].filter(Boolean).join(", ");

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#1a1a1a] font-sans antialiased pb-32">
      {/* Header band */}
      <header className="bg-[#2E1011] text-white">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-5 sm:py-7 flex items-center gap-4">
          <img
            src={brandLogo}
            alt="Plan B Côte d'Azur"
            className="h-12 sm:h-14 w-auto shrink-0"
          />
          <div className="min-w-0">
            <div className="text-[10px] sm:text-xs uppercase tracking-[0.18em] text-[#F2CB3C]">
              {tt("yourQuote", lang)}
            </div>
            <div className="font-mono text-base sm:text-lg font-semibold truncate">
              {devis.devis_number}
            </div>
          </div>
        </div>
        <div className="h-1 w-full bg-[#F2CB3C]" />
      </header>

      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-6 space-y-6">
        {/* Meta line */}
        <section className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-[#9B2E2A]">{tt("issued", lang)}</div>
            <div className="font-medium">{dateF(devis.issue_date, lang)}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-[#9B2E2A]">{tt("validUntil", lang)}</div>
            <div className="font-medium">{dateF(devis.validity_until, lang)}</div>
          </div>
        </section>

        {/* Parties */}
        <section className="grid gap-3 sm:grid-cols-2">
          <Card title={tt("issuedBy", lang)}>
            <div className="font-semibold text-[#2E1011]">
              {profile.trading_name || profile.legal_name || "Plan B Côte d'Azur"}
            </div>
            {profile.legal_form && <div className="text-xs text-neutral-500">{profile.legal_form}</div>}
            {issuerAddr && <div className="text-sm mt-1 text-neutral-700">{issuerAddr}</div>}
            <div className="text-xs text-neutral-500 mt-2 space-y-0.5">
              {profile.siret && <div>{L.siret[lang]} : {profile.siret}</div>}
              {profile.vat_number && <div>{L.vatNo[lang]} : {profile.vat_number}</div>}
              {profile.sender_email && <div className="break-all">{profile.sender_email}</div>}
            </div>
          </Card>
          <Card title={tt("forClient", lang)}>
            {client ? (
              <>
                <div className="font-semibold text-[#2E1011]">{client.name}</div>
                {client.contact_name && <div className="text-sm text-neutral-700">{client.contact_name}</div>}
                {clientAddr && <div className="text-sm mt-1 text-neutral-700">{clientAddr}</div>}
                <div className="text-xs text-neutral-500 mt-2 space-y-0.5">
                  {client.email && <div className="break-all">{client.email}</div>}
                  {client.phone && <div>{client.phone}</div>}
                  {client.siret && <div>{L.siret[lang]} : {client.siret}</div>}
                </div>
              </>
            ) : <div className="text-sm text-neutral-500">—</div>}
          </Card>
        </section>

        {/* Project */}
        {(devis.project_name || siteAddr || devis.operation_type || devis.surface_m2 || devis.works_budget_ht || devis.mission_phases.length > 0 || devis.project_description) && (
          <Card title={tt("project", lang)}>
            <div className="space-y-2">
              {devis.project_name && (
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-[#9B2E2A]">{tt("project", lang)}</div>
                  <div className="font-medium">{devis.project_name}</div>
                </div>
              )}
              {siteAddr && (
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-[#9B2E2A]">{tt("site", lang)}</div>
                  <div className="text-sm">{siteAddr}</div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 text-sm">
                {devis.operation_type && (
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-[#9B2E2A]">{tt("operation", lang)}</div>
                    <div>{OPERATION_LABELS[devis.operation_type]?.[lang] ?? devis.operation_type}</div>
                  </div>
                )}
                {devis.surface_m2 != null && devis.surface_m2 > 0 && (
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-[#9B2E2A]">{tt("surface", lang)}</div>
                    <div>{devis.surface_m2} m²</div>
                  </div>
                )}
                {devis.works_budget_ht != null && devis.works_budget_ht > 0 && (
                  <div className="col-span-2">
                    <div className="text-[11px] uppercase tracking-wider text-[#9B2E2A]">{tt("works", lang)}</div>
                    <div className="font-semibold">{money(devis.works_budget_ht, lang)}</div>
                  </div>
                )}
              </div>
              {devis.mission_phases.length > 0 && (
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-[#9B2E2A] mb-1">{tt("phases", lang)}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {devis.mission_phases.map(p => (
                      <span key={p} className="inline-flex items-center rounded-full bg-[#2E1011] text-[#F2CB3C] text-[11px] font-mono px-2 py-0.5">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {devis.project_description && (
                <p className="text-sm text-neutral-700 whitespace-pre-wrap pt-1">{devis.project_description}</p>
              )}
            </div>
          </Card>
        )}

        {/* Line items as stacked cards */}
        <section>
          <h2 className="text-sm uppercase tracking-wider text-[#9B2E2A] font-semibold mb-2 px-1">
            {tt("items", lang)}
          </h2>
          <ul className="space-y-2.5">
            {linesView.map((l, i) => {
              const isDiscount = l.line_type === "remise";
              const lineHt = lineNetHT(l);
              const unitLabel = l.unit ? (UNIT_LABEL[l.unit]?.[lang] ?? l.unit) : "";
              const showQty = l.pricing_mode !== "percent" && !isDiscount;
              return (
                <li key={i} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {l.mission_code && (
                        <span className="inline-block text-[10px] font-mono font-semibold tracking-wider bg-[#F2CB3C] text-[#2E1011] rounded px-1.5 py-0.5 mr-2 align-middle">
                          {l.mission_code}
                        </span>
                      )}
                      <span className="font-medium text-[15px] text-[#2E1011] align-middle">
                        {l.description || "—"}
                      </span>
                      {l.details && (
                        <p className="text-[13px] text-neutral-600 mt-1 whitespace-pre-wrap">{l.details}</p>
                      )}
                      {l.mission_code && MISSION_LABELS[l.mission_code] && !l.details && (
                        <p className="text-[12px] text-neutral-500 italic mt-0.5">
                          {MISSION_LABELS[l.mission_code][lang]}
                        </p>
                      )}
                    </div>
                    <div className={`text-right shrink-0 tabular-nums font-semibold text-[15px] ${isDiscount ? "text-[#9B2E2A]" : "text-[#2E1011]"}`}>
                      {money(lineHt, lang)}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-neutral-600">
                    {showQty && (
                      <span>
                        {l.quantity} {unitLabel} × {money(l.unit_price_ht, lang)}
                      </span>
                    )}
                    {l.pricing_mode === "percent" && devis.works_budget_ht ? (
                      <span>
                        {l.percent_of_budget}% {tt("ofWorks", lang)} ({money(l.unit_price_ht, lang)})
                      </span>
                    ) : null}
                    {!isDiscount && Number(l.discount_value) > 0 && (
                      <span className="text-[#9B2E2A]">
                        −{l.discount_type === "percent" ? `${l.discount_value}%` : money(l.discount_value, lang)}
                      </span>
                    )}
                    <span className="ml-auto">{tt("vat", lang)} {l.vat_rate}%</span>
                  </div>
                </li>
              );
            })}
            {linesView.length === 0 && (
              <li className="text-sm text-neutral-500 italic px-1">—</li>
            )}
          </ul>
        </section>

        {/* Totals */}
        <section className="rounded-xl border border-neutral-200 bg-white overflow-hidden shadow-sm">
          <div className="bg-[#9B2E2A] text-white px-4 py-2.5 text-sm uppercase tracking-wider font-semibold">
            {tt("totals", lang)}
          </div>
          <dl className="divide-y divide-neutral-100 text-sm">
            <Row label={tt("subtotal", lang)} value={money(totals.subtotalHT, lang)} />
            {totals.globalDiscAmt > 0 && (
              <Row label={tt("discount", lang)} value={`−${money(totals.globalDiscAmt, lang)}`} muted />
            )}
            <Row label={tt("netHt", lang)} value={money(totals.netAfterDiscount, lang)} />
            {totals.vatByRate.map(([rate, amt]) => (
              <Row key={rate} label={`${tt("vat", lang)} ${rate}%`} value={money(amt, lang)} />
            ))}
            <Row
              label={tt("totalTTC", lang)}
              value={money(totals.totalTTC, lang)}
              strong
            />
            {totals.depositAmount > 0 && (
              <>
                <Row label={tt("deposit", lang)} value={money(totals.depositAmount, lang)} />
                <Row label={tt("balance", lang)} value={money(totals.balance, lang)} />
              </>
            )}
            {honorairesHT > 0 && devis.works_budget_ht && devis.works_budget_ht > 0 && (
              <Row
                label={tt("honoraires", lang)}
                value={`${money(honorairesHT, lang)} (${honorairesPct}% ${tt("ofWorks", lang)})`}
              />
            )}
          </dl>
        </section>

        {/* Payment schedule */}
        {devis.payment_schedule.length > 0 && (
          <Card title={tt("schedule", lang)}>
            <ul className="divide-y divide-neutral-100 -mx-1">
              {devis.payment_schedule.map((r, i) => {
                const amt = r.mode === "percent"
                  ? +(totals.totalTTC * (Number(r.value || 0) / 100)).toFixed(2)
                  : Number(r.value || 0);
                const pct = totals.totalTTC > 0 ? Math.round((amt / totals.totalTTC) * 100) : 0;
                return (
                  <li key={i} className="px-1 py-2.5 flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-[#2E1011]">{r.label || `#${i + 1}`}</div>
                      {r.milestone && <div className="text-xs text-neutral-500">{r.milestone}</div>}
                    </div>
                    <div className="text-right shrink-0 tabular-nums">
                      <div className="font-semibold text-[#2E1011]">{money(amt, lang)}</div>
                      <div className="text-[11px] text-neutral-500">{pct}% {tt("pctOfTotal", lang)}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        {/* Payment methods + terms */}
        {(devis.payment_methods.length > 0 || devis.payment_terms_preset || devis.conditions_notes) && (
          <Card title={tt("paymentTerms", lang)}>
            {devis.payment_terms_preset && PAYMENT_TERMS_LABELS[devis.payment_terms_preset] && (
              <p className="text-sm">{PAYMENT_TERMS_LABELS[devis.payment_terms_preset][lang]}</p>
            )}
            {devis.payment_methods.length > 0 && (
              <div className="mt-2">
                <div className="text-[11px] uppercase tracking-wider text-[#9B2E2A] mb-1">{tt("paymentMethods", lang)}</div>
                <div className="flex flex-wrap gap-1.5">
                  {devis.payment_methods.map(m => (
                    <span key={m} className="inline-flex rounded-full border border-[#2E1011]/20 text-[#2E1011] text-[12px] px-2.5 py-0.5">
                      {PAYMENT_METHOD_LABELS[m]?.[lang] ?? m}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {devis.conditions_notes && (
              <p className="text-sm text-neutral-700 whitespace-pre-wrap mt-2">{devis.conditions_notes}</p>
            )}
            {profile.iban && (
              <div className="text-xs text-neutral-500 mt-3">
                <div>{L.bank[lang]}</div>
                <div className="font-mono break-all">IBAN {profile.iban}</div>
                {profile.bic && <div className="font-mono">BIC {profile.bic}</div>}
              </div>
            )}
          </Card>
        )}

        {/* Notes */}
        {devis.notes && (
          <Card title={tt("notes", lang)}>
            <p className="text-sm text-neutral-700 whitespace-pre-wrap">{devis.notes}</p>
          </Card>
        )}

        {/* Legal */}
        {devis.legal_mentions.length > 0 && (
          <section className="text-[11px] leading-relaxed text-neutral-500 space-y-1 px-1">
            <div className="uppercase tracking-wider text-[#9B2E2A] font-semibold text-[11px] mb-1">
              {tt("legal", lang)}
            </div>
            {devis.legal_mentions.map(k => (
              <p key={k}>{LEGAL_MENTION_LABELS[k]?.[lang] ?? k}</p>
            ))}
          </section>
        )}

        <footer className="text-center text-[11px] text-neutral-400 pt-4">
          Plan B Côte d'Azur · {profile.sender_email ?? ""}
        </footer>
      </main>

      {/* Sticky download button */}
      <div
        className="fixed inset-x-0 bottom-0 z-30 bg-white/95 backdrop-blur border-t border-neutral-200"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-[#9B2E2A]">{tt("totalTTC", lang)}</div>
            <div className="text-lg font-bold tabular-nums text-[#2E1011] leading-tight">{money(totals.totalTTC, lang)}</div>
          </div>
          <button
            onClick={downloadPdf}
            disabled={downloading}
            className="inline-flex items-center justify-center gap-2 min-h-11 px-5 rounded-md bg-[#F2CB3C] text-[#2E1011] font-semibold text-sm shadow-sm hover:bg-[#e8c233] active:scale-[0.98] transition disabled:opacity-60"
          >
            {downloading
              ? (<><Loader2 className="size-4 animate-spin" /> {tt("generating", lang)}</>)
              : (<><Download className="size-4" /> {tt("download", lang)}</>)}
          </button>
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="text-[11px] uppercase tracking-wider text-[#9B2E2A] font-semibold mb-2">{title}</div>
      {children}
    </div>
  );
}

function Row({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className={`flex items-center justify-between px-4 py-2.5 ${strong ? "bg-[#2E1011] text-white" : ""}`}>
      <dt className={`text-sm ${strong ? "font-semibold uppercase tracking-wider text-[11px]" : muted ? "text-neutral-500" : "text-neutral-700"}`}>
        {label}
      </dt>
      <dd className={`tabular-nums ${strong ? "text-lg font-bold" : "text-sm font-medium text-[#1a1a1a]"} ${muted ? "text-neutral-500" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
