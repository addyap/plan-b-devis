import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, Eye, Mail } from "lucide-react";
import { fmtEUR } from "@/lib/format";
import { toast } from "sonner";
import { generateFacturePdf, pdfToBase64, type PdfProfile, type PdfClient, type PdfFacture, type PdfLine } from "@/lib/pdf";

export const Route = createFileRoute("/_app/factures/$id")({
  component: FactureEditor,
});

type Facture = {
  id: string; facture_number: string; client_id: string | null;
  issue_date: string; due_date: string;
  status: "draft"|"sent"|"paid"|"overdue"|"cancelled";
  language: "en" | "fr";
  project_description: string | null; project_start: string | null; project_duration: string | null;
  subtotal_ht: number; vat_amount: number; total_ttc: number;
  deposit_amount: number | null; notes: string | null;
  sent_at: string | null;
};

type Line = { id?: string; description: string; quantity: number; unit: string; unit_price_ht: number; line_total_ht: number; sort_order: number };

function FactureEditor() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [fac, setFac] = useState<Facture | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [profile, setProfile] = useState<PdfProfile | null>(null);
  const [client, setClient] = useState<PdfClient>(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const [f, l, p] = await Promise.all([
        supabase.from("factures").select("*").eq("id", id).maybeSingle(),
        supabase.from("facture_lines").select("*").eq("facture_id", id).order("sort_order"),
        supabase.from("business_profile").select("*").limit(1).maybeSingle(),
      ]);
      const fd = f.data as Facture;
      setFac(fd);
      setLines((l.data ?? []) as Line[]);
      setProfile(p.data as unknown as PdfProfile);
      if (fd?.client_id) {
        const { data } = await supabase.from("clients").select("*").eq("id", fd.client_id).maybeSingle();
        setClient((data as PdfClient) ?? null);
      }
    })();
  }, [id]);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const subtotal = useMemo(() => lines.reduce((s, l) => s + Number(l.quantity) * Number(l.unit_price_ht), 0), [lines]);
  const vatRate = profile?.vat_status === "tva_registered" ? Number(profile?.vat_rate ?? 0) : 0;
  const vatAmount = +(subtotal * (vatRate / 100)).toFixed(2);
  const totalTtc = +(subtotal + vatAmount).toFixed(2);

  if (!fac || !profile) return <div className="text-muted-foreground">Loading…</div>;

  const update = (patch: Partial<Facture>) => setFac({ ...fac, ...patch });

  const save = async (newStatus?: Facture["status"]) => {
    setSaving(true);
    const { error } = await supabase.from("factures").update({
      issue_date: fac.issue_date, due_date: fac.due_date, status: newStatus ?? fac.status, language: fac.language,
      project_description: fac.project_description, project_start: fac.project_start || null, project_duration: fac.project_duration,
      subtotal_ht: subtotal, vat_amount: vatAmount, total_ttc: totalTtc,
      deposit_amount: fac.deposit_amount, notes: fac.notes,
    }).eq("id", id);
    if (error) { toast.error(error.message); setSaving(false); return false; }
    if (newStatus) setFac({ ...fac, status: newStatus });
    setSaving(false);
    toast.success("Saved");
    return true;
  };

  const pdfFacture: PdfFacture = {
    facture_number: fac.facture_number, issue_date: fac.issue_date, due_date: fac.due_date,
    language: fac.language,
    project_description: fac.project_description, project_start: fac.project_start, project_duration: fac.project_duration,
    subtotal_ht: subtotal, vat_amount: vatAmount, total_ttc: totalTtc,
    deposit_amount: fac.deposit_amount, notes: fac.notes,
  };
  const pdfLines: PdfLine[] = lines.map((l) => ({ description: l.description, quantity: Number(l.quantity), unit: l.unit, unit_price_ht: Number(l.unit_price_ht), line_total_ht: +(Number(l.quantity) * Number(l.unit_price_ht)).toFixed(2) }));

  const download = async () => {
    const doc = await generateFacturePdf(pdfFacture, pdfLines, profile, client);
    doc.save(`${fac.facture_number}.pdf`);
  };
  const preview = async () => {
    const doc = await generateFacturePdf(pdfFacture, pdfLines, profile, client);
    const blob = doc.output("blob");
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(blob));
    setPreviewOpen(true);
  };

  const send = async () => {
    if (!client?.email) return toast.error("Client has no email.");
    if (!profile.sender_email) return toast.error("Set a sender email in Settings first.");
    setSending(true);
    try {
      await save();
      const doc = await generateFacturePdf(pdfFacture, pdfLines, profile, client);
      const b64 = await pdfToBase64(doc);
      const { data, error } = await supabase.functions.invoke("send-facture", {
        body: { facture_id: id, to: client.email, pdf_base64: b64, filename: `${fac.facture_number}.pdf` },
      });
      if (error || (data && (data as any).error)) {
        const msg = error?.message || (data as any)?.error || "Send failed";
        await supabase.from("factures").update({ last_email_error: msg }).eq("id", id);
        toast.error(`Email failed: ${msg}`);
      } else {
        const now = new Date().toISOString();
        await supabase.from("factures").update({ sent_at: now, status: "sent", last_email_error: null }).eq("id", id);
        setFac({ ...fac, sent_at: now, status: "sent" });
        toast.success(`Sent to ${client.email}`);
      }
    } finally { setSending(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4 justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/factures" })}><ArrowLeft className="size-4" /></Button>
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Facture</div>
            <h1 className="text-2xl font-semibold font-mono">{fac.facture_number}</h1>
          </div>
          <Badge variant="secondary" className="ml-2">{fac.status}</Badge>
          {fac.sent_at && <span className="text-xs text-muted-foreground">Sent {new Date(fac.sent_at).toLocaleString()}</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={preview}><Eye className="size-4" /> Preview</Button>
          <Button variant="outline" onClick={download}><Download className="size-4" /> PDF</Button>
          <Button variant="outline" onClick={send} disabled={sending}><Mail className="size-4" /> {sending ? "Sending…" : "Send to client"}</Button>
          <Button variant="outline" onClick={() => save("paid")} disabled={saving}>Mark paid</Button>
          <Button onClick={() => save()} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-5 space-y-4 lg:col-span-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">Issue date</Label><Input type="date" value={fac.issue_date} onChange={(e) => update({ issue_date: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Due date</Label><Input type="date" value={fac.due_date} onChange={(e) => update({ due_date: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5"><Label className="text-xs">Project description</Label><Textarea rows={3} value={fac.project_description ?? ""} onChange={(e) => update({ project_description: e.target.value })} /></div>

          <div className="pt-4 border-t">
            <h2 className="font-semibold mb-3">Line items</h2>
            <div className="space-y-2">
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-start border rounded-md p-2">
                  <div className="col-span-6 text-sm">{l.description}</div>
                  <div className="col-span-1 text-right text-sm tabular-nums">{l.quantity}</div>
                  <div className="col-span-1 text-center text-sm">{l.unit}</div>
                  <div className="col-span-2 text-right text-sm tabular-nums">{fmtEUR(l.unit_price_ht)}</div>
                  <div className="col-span-2 text-right text-sm tabular-nums font-medium">{fmtEUR(l.line_total_ht)}</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">Lines are copied from the source devis at conversion. To edit, modify the source devis and reconvert.</p>
          </div>

          <div className="space-y-1.5 pt-4 border-t">
            <Label className="text-xs">Notes</Label>
            <Textarea rows={3} value={fac.notes ?? ""} onChange={(e) => update({ notes: e.target.value })} />
          </div>
        </Card>

        <Card className="p-5 space-y-3 h-fit sticky top-4">
          <h2 className="font-semibold">Totals</h2>
          <Row k="Subtotal HT" v={fmtEUR(subtotal)} />
          {vatRate > 0 ? <Row k={`VAT (${vatRate}%)`} v={fmtEUR(vatAmount)} /> : (
            <p className="text-xs italic text-muted-foreground">TVA non applicable, article 293 B du CGI</p>
          )}
          <div className="border-t pt-2"><Row k="Total TTC" v={fmtEUR(totalTtc)} bold /></div>
        </Card>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-5xl h-[85vh] p-0">
          <DialogHeader className="p-4 border-b"><DialogTitle>PDF preview</DialogTitle></DialogHeader>
          <div className="flex-1 h-full">{previewUrl && <iframe src={previewUrl} title="PDF" className="w-full h-full border-0" />}</div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const Row = ({ k, v, bold }: { k: string; v: string; bold?: boolean }) => (
  <div className={`flex justify-between text-sm ${bold ? "font-semibold text-base" : ""}`}><span>{k}</span><span className="tabular-nums">{v}</span></div>
);
