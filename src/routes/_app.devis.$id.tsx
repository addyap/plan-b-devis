import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import {
  ArrowDown, ArrowLeft, ArrowUp, Download, Eye, FileCheck2,
  Mail, Plus, Save, Trash2, UserPlus, Library,
} from "lucide-react";
import { fmtEUR, fmtDate, addDays, todayISO, type Locale } from "@/lib/format";
import { toast } from "sonner";
import { generateDevisPdf, pdfToBase64, type PdfProfile, type PdfClient, type PdfDevis, type PdfLine } from "@/lib/pdf";

export const Route = createFileRoute("/_app/devis/$id")({
  component: DevisEditor,
});

type LineType = "produit" | "prestation" | "forfait" | "moe" | "remise";
type DiscountType = "percent" | "amount";
type PricingMode = "amount" | "percent";
type Status = "draft" | "sent" | "accepted" | "declined" | "expired";

type ScheduleRow = {
  label: string;
  mode: DiscountType;     // percent of total TTC, or fixed € amount
  value: number;
  milestone: string;
};

type Line = {
  id?: string;
  line_type: LineType;
  description: string;
  details: string;
  quantity: number;
  unit: string;
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
  status: Status;
  language: "fr" | "en";
  project_description: string | null;
  project_start: string | null;
  project_duration: string | null;
  notes: string | null;
  global_discount_type: DiscountType;
  global_discount_value: number;
  deposit_type: DiscountType;
  deposit_value: number;
  deposit_amount: number | null;
  payment_terms_preset: string | null;
  payment_methods: string[];
  conditions_notes: string | null;
  legal_mentions: string[];
  signature_client_name: string | null;
  signature_date: string | null;
  sent_at: string | null;
  // MOE
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

type ClientRow = {
  id: string;
  name: string;
  client_type: "particulier" | "professionnel";
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

type ClientDraft = Omit<ClientRow, "id">;

// Unit keys map to translation under units.*
const UNIT_KEYS = ["unite", "heure", "jour", "m2", "m3", "ml", "forfait", "lot"] as const;
const VAT_RATES = [0, 5.5, 10, 20] as const;
const VALIDITY_OPTIONS = [15, 30, 45, 60, 90] as const;
const LINE_TYPES: LineType[] = ["produit", "prestation", "forfait", "moe", "remise"];
const STATUSES: Status[] = ["draft", "sent", "accepted", "declined", "expired"];
const PAYMENT_TERM_KEYS = ["cash", "30d", "5050", "custom"] as const;
const PAYMENT_METHOD_KEYS = ["transfer", "check", "card", "cash"] as const;
const LEGAL_MENTION_KEYS = ["free", "vat293b", "late", "discount"] as const;
const OPERATION_KEYS = ["neuf", "renov", "extension", "reamenagement", "interieur", "autre"] as const;
const MISSION_CODES = ["ESQ", "APS", "APD", "PRO", "ACT", "VISA", "DET", "AOR"] as const;
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

const emptyClient = (): ClientDraft => ({
  name: "",
  client_type: "professionnel",
  contact_name: "",
  email: "",
  phone: "",
  address_line1: "",
  address_line2: "",
  postcode: "",
  city: "",
  country: "France",
  siret: "",
  vat_number: "",
});

function lineNetHT(l: Pick<Line, "quantity" | "unit_price_ht" | "discount_type" | "discount_value" | "line_type">) {
  const gross = Number(l.quantity || 0) * Number(l.unit_price_ht || 0);
  const sign = l.line_type === "remise" ? -1 : 1;
  const base = Math.abs(gross);
  const disc =
    l.discount_type === "percent"
      ? base * (Number(l.discount_value || 0) / 100)
      : Number(l.discount_value || 0);
  return +(sign * Math.max(0, base - disc)).toFixed(2);
}

function computeTotals(lines: Line[], gType: DiscountType, gValue: number, depType: DiscountType, depValue: number) {
  const linesNet = lines.map(l => ({ vat: Number(l.vat_rate || 0), net: lineNetHT(l) }));
  const subtotalHT = +linesNet.reduce((s, x) => s + x.net, 0).toFixed(2);

  const positiveNet = linesNet.reduce((s, x) => (x.net > 0 ? s + x.net : s), 0);
  const globalDiscAmt = positiveNet === 0 ? 0 :
    gType === "percent"
      ? +(positiveNet * (Number(gValue || 0) / 100)).toFixed(2)
      : Math.min(Number(gValue || 0), positiveNet);

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

  const depositAmount =
    depType === "percent"
      ? +(totalTTC * (Number(depValue || 0) / 100)).toFixed(2)
      : Math.min(Number(depValue || 0), totalTTC);
  const balance = +(totalTTC - depositAmount).toFixed(2);

  return {
    subtotalHT,
    globalDiscAmt,
    netAfterDiscount: netAfter,
    vatByRate: Array.from(vatByRate.entries()).filter(([, v]) => v !== 0).sort((a, b) => a[0] - b[0]),
    totalVAT,
    totalTTC,
    depositAmount,
    balance,
  };
}

function DevisEditor() {
  const { t, i18n } = useTranslation();
  const uiLang: Locale = i18n.resolvedLanguage?.startsWith("en") ? "en" : "fr";
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const [devis, setDevis] = useState<Devis | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [profile, setProfile] = useState<PdfProfile | null>(null);
  const [presets, setPresets] = useState<{ id: string; label_en: string; label_fr: string; default_unit: string | null; default_rate: number | null }[]>([]);

  const [clientMode, setClientMode] = useState<"existing" | "new">("existing");
  const [newClient, setNewClient] = useState<ClientDraft>(emptyClient());
  const [savedClient, setSavedClient] = useState<ClientRow | null>(null);

  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [converting, setConverting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [presetsOpen, setPresetsOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const [d, l, c, p, pr] = await Promise.all([
        supabase.from("devis").select("*").eq("id", id).maybeSingle(),
        supabase.from("devis_lines").select("*").eq("devis_id", id).order("sort_order"),
        supabase.from("clients").select("*").order("name"),
        supabase.from("business_profile").select("*").limit(1).maybeSingle(),
        supabase.from("service_presets").select("*").order("sort_order"),
      ]);

      const dd = d.data as any;
      if (dd) {
        setDevis({
          id: dd.id,
          devis_number: dd.devis_number,
          client_id: dd.client_id,
          issue_date: dd.issue_date,
          validity_until: dd.validity_until,
          status: dd.status,
          language: dd.language ?? "fr",
          project_description: dd.project_description,
          project_start: dd.project_start,
          project_duration: dd.project_duration,
          notes: dd.notes,
          global_discount_type: dd.global_discount_type ?? "percent",
          global_discount_value: Number(dd.global_discount_value ?? 0),
          deposit_type: dd.deposit_type ?? "percent",
          deposit_value: Number(dd.deposit_value ?? 0),
          deposit_amount: dd.deposit_amount,
          payment_terms_preset: dd.payment_terms_preset,
          payment_methods: dd.payment_methods ?? [],
          conditions_notes: dd.conditions_notes,
          legal_mentions: dd.legal_mentions ?? [],
          signature_client_name: dd.signature_client_name,
          signature_date: dd.signature_date,
          sent_at: dd.sent_at,
          project_name: dd.project_name ?? null,
          site_address_line1: dd.site_address_line1 ?? null,
          site_address_line2: dd.site_address_line2 ?? null,
          site_postcode: dd.site_postcode ?? null,
          site_city: dd.site_city ?? null,
          site_country: dd.site_country ?? null,
          operation_type: dd.operation_type ?? null,
          surface_m2: dd.surface_m2 != null ? Number(dd.surface_m2) : null,
          works_budget_ht: dd.works_budget_ht != null ? Number(dd.works_budget_ht) : null,
          mission_phases: dd.mission_phases ?? [],
          payment_schedule: Array.isArray(dd.payment_schedule) ? dd.payment_schedule : [],
        });
      }
      setLines(((l.data ?? []) as any[]).map(x => ({
        id: x.id,
        line_type: x.line_type ?? "prestation",
        description: x.description ?? "",
        details: x.details ?? "",
        quantity: Number(x.quantity ?? 1),
        unit: x.unit ?? "forfait",
        unit_price_ht: Number(x.unit_price_ht ?? 0),
        discount_type: x.discount_type ?? "percent",
        discount_value: Number(x.discount_value ?? 0),
        vat_rate: Number(x.vat_rate ?? 20),
        sort_order: x.sort_order ?? 0,
        mission_code: x.mission_code ?? null,
        pricing_mode: (x.pricing_mode ?? "amount") as PricingMode,
        percent_of_budget: Number(x.percent_of_budget ?? 0),
      })));
      setClients((c.data ?? []) as ClientRow[]);
      setProfile(p.data as unknown as PdfProfile);
      setPresets(pr.data ?? []);
    })();
  }, [id]);

  useEffect(() => {
    if (!devis?.client_id) { setSavedClient(null); return; }
    const found = clients.find(c => c.id === devis.client_id);
    if (found) setSavedClient(found);
    else {
      supabase.from("clients").select("*").eq("id", devis.client_id).maybeSingle()
        .then(({ data }) => setSavedClient((data as ClientRow) ?? null));
    }
  }, [devis?.client_id, clients]);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const totals = useMemo(() => {
    if (!devis) return null;
    const b = Number(devis.works_budget_ht || 0);
    const view = lines.map(l =>
      l.pricing_mode === "percent"
        ? { ...l, unit_price_ht: +(b * (Number(l.percent_of_budget || 0) / 100)).toFixed(2), quantity: 1 }
        : l,
    );
    return computeTotals(view, devis.global_discount_type, devis.global_discount_value, devis.deposit_type, devis.deposit_value);
  }, [lines, devis?.global_discount_type, devis?.global_discount_value, devis?.deposit_type, devis?.deposit_value, devis?.works_budget_ht]);

  if (!devis || !profile || !totals) return <div className="text-muted-foreground">{t("common.loading")}</div>;

  const update = (patch: Partial<Devis>) => setDevis({ ...devis, ...patch });

  // For percent-mode MOE lines, derive unit_price from works budget
  const budget = Number(devis.works_budget_ht || 0);
  const linesView: Line[] = lines.map(l =>
    l.pricing_mode === "percent"
      ? { ...l, unit_price_ht: +(budget * (Number(l.percent_of_budget || 0) / 100)).toFixed(2), quantity: 1, unit: "forfait" }
      : l,
  );

  const honorairesHT = +linesView
    .filter(l => l.line_type === "moe")
    .reduce((s, l) => s + lineNetHT(l), 0)
    .toFixed(2);
  const honorairesPct = budget > 0 ? +((honorairesHT / budget) * 100).toFixed(2) : 0;

  const addLine = (init?: Partial<Line>) => setLines([...lines, {
    line_type: "prestation",
    description: "",
    details: "",
    quantity: 1,
    unit: "forfait",
    unit_price_ht: 0,
    discount_type: "percent",
    discount_value: 0,
    vat_rate: Number((profile as any)?.vat_rate ?? 20),
    sort_order: lines.length,
    mission_code: null,
    pricing_mode: "amount",
    percent_of_budget: 0,
    ...init,
  } as Line]);
  const updateLine = (i: number, patch: Partial<Line>) => {
    const next = [...lines];
    next[i] = { ...next[i], ...patch } as Line;
    setLines(next);
  };
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i).map((l, idx) => ({ ...l, sort_order: idx })));
  const moveLine = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= lines.length) return;
    const next = [...lines];
    [next[i], next[j]] = [next[j], next[i]];
    setLines(next.map((l, idx) => ({ ...l, sort_order: idx })));
  };
  const addPreset = (p: typeof presets[number]) => {
    addLine({
      description: devis.language === "fr" ? p.label_fr : p.label_en,
      unit: p.default_unit ?? "forfait",
      unit_price_ht: Number(p.default_rate ?? 0),
    });
    setPresetsOpen(false);
  };

  const validate = (): string | null => {
    if (clientMode === "existing" && !devis.client_id) return t("devis.v_select_client");
    if (clientMode === "new" && !newClient.name.trim()) return t("devis.v_new_name");
    if (!devis.issue_date) return t("devis.v_issue");
    if (!devis.validity_until) return t("devis.v_validity");
    if (lines.length === 0) return t("devis.v_one_line");
    for (const [i, l] of lines.entries()) {
      if (!l.description.trim()) return t("devis.v_line_label", { n: i + 1 });
    }
    return null;
  };

  const upsertNewClient = async (): Promise<string | null> => {
    if (clientMode !== "new") return devis.client_id;
    const payload = {
      ...newClient,
      siret: newClient.client_type === "professionnel" ? newClient.siret : null,
    };
    const { data, error } = await supabase.from("clients").insert(payload).select("*").single();
    if (error) { toast.error(error.message); return null; }
    setClients(prev => [...prev, data as ClientRow]);
    setClientMode("existing");
    setNewClient(emptyClient());
    return (data as ClientRow).id;
  };

  const save = async (newStatus?: Status): Promise<boolean> => {
    const err = validate();
    if (err) { toast.error(err); return false; }
    setSaving(true);
    try {
      const clientId = await upsertNewClient();
      if (clientMode === "new" && !clientId) { setSaving(false); return false; }

      const payload = {
        client_id: clientId,
        issue_date: devis.issue_date,
        validity_until: devis.validity_until,
        status: newStatus ?? devis.status,
        language: devis.language,
        project_description: devis.project_description,
        project_start: devis.project_start || null,
        project_duration: devis.project_duration,
        subtotal_ht: totals.netAfterDiscount,
        vat_amount: totals.totalVAT,
        total_ttc: totals.totalTTC,
        deposit_amount: totals.depositAmount || null,
        notes: devis.notes,
        global_discount_type: devis.global_discount_type,
        global_discount_value: devis.global_discount_value,
        deposit_type: devis.deposit_type,
        deposit_value: devis.deposit_value,
        payment_terms_preset: devis.payment_terms_preset,
        payment_methods: devis.payment_methods,
        conditions_notes: devis.conditions_notes,
        legal_mentions: devis.legal_mentions,
        signature_client_name: devis.signature_client_name,
        signature_date: devis.signature_date,
        project_name: devis.project_name,
        site_address_line1: devis.site_address_line1,
        site_address_line2: devis.site_address_line2,
        site_postcode: devis.site_postcode,
        site_city: devis.site_city,
        site_country: devis.site_country,
        operation_type: devis.operation_type,
        surface_m2: devis.surface_m2,
        works_budget_ht: devis.works_budget_ht,
        mission_phases: devis.mission_phases,
        payment_schedule: devis.payment_schedule,
      };

      const { error: e1 } = await supabase.from("devis").update(payload).eq("id", id);
      if (e1) { toast.error(e1.message); setSaving(false); return false; }

      await supabase.from("devis_lines").delete().eq("devis_id", id);
      if (linesView.length) {
        const { error: e2 } = await supabase.from("devis_lines").insert(
          linesView.map((l, i) => ({
            devis_id: id,
            line_type: l.line_type,
            description: l.description,
            details: l.details || null,
            quantity: l.quantity,
            unit: l.unit,
            unit_price_ht: l.unit_price_ht,
            discount_type: l.discount_type,
            discount_value: l.discount_value,
            vat_rate: l.vat_rate,
            line_total_ht: lineNetHT(l),
            sort_order: i,
            mission_code: l.mission_code,
            pricing_mode: l.pricing_mode,
            percent_of_budget: l.percent_of_budget,
          })),
        );
        if (e2) { toast.error(e2.message); setSaving(false); return false; }
      }
      if (newStatus || clientId !== devis.client_id) {
        setDevis({ ...devis, status: newStatus ?? devis.status, client_id: clientId });
      }
      toast.success(t("common.saved"));
      return true;
    } finally {
      setSaving(false);
    }
  };

  const pdfDevis: PdfDevis = {
    devis_number: devis.devis_number,
    issue_date: devis.issue_date,
    validity_until: devis.validity_until,
    language: devis.language,
    project_description: devis.project_description,
    project_start: devis.project_start,
    project_duration: devis.project_duration,
    subtotal_ht: totals.netAfterDiscount,
    vat_amount: totals.totalVAT,
    total_ttc: totals.totalTTC,
    deposit_amount: totals.depositAmount || null,
    notes: [devis.notes, devis.conditions_notes].filter(Boolean).join("\n\n") || null,
    project_name: devis.project_name,
    site_address: [devis.site_address_line1, devis.site_address_line2, [devis.site_postcode, devis.site_city].filter(Boolean).join(" "), devis.site_country].filter(Boolean).join(", ") || null,
    operation_type: devis.operation_type ? t(`devis.moe_op_${devis.operation_type}`) : null,
    surface_m2: devis.surface_m2,
    works_budget_ht: devis.works_budget_ht,
    mission_phases: devis.mission_phases,
    honoraires_ht: honorairesHT,
    honoraires_pct: honorairesPct,
    payment_schedule: devis.payment_schedule.map(r => ({
      label: r.label,
      milestone: r.milestone,
      amount: r.mode === "percent"
        ? +(totals.totalTTC * (Number(r.value || 0) / 100)).toFixed(2)
        : Number(r.value || 0),
      pct: r.mode === "percent" ? Number(r.value || 0) : (totals.totalTTC > 0 ? +((Number(r.value || 0) / totals.totalTTC) * 100).toFixed(1) : 0),
    })),
  };

  const pdfLines: PdfLine[] = linesView.map(l => ({
    description: [
      l.mission_code ? `[${l.mission_code}] ${l.description}` : l.description,
      l.details,
      l.pricing_mode === "percent" && budget > 0 ? `${l.percent_of_budget} % ${t("devis.moe_works_budget").toLowerCase()}` : null,
    ].filter(Boolean).join("\n"),
    quantity: Number(l.quantity),
    unit: l.unit,
    unit_price_ht: Number(l.unit_price_ht),
    line_total_ht: lineNetHT(l),
  }));

  const pdfClient: PdfClient = savedClient ?? (clientMode === "new" ? {
    name: newClient.name,
    contact_name: newClient.contact_name,
    address_line1: newClient.address_line1,
    address_line2: newClient.address_line2,
    postcode: newClient.postcode,
    city: newClient.city,
    country: newClient.country,
    email: newClient.email,
    phone: newClient.phone,
  } : null);

  const downloadPdf = async () => {
    try {
      const doc = await generateDevisPdf(pdfDevis, pdfLines, profile, pdfClient);
      doc.save(`${devis.devis_number}.pdf`);
    } catch (e) { toast.error(`PDF: ${(e as Error).message}`); }
  };

  const openPreview = async () => {
    try {
      const doc = await generateDevisPdf(pdfDevis, pdfLines, profile, pdfClient);
      const blob = doc.output("blob");
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
      setPreviewOpen(true);
    } catch (e) { toast.error(`${t("devis.preview")}: ${(e as Error).message}`); }
  };

  const sendToClient = async () => {
    const email = savedClient?.email || newClient.email;
    if (!email) return toast.error(t("devis.email_no_email"));
    if (!profile.sender_email) return toast.error(t("devis.email_no_sender"));
    setSending(true);
    try {
      const ok = await save();
      if (!ok) return;
      const doc = await generateDevisPdf(pdfDevis, pdfLines, profile, pdfClient);
      const b64 = await pdfToBase64(doc);
      const { data, error } = await supabase.functions.invoke("send-devis", {
        body: { devis_id: id, to: email, pdf_base64: b64, filename: `${devis.devis_number}.pdf` },
      });
      if (error || (data && (data as any).error)) {
        const msg = error?.message || (data as any)?.error || t("factures.send_failed");
        await supabase.from("devis").update({ last_email_error: msg }).eq("id", id);
        toast.error(`Email: ${msg}`);
      } else {
        const now = new Date().toISOString();
        await supabase.from("devis").update({ sent_at: now, status: "sent", last_email_error: null }).eq("id", id);
        setDevis({ ...devis, sent_at: now, status: "sent" });
        toast.success(t("devis.email_sent", { email }));
      }
    } catch (e) { toast.error(`${t("devis.send")}: ${(e as Error).message}`); }
    finally { setSending(false); }
  };

  const convertToFacture = async () => {
    setConverting(true);
    try {
      const ok = await save();
      if (!ok) return;
      const { data: num, error: nErr } = await supabase.rpc("next_facture_number");
      if (nErr || !num) throw new Error(nErr?.message || t("devis.convert_error"));
      const today = todayISO();
      const { data: fac, error: fErr } = await supabase.from("factures").insert({
        facture_number: num as string,
        devis_id: id,
        client_id: devis.client_id,
        issue_date: today,
        due_date: addDays(today, 30),
        language: devis.language,
        project_description: devis.project_description,
        project_start: devis.project_start,
        project_duration: devis.project_duration,
        subtotal_ht: totals.netAfterDiscount,
        vat_amount: totals.totalVAT,
        total_ttc: totals.totalTTC,
        deposit_amount: totals.depositAmount || null,
        notes: devis.notes,
      }).select("id").single();
      if (fErr || !fac) throw new Error(fErr?.message || "Insertion failed");
      if (lines.length) {
        await supabase.from("facture_lines").insert(lines.map((l, i) => ({
          facture_id: fac.id,
          description: l.description,
          quantity: l.quantity,
          unit: l.unit,
          unit_price_ht: l.unit_price_ht,
          line_total_ht: lineNetHT(l),
          sort_order: i,
        })));
      }
      toast.success(t("devis.convert_done", { n: num }));
      navigate({ to: "/factures/$id", params: { id: fac.id } });
    } catch (e) { toast.error((e as Error).message); }
    finally { setConverting(false); }
  };

  const activeClient: ClientDraft = clientMode === "new"
    ? newClient
    : (savedClient ? { ...savedClient } : emptyClient());
  const setActiveClient = (patch: Partial<ClientDraft>) => {
    if (clientMode === "new") setNewClient({ ...newClient, ...patch });
  };
  const validityDays = (() => {
    if (!devis.issue_date || !devis.validity_until) return 30;
    const a = new Date(devis.issue_date).getTime();
    const b = new Date(devis.validity_until).getTime();
    return Math.max(0, Math.round((b - a) / 86400000));
  })();

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/dashboard" })} aria-label={t("devis.back")}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("devis.label")}</div>
            <h1 className="text-2xl font-semibold font-mono">{devis.devis_number}</h1>
          </div>
          <Badge variant="secondary" className="ml-2">{t(`status.${devis.status}`)}</Badge>
          {devis.sent_at && (
            <span className="text-xs text-muted-foreground">
              {t("devis.sent_at", { date: fmtDate(devis.sent_at, uiLang) })}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={openPreview}><Eye className="size-4" /> {t("devis.preview")}</Button>
          <Button variant="outline" onClick={downloadPdf}><Download className="size-4" /> {t("devis.pdf")}</Button>
          <Button variant="outline" onClick={sendToClient} disabled={sending}>
            <Mail className="size-4" /> {sending ? t("devis.sending") : t("devis.send")}
          </Button>
          <Button variant="outline" onClick={convertToFacture} disabled={converting}>
            <FileCheck2 className="size-4" /> {converting ? "…" : t("devis.convert")}
          </Button>
          <Button onClick={() => save()} disabled={saving}>
            <Save className="size-4" /> {saving ? t("common.saving") : t("devis.save")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">

          {/* HEADER / META */}
          <Card className="p-5 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t("devis.section_header")}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label={t("devis.number")}>
                <Input
                  value={devis.devis_number}
                  onChange={(e) => update({ devis_number: e.target.value })}
                  className="font-mono"
                  placeholder="DEV-2026-0001"
                />
              </Field>
              <Field label={t("devis.status")}>
                <Select value={devis.status} onValueChange={(v) => update({ status: v as Status })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(s => <SelectItem key={s} value={s}>{t(`status.${s}`)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t("devis.issue_date")}>
                <Input
                  type="date"
                  value={devis.issue_date}
                  onChange={(e) => {
                    const v = e.target.value;
                    update({ issue_date: v, validity_until: addDays(v, validityDays || 30) });
                  }}
                />
              </Field>
              <Field label={t("devis.validity_until")}>
                <Input
                  type="date"
                  value={devis.validity_until}
                  onChange={(e) => update({ validity_until: e.target.value })}
                />
              </Field>
              <Field label={t("devis.validity_offer")}>
                <Select
                  value={String(validityDays)}
                  onValueChange={(v) => update({ validity_until: addDays(devis.issue_date, Number(v)) })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VALIDITY_OPTIONS.map(d => <SelectItem key={d} value={String(d)}>{t("devis.validity_days", { n: d })}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t("devis.doc_language")} help={t("devis.doc_language_help")}>
                <Select value={devis.language} onValueChange={(v) => update({ language: v as "fr" | "en" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fr">🇫🇷 Français</SelectItem>
                    <SelectItem value="en">🇬🇧 English</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </Card>

          {/* CLIENT */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t("devis.section_client")}</h2>
              <div className="flex items-center gap-1 text-xs">
                <Button variant={clientMode === "existing" ? "secondary" : "ghost"} size="sm" onClick={() => setClientMode("existing")}>
                  {t("devis.client_existing")}
                </Button>
                <Button variant={clientMode === "new" ? "secondary" : "ghost"} size="sm" onClick={() => { setClientMode("new"); update({ client_id: null }); }}>
                  <UserPlus className="size-3.5" /> {t("devis.client_new")}
                </Button>
              </div>
            </div>

            {clientMode === "existing" ? (
              <Field label={t("devis.client_select")}>
                <Select value={devis.client_id ?? ""} onValueChange={(v) => update({ client_id: v || null })}>
                  <SelectTrigger><SelectValue placeholder={t("devis.client_choose")} /></SelectTrigger>
                  <SelectContent>
                    {clients.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} {c.client_type === "particulier" ? `·  ${t("devis.client_particulier").toLowerCase()}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}

            {(clientMode === "new" || savedClient) && (
              <div className={`space-y-4 ${clientMode === "existing" ? "opacity-90" : ""}`}>
                <div className="space-y-2">
                  <Label className="text-xs">{t("devis.client_type")}</Label>
                  <RadioGroup
                    value={activeClient.client_type}
                    onValueChange={(v) => setActiveClient({ client_type: v as "particulier" | "professionnel" })}
                    className="flex gap-6"
                    disabled={clientMode === "existing"}
                  >
                    <label className="flex items-center gap-2 text-sm">
                      <RadioGroupItem value="particulier" /> {t("devis.client_particulier")}
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <RadioGroupItem value="professionnel" /> {t("devis.client_pro")}
                    </label>
                  </RadioGroup>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label={activeClient.client_type === "professionnel" ? t("devis.client_company") : t("devis.client_name")}>
                    <Input value={activeClient.name} onChange={(e) => setActiveClient({ name: e.target.value })} readOnly={clientMode === "existing"} />
                  </Field>
                  <Field label={t("devis.client_contact")}>
                    <Input value={activeClient.contact_name ?? ""} onChange={(e) => setActiveClient({ contact_name: e.target.value })} readOnly={clientMode === "existing"} />
                  </Field>
                  <Field label={t("devis.client_email")}>
                    <Input type="email" value={activeClient.email ?? ""} onChange={(e) => setActiveClient({ email: e.target.value })} readOnly={clientMode === "existing"} />
                  </Field>
                  <Field label={t("devis.client_phone")}>
                    <Input type="tel" value={activeClient.phone ?? ""} onChange={(e) => setActiveClient({ phone: e.target.value })} readOnly={clientMode === "existing"} />
                  </Field>
                  <Field label={t("devis.client_address")} className="md:col-span-2">
                    <Input value={activeClient.address_line1 ?? ""} onChange={(e) => setActiveClient({ address_line1: e.target.value })} readOnly={clientMode === "existing"} placeholder={t("devis.client_addr_street")} />
                    <Input className="mt-2" value={activeClient.address_line2 ?? ""} onChange={(e) => setActiveClient({ address_line2: e.target.value })} readOnly={clientMode === "existing"} placeholder={t("devis.client_addr_comp")} />
                  </Field>
                  <Field label={t("devis.client_postcode")}>
                    <Input inputMode="numeric" value={activeClient.postcode ?? ""} onChange={(e) => setActiveClient({ postcode: e.target.value })} readOnly={clientMode === "existing"} />
                  </Field>
                  <Field label={t("devis.client_city")}>
                    <Input value={activeClient.city ?? ""} onChange={(e) => setActiveClient({ city: e.target.value })} readOnly={clientMode === "existing"} />
                  </Field>
                  <Field label={t("devis.client_country")}>
                    <Input value={activeClient.country ?? "France"} onChange={(e) => setActiveClient({ country: e.target.value })} readOnly={clientMode === "existing"} />
                  </Field>
                  {activeClient.client_type === "professionnel" && (
                    <Field label={t("devis.client_siret")}>
                      <Input inputMode="numeric" value={activeClient.siret ?? ""} onChange={(e) => setActiveClient({ siret: e.target.value })} readOnly={clientMode === "existing"} placeholder={t("devis.client_siret_help")} maxLength={20} />
                    </Field>
                  )}
                  <Field label={t("devis.client_vat")}>
                    <Input value={activeClient.vat_number ?? ""} onChange={(e) => setActiveClient({ vat_number: e.target.value })} readOnly={clientMode === "existing"} placeholder="FRXX999999999" />
                  </Field>
                </div>
              </div>
            )}
          </Card>

          {/* MOE PROJECT INFO */}
          <Card className="p-5 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t("devis.section_moe")}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label={t("devis.moe_project_name")}>
                <Input value={devis.project_name ?? ""} onChange={(e) => update({ project_name: e.target.value })} />
              </Field>
              <Field label={t("devis.moe_operation_type")}>
                <Select value={devis.operation_type ?? ""} onValueChange={(v) => update({ operation_type: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {OPERATION_KEYS.map(k => <SelectItem key={k} value={k}>{t(`devis.moe_op_${k}`)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label={t("devis.moe_site_address")} help={t("devis.moe_site_address_help")}>
              <div className="space-y-2">
                <Input placeholder="Adresse" value={devis.site_address_line1 ?? ""} onChange={(e) => update({ site_address_line1: e.target.value })} />
                <Input placeholder="Complément" value={devis.site_address_line2 ?? ""} onChange={(e) => update({ site_address_line2: e.target.value })} />
                <div className="grid grid-cols-3 gap-2">
                  <Input placeholder="CP" value={devis.site_postcode ?? ""} onChange={(e) => update({ site_postcode: e.target.value })} />
                  <Input placeholder="Ville" value={devis.site_city ?? ""} onChange={(e) => update({ site_city: e.target.value })} />
                  <Input placeholder="Pays" value={devis.site_country ?? ""} onChange={(e) => update({ site_country: e.target.value })} />
                </div>
              </div>
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label={t("devis.moe_surface")}>
                <Input type="number" step="0.01" min={0} className="text-right tabular-nums" value={devis.surface_m2 ?? ""} onChange={(e) => update({ surface_m2: e.target.value === "" ? null : Number(e.target.value) })} />
              </Field>
              <Field label={t("devis.moe_works_budget")} help={t("devis.moe_works_budget_help")}>
                <Input type="number" step="0.01" min={0} className="text-right tabular-nums" value={devis.works_budget_ht ?? ""} onChange={(e) => update({ works_budget_ht: e.target.value === "" ? null : Number(e.target.value) })} />
              </Field>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">{t("devis.moe_phases")}</Label>
              <div className="flex flex-wrap gap-2 pt-1">
                {MISSION_CODES.map(code => {
                  const active = devis.mission_phases.includes(code);
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => update({
                        mission_phases: active
                          ? devis.mission_phases.filter(x => x !== code)
                          : [...devis.mission_phases, code],
                      })}
                      className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${active ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground hover:bg-muted"}`}
                      title={MISSION_LABELS[code][devis.language]}
                    >
                      {code}
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* PROJECT */}
          <Card className="p-5 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t("devis.section_project")}</h2>
            <Field label={t("devis.project_description")}>
              <Textarea rows={3} value={devis.project_description ?? ""} onChange={(e) => update({ project_description: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t("devis.project_start")}>
                <Input type="date" value={devis.project_start ?? ""} onChange={(e) => update({ project_start: e.target.value || null })} />
              </Field>
              <Field label={t("devis.project_duration")}>
                <Input value={devis.project_duration ?? ""} onChange={(e) => update({ project_duration: e.target.value })} placeholder={t("devis.project_duration_ph")} />
              </Field>
            </div>
          </Card>

          {/* LINE ITEMS */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t("devis.section_lines")}</h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPresetsOpen(true)}>
                  <Library className="size-4" /> {t("devis.library")}
                </Button>
                <Button size="sm" onClick={() => addLine()}>
                  <Plus className="size-4" /> {t("devis.add_line")}
                </Button>
              </div>
            </div>

            {lines.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-10 border border-dashed rounded-md">
                {t("devis.empty_lines")}
              </div>
            )}

            <div className="space-y-3">
              {lines.map((l, i) => {
                const net = lineNetHT(l);
                return (
                  <div key={i} className="border rounded-lg p-3 space-y-3 bg-card">
                    <div className="flex items-start gap-2">
                      <div className="flex flex-col gap-1 pt-1 text-muted-foreground">
                        <button type="button" onClick={() => moveLine(i, -1)} className="hover:text-foreground disabled:opacity-30" disabled={i === 0}>
                          <ArrowUp className="size-3.5" />
                        </button>
                        <span className="text-[10px] font-mono text-center">{i + 1}</span>
                        <button type="button" onClick={() => moveLine(i, 1)} className="hover:text-foreground disabled:opacity-30" disabled={i === lines.length - 1}>
                          <ArrowDown className="size-3.5" />
                        </button>
                      </div>

                      <div className="flex-1 grid grid-cols-12 gap-2">
                        <div className="col-span-12 sm:col-span-3">
                          <Label className="text-[10px] uppercase text-muted-foreground">{t("devis.line_type")}</Label>
                          <Select value={l.line_type} onValueChange={(v) => updateLine(i, { line_type: v as LineType })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {LINE_TYPES.map(lt => <SelectItem key={lt} value={lt}>{t(`devis.line_type_${lt}`)}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-12 sm:col-span-9">
                          <Label className="text-[10px] uppercase text-muted-foreground">{t("devis.line_label")}</Label>
                          <Input value={l.description} onChange={(e) => updateLine(i, { description: e.target.value })} placeholder={t("devis.line_label_ph")} />
                        </div>
                        <div className="col-span-12">
                          <Label className="text-[10px] uppercase text-muted-foreground">{t("devis.line_details")}</Label>
                          <Textarea rows={2} value={l.details} onChange={(e) => updateLine(i, { details: e.target.value })} placeholder={t("devis.line_details_ph")} />
                        </div>

                        {l.line_type === "moe" && (
                          <>
                            <div className="col-span-12 sm:col-span-4">
                              <Label className="text-[10px] uppercase text-muted-foreground">{t("devis.moe_mission")}</Label>
                              <Select value={l.mission_code ?? "__none"} onValueChange={(v) => updateLine(i, { mission_code: v === "__none" ? null : v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none">{t("devis.moe_mission_none")}</SelectItem>
                                  {MISSION_CODES.map(code => (
                                    <SelectItem key={code} value={code}>
                                      {code} — {MISSION_LABELS[code][devis.language]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="col-span-12 sm:col-span-4">
                              <Label className="text-[10px] uppercase text-muted-foreground">{t("devis.moe_pricing_mode")}</Label>
                              <div className="inline-flex rounded-md border bg-background overflow-hidden text-xs h-9">
                                <button type="button" className={`px-3 ${l.pricing_mode === "amount" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`} onClick={() => updateLine(i, { pricing_mode: "amount" })}>€ {t("devis.moe_pricing_amount")}</button>
                                <button type="button" className={`px-3 ${l.pricing_mode === "percent" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`} onClick={() => updateLine(i, { pricing_mode: "percent" })}>% {t("devis.moe_pricing_percent")}</button>
                              </div>
                            </div>
                            {l.pricing_mode === "percent" && (
                              <div className="col-span-12 sm:col-span-4">
                                <Label className="text-[10px] uppercase text-muted-foreground">{t("devis.moe_percent_of_budget")}</Label>
                                <Input type="number" step="0.01" min={0} className="text-right tabular-nums" value={l.percent_of_budget} onChange={(e) => updateLine(i, { percent_of_budget: Number(e.target.value) })} />
                                {!budget && <p className="text-[10px] text-amber-600 mt-1">{t("devis.moe_no_budget")}</p>}
                              </div>
                            )}
                          </>
                        )}

                        <div className="col-span-6 sm:col-span-2">
                          <Label className="text-[10px] uppercase text-muted-foreground">{t("devis.line_qty")}</Label>
                          <Input type="number" step="0.01" min={0} className="text-right tabular-nums" value={l.quantity} onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })} disabled={l.line_type === "moe" && l.pricing_mode === "percent"} />
                        </div>
                        <div className="col-span-6 sm:col-span-2">
                          <Label className="text-[10px] uppercase text-muted-foreground">{t("devis.line_unit")}</Label>
                          <Select value={l.unit} onValueChange={(v) => updateLine(i, { unit: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {UNIT_KEYS.map(uk => {
                                const v = t(`units.${uk}`);
                                return <SelectItem key={uk} value={v}>{v}</SelectItem>;
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-6 sm:col-span-2">
                          <Label className="text-[10px] uppercase text-muted-foreground">{t("devis.line_pu")}</Label>
                          <Input type="number" step="0.01" className="text-right tabular-nums" value={l.line_type === "moe" && l.pricing_mode === "percent" ? +(budget * (Number(l.percent_of_budget || 0) / 100)).toFixed(2) : l.unit_price_ht} onChange={(e) => updateLine(i, { unit_price_ht: Number(e.target.value) })} disabled={l.line_type === "moe" && l.pricing_mode === "percent"} />
                        </div>
                        <div className="col-span-6 sm:col-span-3">
                          <Label className="text-[10px] uppercase text-muted-foreground">{t("devis.line_discount")}</Label>
                          <div className="flex gap-1">
                            <Input type="number" step="0.01" min={0} className="text-right tabular-nums" value={l.discount_value} onChange={(e) => updateLine(i, { discount_value: Number(e.target.value) })} />
                            <ToggleUnit value={l.discount_type} onChange={(v) => updateLine(i, { discount_type: v })} />
                          </div>
                        </div>
                        <div className="col-span-6 sm:col-span-3">
                          <Label className="text-[10px] uppercase text-muted-foreground">{t("devis.line_vat")}</Label>
                          <Select value={String(l.vat_rate)} onValueChange={(v) => updateLine(i, { vat_rate: Number(v) })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {VAT_RATES.map(r => <SelectItem key={r} value={String(r)}>{r} %</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <Button variant="ghost" size="icon" onClick={() => removeLine(i)} aria-label={t("devis.remove")}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>

                    <div className="flex justify-end text-sm border-t pt-2">
                      <span className="text-muted-foreground mr-3">{t("devis.line_total")}</span>
                      <span className={`font-semibold tabular-nums ${net < 0 ? "text-destructive" : ""}`}>
                        {fmtEUR(net, uiLang)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* CONDITIONS */}
          <Card className="p-5 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t("devis.section_conditions")}</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label={t("devis.payment_terms")}>
                <Select value={devis.payment_terms_preset ?? ""} onValueChange={(v) => update({ payment_terms_preset: v })}>
                  <SelectTrigger><SelectValue placeholder={t("devis.client_choose")} /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TERM_KEYS.map(k => {
                      const v = t(`payment_terms.${k}`);
                      return <SelectItem key={k} value={v}>{v}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </Field>
              <div className="space-y-2">
                <Label className="text-xs">{t("devis.payment_methods")}</Label>
                <div className="flex flex-wrap gap-3 pt-1">
                  {PAYMENT_METHOD_KEYS.map(k => {
                    const label = t(`payment_methods.${k}`);
                    const checked = devis.payment_methods.includes(label);
                    return (
                      <label key={k} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(c) => update({
                            payment_methods: c
                              ? [...devis.payment_methods, label]
                              : devis.payment_methods.filter(x => x !== label),
                          })}
                        />
                        {label}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <Field label={t("devis.conditions_notes")}>
              <Textarea rows={4} value={devis.conditions_notes ?? ""} onChange={(e) => update({ conditions_notes: e.target.value })} placeholder={t("devis.conditions_ph")} />
            </Field>

            <div className="space-y-2">
              <Label className="text-xs">{t("devis.legal_mentions")}</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {LEGAL_MENTION_KEYS.map(k => {
                  const checked = devis.legal_mentions.includes(k);
                  const labelKey = k === "vat293b" ? "devis.legal_293b"
                    : k === "free" ? "devis.legal_free"
                    : k === "late" ? "devis.legal_late"
                    : "devis.legal_discount";
                  return (
                    <label key={k} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(c) => update({
                          legal_mentions: c
                            ? [...devis.legal_mentions, k]
                            : devis.legal_mentions.filter(x => x !== k),
                        })}
                      />
                      {t(labelKey)}
                    </label>
                  );
                })}
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("devis.signature")}</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label={t("devis.signature_name")}>
                  <Input
                    value={devis.signature_client_name ?? (savedClient?.contact_name ?? savedClient?.name ?? newClient.contact_name ?? newClient.name ?? "")}
                    onChange={(e) => update({ signature_client_name: e.target.value })}
                  />
                </Field>
                <Field label={t("devis.signature_date")}>
                  <Input type="date" value={devis.signature_date ?? ""} onChange={(e) => update({ signature_date: e.target.value || null })} />
                </Field>
              </div>
              <div className="border-2 border-dashed rounded-md h-24 flex items-center justify-center text-xs text-muted-foreground">
                {t("devis.signature_space")}
              </div>
            </div>

            <Field label={t("devis.internal_notes")}>
              <Textarea rows={2} value={devis.notes ?? ""} onChange={(e) => update({ notes: e.target.value })} />
            </Field>
          </Card>

          {/* PAYMENT SCHEDULE */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t("devis.section_schedule")}</h2>
              <Button size="sm" variant="outline" onClick={() => update({ payment_schedule: [...devis.payment_schedule, { label: "", mode: "percent", value: 0, milestone: "" }] })}>
                <Plus className="size-4" /> {t("devis.schedule_add")}
              </Button>
            </div>
            {devis.payment_schedule.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6 border border-dashed rounded-md">{t("devis.schedule_empty")}</p>
            ) : (
              <div className="space-y-2">
                {devis.payment_schedule.map((row, i) => {
                  const amt = row.mode === "percent" ? totals.totalTTC * (Number(row.value || 0) / 100) : Number(row.value || 0);
                  return (
                    <div key={i} className="grid grid-cols-12 gap-2 items-end border rounded-md p-2 bg-card">
                      <div className="col-span-12 sm:col-span-4">
                        <Label className="text-[10px] uppercase text-muted-foreground">{t("devis.schedule_label")}</Label>
                        <Input value={row.label} placeholder={t("devis.schedule_label_ph")} onChange={(e) => {
                          const next = [...devis.payment_schedule]; next[i] = { ...row, label: e.target.value }; update({ payment_schedule: next });
                        }} />
                      </div>
                      <div className="col-span-6 sm:col-span-3">
                        <Label className="text-[10px] uppercase text-muted-foreground">{t("devis.schedule_amount")}</Label>
                        <div className="flex gap-1">
                          <Input type="number" step="0.01" min={0} className="text-right tabular-nums" value={row.value} onChange={(e) => {
                            const next = [...devis.payment_schedule]; next[i] = { ...row, value: Number(e.target.value) }; update({ payment_schedule: next });
                          }} />
                          <ToggleUnit value={row.mode} onChange={(v) => {
                            const next = [...devis.payment_schedule]; next[i] = { ...row, mode: v }; update({ payment_schedule: next });
                          }} />
                        </div>
                      </div>
                      <div className="col-span-6 sm:col-span-4">
                        <Label className="text-[10px] uppercase text-muted-foreground">{t("devis.schedule_milestone")}</Label>
                        <Input value={row.milestone} placeholder={t("devis.schedule_milestone_ph")} onChange={(e) => {
                          const next = [...devis.payment_schedule]; next[i] = { ...row, milestone: e.target.value }; update({ payment_schedule: next });
                        }} />
                      </div>
                      <div className="col-span-10 sm:col-span-1 text-right tabular-nums text-xs text-muted-foreground">
                        {fmtEUR(amt, uiLang)}
                      </div>
                      <div className="col-span-2 sm:col-span-12 sm:flex sm:justify-end">
                        <Button variant="ghost" size="icon" onClick={() => {
                          update({ payment_schedule: devis.payment_schedule.filter((_, j) => j !== i) });
                        }}>
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {(() => {
                  const total = devis.payment_schedule.reduce((s, r) => s + (r.mode === "percent" ? totals.totalTTC * (Number(r.value || 0) / 100) : Number(r.value || 0)), 0);
                  return (
                    <div className="flex justify-between text-xs pt-2 border-t">
                      <span className="text-muted-foreground">{t("devis.schedule_total")}</span>
                      <span className="tabular-nums font-semibold">{fmtEUR(total, uiLang)} <span className="text-muted-foreground font-normal">· {t("devis.schedule_remaining")}: {fmtEUR(totals.totalTTC - total, uiLang)}</span></span>
                    </div>
                  );
                })()}
              </div>
            )}
          </Card>
        </div>

        {/* SUMMARY sidebar */}
        <Card className="p-5 space-y-4 h-fit lg:sticky lg:top-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t("devis.section_summary")}</h2>

          <Row k={t("devis.summary_gross")} v={fmtEUR(totals.subtotalHT, uiLang)} />

          <div className="space-y-2">
            <Label className="text-xs">{t("devis.summary_global_discount")}</Label>
            <div className="flex gap-1">
              <Input type="number" step="0.01" min={0} className="text-right tabular-nums" value={devis.global_discount_value} onChange={(e) => update({ global_discount_value: Number(e.target.value) })} />
              <ToggleUnit value={devis.global_discount_type} onChange={(v) => update({ global_discount_type: v })} />
            </div>
            {totals.globalDiscAmt > 0 &&
              <div className="text-xs text-muted-foreground text-right">− {fmtEUR(totals.globalDiscAmt, uiLang)}</div>}
          </div>

          <Separator />

          <Row k={t("devis.summary_net")} v={fmtEUR(totals.netAfterDiscount, uiLang)} />

          {totals.vatByRate.length > 0 ? (
            <div className="space-y-1">
              {totals.vatByRate.map(([rate, amt]) => (
                <Row key={rate} k={t("devis.summary_vat_rate", { rate })} v={fmtEUR(amt, uiLang)} muted />
              ))}
              <Row k={t("devis.summary_vat_total")} v={fmtEUR(totals.totalVAT, uiLang)} />
            </div>
          ) : (
            <p className="text-xs italic text-muted-foreground">{t("devis.summary_vat_na")}</p>
          )}

          <Separator />

          <div className="flex justify-between items-baseline">
            <span className="font-semibold">{t("devis.summary_total_ttc")}</span>
            <span className="text-xl font-bold tabular-nums text-primary">{fmtEUR(totals.totalTTC, uiLang)}</span>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label className="text-xs">{t("devis.summary_deposit_ask")}</Label>
            <div className="flex gap-1">
              <Input type="number" step="0.01" min={0} className="text-right tabular-nums" value={devis.deposit_value} onChange={(e) => update({ deposit_value: Number(e.target.value) })} />
              <ToggleUnit value={devis.deposit_type} onChange={(v) => update({ deposit_type: v })} />
            </div>
            {totals.depositAmount > 0 && (
              <div className="space-y-1 pt-2">
                <Row k={t("devis.summary_deposit_due")} v={fmtEUR(totals.depositAmount, uiLang)} muted />
                <Row k={t("devis.summary_balance")} v={fmtEUR(totals.balance, uiLang)} muted />
              </div>
            )}
          </div>

          <Separator />

          <Button variant="outline" className="w-full" onClick={() => save("draft")} disabled={saving}>
            <Save className="size-4" /> {t("devis.save_draft")}
          </Button>
        </Card>
      </div>

      {/* Preview */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-5xl h-[85vh] p-0">
          <DialogHeader className="p-4 border-b"><DialogTitle>{t("devis.preview_title")}</DialogTitle></DialogHeader>
          <div className="flex-1 h-full">
            {previewUrl && <iframe src={previewUrl} title="PDF" className="w-full h-full border-0" />}
          </div>
        </DialogContent>
      </Dialog>

      {/* Library */}
      <Dialog open={presetsOpen} onOpenChange={setPresetsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t("devis.library_title")}</DialogTitle></DialogHeader>
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {presets.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">{t("devis.library_empty")}</p>
            )}
            {presets.map(p => (
              <button
                key={p.id}
                onClick={() => addPreset(p)}
                className="w-full text-left p-3 rounded-md hover:bg-accent border flex justify-between items-center"
              >
                <div>
                  <div className="font-medium text-sm">
                    {devis.language === "fr" ? p.label_fr : p.label_en}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {devis.language === "fr" ? p.label_en : p.label_fr}
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <Badge variant="secondary">{p.default_unit ?? "—"}</Badge>
                  {p.default_rate != null && <div className="mt-1 tabular-nums">{fmtEUR(Number(p.default_rate), uiLang)}</div>}
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children, className, help }: { label: string; children: React.ReactNode; className?: string; help?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
      {help ? <p className="text-[11px] text-muted-foreground">{help}</p> : null}
    </div>
  );
}

function Row({ k, v, muted, bold }: { k: string; v: string; muted?: boolean; bold?: boolean }) {
  return (
    <div className={`flex justify-between text-sm ${muted ? "text-muted-foreground" : ""} ${bold ? "font-semibold" : ""}`}>
      <span>{k}</span>
      <span className="tabular-nums">{v}</span>
    </div>
  );
}

function ToggleUnit({ value, onChange }: { value: DiscountType; onChange: (v: DiscountType) => void }) {
  return (
    <div className="inline-flex rounded-md border bg-background overflow-hidden text-xs shrink-0">
      <button type="button" className={`px-2 ${value === "percent" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`} onClick={() => onChange("percent")}>%</button>
      <button type="button" className={`px-2 ${value === "amount" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`} onClick={() => onChange("amount")}>€</button>
    </div>
  );
}
