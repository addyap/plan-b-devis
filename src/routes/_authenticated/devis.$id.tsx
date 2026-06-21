import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Download, Eye, GripVertical, Library, Plus, Trash2, UserPlus } from "lucide-react";
import { fmtEUR, todayISO, addDays } from "@/lib/format";
import { toast } from "sonner";
import type { PdfProfile, PdfClient, PdfDevis } from "@/lib/pdf";

export const Route = createFileRoute("/_authenticated/devis/$id")({
  component: DevisEditor,
});

type Line = { id?: string; description: string; quantity: number; unit: string; unit_price_ht: number; line_total_ht: number; sort_order: number };

type Devis = {
  id: string; devis_number: string; client_id: string | null;
  issue_date: string; validity_until: string;
  status: "draft" | "sent" | "accepted" | "declined" | "expired";
  language: "en" | "fr";
  project_description: string | null; project_start: string | null; project_duration: string | null;
  subtotal_ht: number; vat_amount: number; total_ttc: number;
  deposit_amount: number | null; notes: string | null;
};

type Client = { id: string; name: string };

function DevisEditor() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [devis, setDevis] = useState<Devis | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [profile, setProfile] = useState<PdfProfile | null>(null);
  const [presets, setPresets] = useState<{ id: string; label_en: string; label_fr: string; default_unit: string | null; default_rate: number | null }[]>([]);
  const [fullClientData, setFullClientData] = useState<PdfClient>(null);
  const [saving, setSaving] = useState(false);
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (!devis?.client_id) { setFullClientData(null); return; }
    supabase.from("clients").select("*").eq("id", devis.client_id).maybeSingle().then(({ data }) => {
      setFullClientData((data as PdfClient) ?? null);
    });
  }, [devis?.client_id]);

  useEffect(() => {
    (async () => {
      const [d, l, c, p, pr] = await Promise.all([
        supabase.from("devis").select("*").eq("id", id).maybeSingle(),
        supabase.from("devis_lines").select("*").eq("devis_id", id).order("sort_order"),
        supabase.from("clients").select("id, name").order("name"),
        supabase.from("business_profile").select("*").limit(1).maybeSingle(),
        supabase.from("service_presets").select("*").order("sort_order"),
      ]);
      setDevis(d.data as Devis);
      setLines((l.data ?? []) as Line[]);
      setClients((c.data ?? []) as Client[]);
      setProfile(p.data as unknown as PdfProfile);
      setPresets(pr.data ?? []);
    })();
  }, [id]);

  const subtotal = useMemo(() => lines.reduce((s, l) => s + Number(l.quantity) * Number(l.unit_price_ht), 0), [lines]);
  const vatRate = profile?.vat_status === "tva_registered" ? Number(profile?.vat_rate ?? 0) : 0;
  const vatAmount = +(subtotal * (vatRate / 100)).toFixed(2);
  const totalTtc = +(subtotal + vatAmount).toFixed(2);
  const balance = devis?.deposit_amount ? totalTtc - Number(devis.deposit_amount) : null;

  if (!devis || !profile) return <div className="text-muted-foreground">Loading…</div>;

  const update = (patch: Partial<Devis>) => setDevis({ ...devis, ...patch });

  const updateLine = (i: number, patch: Partial<Line>) => {
    const next = [...lines];
    next[i] = { ...next[i], ...patch };
    next[i].line_total_ht = +(Number(next[i].quantity) * Number(next[i].unit_price_ht)).toFixed(2);
    setLines(next);
  };

  const addLine = () => setLines([...lines, { description: "", quantity: 1, unit: "forfait", unit_price_ht: 0, line_total_ht: 0, sort_order: lines.length }]);
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));
  const moveLine = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= lines.length) return;
    const next = [...lines];
    [next[i], next[j]] = [next[j], next[i]];
    setLines(next.map((l, idx) => ({ ...l, sort_order: idx })));
  };

  const addPreset = (p: typeof presets[number]) => {
    setLines([...lines, {
      description: devis.language === "fr" ? p.label_fr : p.label_en,
      quantity: 1, unit: p.default_unit ?? "forfait",
      unit_price_ht: Number(p.default_rate ?? 0), line_total_ht: Number(p.default_rate ?? 0),
      sort_order: lines.length,
    }]);
    setPresetsOpen(false);
  };

  const save = async (newStatus?: Devis["status"]) => {
    setSaving(true);
    const payload = {
      client_id: devis.client_id, issue_date: devis.issue_date, validity_until: devis.validity_until,
      status: newStatus ?? devis.status, language: devis.language,
      project_description: devis.project_description, project_start: devis.project_start || null, project_duration: devis.project_duration,
      subtotal_ht: subtotal, vat_amount: vatAmount, total_ttc: totalTtc,
      deposit_amount: devis.deposit_amount, notes: devis.notes,
    };
    const { error: e1 } = await supabase.from("devis").update(payload).eq("id", id);
    if (e1) { toast.error(e1.message); setSaving(false); return; }
    // Replace lines: delete & re-insert (simple, fine for single-user app)
    await supabase.from("devis_lines").delete().eq("devis_id", id);
    if (lines.length) {
      const { error: e2 } = await supabase.from("devis_lines").insert(
        lines.map((l, i) => ({
          devis_id: id, description: l.description, quantity: l.quantity, unit: l.unit,
          unit_price_ht: l.unit_price_ht, line_total_ht: +(Number(l.quantity) * Number(l.unit_price_ht)).toFixed(2),
          sort_order: i,
        })),
      );
      if (e2) { toast.error(e2.message); setSaving(false); return; }
    }
    if (newStatus) setDevis({ ...devis, status: newStatus });
    setSaving(false);
    toast.success("Saved");
  };

  const currentClient = clients.find((c) => c.id === devis.client_id);

  const pdfDevis: PdfDevis = {
    devis_number: devis.devis_number, issue_date: devis.issue_date, validity_until: devis.validity_until,
    language: devis.language,
    project_description: devis.project_description, project_start: devis.project_start, project_duration: devis.project_duration,
    subtotal_ht: subtotal, vat_amount: vatAmount, total_ttc: totalTtc,
    deposit_amount: devis.deposit_amount, notes: devis.notes,
    lines: lines.map((l) => ({ description: l.description, quantity: Number(l.quantity), unit: l.unit, unit_price_ht: Number(l.unit_price_ht), line_total_ht: +(Number(l.quantity) * Number(l.unit_price_ht)).toFixed(2) })),
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4 justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/dashboard" })}><ArrowLeft className="size-4" /></Button>
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Devis</div>
            <h1 className="text-2xl font-semibold font-mono">{devis.devis_number}</h1>
          </div>
          <Badge variant="secondary" className="ml-2">{devis.status}</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <PdfActions devis={pdfDevis} profile={profile} client={fullClient(clients, devis.client_id, allClients)} setOpen={setPreviewOpen} />
          <Button variant="outline" onClick={() => save("sent")} disabled={saving}>Mark sent</Button>
          <Button variant="outline" onClick={() => save("accepted")} disabled={saving}>Accepted</Button>
          <Button variant="outline" onClick={() => save("declined")} disabled={saving}>Declined</Button>
          <Button onClick={() => save()} disabled={saving}>{saving ? "Saving…" : "Save draft"}</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-5 space-y-4 lg:col-span-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Client</Label>
              <div className="flex gap-2">
                <Select value={devis.client_id ?? ""} onValueChange={(v) => update({ client_id: v || null })}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <NewClientDialog open={newClientOpen} setOpen={setNewClientOpen} onCreated={(c) => { setClients([...clients, c]); update({ client_id: c.id }); }} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Language</Label>
              <Tabs value={devis.language} onValueChange={(v) => update({ language: v as "en" | "fr" })}>
                <TabsList><TabsTrigger value="en">English</TabsTrigger><TabsTrigger value="fr">Français</TabsTrigger></TabsList>
              </Tabs>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Issue date</Label>
              <Input type="date" value={devis.issue_date} onChange={(e) => {
                const v = e.target.value;
                update({ issue_date: v, validity_until: addDays(v, profile.default_payment_terms ? 90 : 90) });
              }} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Valid until</Label>
              <Input type="date" value={devis.validity_until} onChange={(e) => update({ validity_until: e.target.value })} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Project description</Label>
            <Textarea rows={3} value={devis.project_description ?? ""} onChange={(e) => update({ project_description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Project start</Label>
              <Input type="date" value={devis.project_start ?? ""} onChange={(e) => update({ project_start: e.target.value || null })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Estimated duration</Label>
              <Input value={devis.project_duration ?? ""} onChange={(e) => update({ project_duration: e.target.value })} placeholder="e.g. 6 months" />
            </div>
          </div>

          {/* Lines */}
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Line items</h2>
              <div className="flex gap-2">
                <PresetsDialog open={presetsOpen} setOpen={setPresetsOpen} presets={presets} lang={devis.language} onPick={addPreset} />
                <Button size="sm" variant="outline" onClick={addLine}><Plus className="size-4" /> Add line</Button>
              </div>
            </div>
            <div className="space-y-2">
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-start border rounded-md p-2 bg-card">
                  <div className="col-span-1 flex flex-col items-center pt-2 text-muted-foreground">
                    <button onClick={() => moveLine(i, -1)} className="hover:text-foreground" type="button">▲</button>
                    <GripVertical className="size-3" />
                    <button onClick={() => moveLine(i, 1)} className="hover:text-foreground" type="button">▼</button>
                  </div>
                  <Textarea rows={2} className="col-span-5" placeholder="Description" value={l.description} onChange={(e) => updateLine(i, { description: e.target.value })} />
                  <Input className="col-span-1" type="number" step="0.01" value={l.quantity} onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })} />
                  <Input className="col-span-1" value={l.unit} onChange={(e) => updateLine(i, { unit: e.target.value })} />
                  <Input className="col-span-2" type="number" step="0.01" value={l.unit_price_ht} onChange={(e) => updateLine(i, { unit_price_ht: Number(e.target.value) })} />
                  <div className="col-span-1 pt-2 text-right text-sm tabular-nums">{fmtEUR(l.quantity * l.unit_price_ht)}</div>
                  <Button size="icon" variant="ghost" className="col-span-1" onClick={() => removeLine(i)}><Trash2 className="size-4" /></Button>
                </div>
              ))}
              {lines.length === 0 && <div className="text-center text-sm text-muted-foreground py-6 border border-dashed rounded-md">No lines yet.</div>}
            </div>
          </div>

          <div className="space-y-1.5 pt-4 border-t">
            <Label className="text-xs">Notes (appear on PDF)</Label>
            <Textarea rows={3} value={devis.notes ?? ""} onChange={(e) => update({ notes: e.target.value })} />
          </div>
        </Card>

        {/* Totals panel */}
        <Card className="p-5 space-y-3 h-fit sticky top-4">
          <h2 className="font-semibold">Totals</h2>
          <Row k="Subtotal HT" v={fmtEUR(subtotal)} />
          {vatRate > 0 ? (
            <Row k={`VAT (${vatRate}%)`} v={fmtEUR(vatAmount)} />
          ) : (
            <p className="text-xs italic text-muted-foreground">TVA non applicable, article 293 B du CGI</p>
          )}
          <div className="border-t pt-2">
            <Row k="Total TTC" v={fmtEUR(totalTtc)} bold />
          </div>
          <div className="pt-3 border-t space-y-1.5">
            <Label className="text-xs">Deposit (optional)</Label>
            <Input type="number" step="0.01" value={devis.deposit_amount ?? ""} onChange={(e) => update({ deposit_amount: e.target.value ? Number(e.target.value) : null })} />
            {balance !== null && (
              <div className="text-xs text-muted-foreground pt-1">
                Balance on completion: <span className="font-medium text-foreground">{fmtEUR(balance)}</span>
              </div>
            )}
          </div>
        </Card>
      </div>

      <PreviewDialog open={previewOpen} setOpen={setPreviewOpen} devis={pdfDevis} profile={profile} client={fullClient(clients, devis.client_id, allClients)} />
    </div>
  );
}

// Lazy load PDF (browser only)
const PDFViewer = lazy(() => import("@react-pdf/renderer").then((m) => ({ default: m.PDFViewer })));
const PDFDownloadLink = lazy(() => import("@react-pdf/renderer").then((m) => ({ default: m.PDFDownloadLink })));

const Row = ({ k, v, bold }: { k: string; v: string; bold?: boolean }) => (
  <div className={`flex justify-between text-sm ${bold ? "font-semibold text-base" : ""}`}>
    <span>{k}</span><span className="tabular-nums">{v}</span>
  </div>
);

// fetch full client object on demand for PDF
const allClients: Record<string, PdfClient> = {};
function fullClient(_list: Client[], id: string | null, cache: Record<string, PdfClient>): PdfClient {
  if (!id) return null;
  if (cache[id]) return cache[id];
  // populate async
  supabase.from("clients").select("*").eq("id", id).maybeSingle().then(({ data }) => { if (data) cache[id] = data as PdfClient; });
  return cache[id] ?? null;
}

function NewClientDialog({ open, setOpen, onCreated }: { open: boolean; setOpen: (b: boolean) => void; onCreated: (c: Client) => void }) {
  const [name, setName] = useState("");
  const create = async () => {
    if (!name.trim()) return;
    const { data, error } = await supabase.from("clients").insert({ name }).select("id, name").single();
    if (error) return toast.error(error.message);
    onCreated(data as Client);
    setName(""); setOpen(false);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" size="icon"><UserPlus className="size-4" /></Button></DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Quick add client</DialogTitle></DialogHeader>
        <Input placeholder="Client name" value={name} onChange={(e) => setName(e.target.value)} />
        <DialogFooter><Button onClick={create}>Add</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PresetsDialog({ open, setOpen, presets, lang, onPick }: { open: boolean; setOpen: (b: boolean) => void; presets: any[]; lang: "en" | "fr"; onPick: (p: any) => void }) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline"><Library className="size-4" /> Presets</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Service library</DialogTitle></DialogHeader>
        <div className="space-y-1 max-h-96 overflow-y-auto">
          {presets.map((p) => (
            <button key={p.id} onClick={() => onPick(p)} className="w-full text-left p-3 rounded-md hover:bg-accent flex justify-between items-center border">
              <div>
                <div className="font-medium text-sm">{lang === "fr" ? p.label_fr : p.label_en}</div>
                <div className="text-xs text-muted-foreground">{lang === "fr" ? p.label_en : p.label_fr}</div>
              </div>
              <Badge variant="secondary">{p.default_unit}</Badge>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PdfActions({ devis, profile, client, setOpen }: { devis: PdfDevis; profile: PdfProfile; client: PdfClient; setOpen: (b: boolean) => void }) {
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}><Eye className="size-4" /> Preview</Button>
      <Suspense fallback={<Button variant="outline" disabled><Download className="size-4" /> PDF</Button>}>
        <LazyDownload devis={devis} profile={profile} client={client} />
      </Suspense>
    </>
  );
}

function LazyDownload({ devis, profile, client }: { devis: PdfDevis; profile: PdfProfile; client: PdfClient }) {
  const [Doc, setDoc] = useState<any>(null);
  useEffect(() => { import("@/lib/pdf").then((m) => setDoc(() => m.DevisPDF)); }, []);
  if (!Doc) return null;
  return (
    <PDFDownloadLink document={<Doc devis={devis} profile={profile} client={client} />} fileName={`${devis.devis_number}.pdf`}>
      {({ loading }) => (
        <Button variant="outline" disabled={loading}>
          <Download className="size-4" /> {loading ? "…" : "PDF"}
        </Button>
      )}
    </PDFDownloadLink>
  );
}

function PreviewDialog({ open, setOpen, devis, profile, client }: { open: boolean; setOpen: (b: boolean) => void; devis: PdfDevis; profile: PdfProfile; client: PdfClient }) {
  const [Doc, setDoc] = useState<any>(null);
  useEffect(() => { if (open) import("@/lib/pdf").then((m) => setDoc(() => m.DevisPDF)); }, [open]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-5xl h-[85vh] p-0">
        <DialogHeader className="p-4 border-b"><DialogTitle>PDF preview</DialogTitle></DialogHeader>
        <div className="flex-1 h-full">
          {Doc && (
            <Suspense fallback={<div className="p-8 text-muted-foreground">Rendering…</div>}>
              <PDFViewer style={{ width: "100%", height: "100%", border: 0 }}>
                <Doc devis={devis} profile={profile} client={client} />
              </PDFViewer>
            </Suspense>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
