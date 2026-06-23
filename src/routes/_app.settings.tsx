import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Upload } from "lucide-react";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

type Profile = {
  id: string;
  legal_name: string | null;
  trading_name: string | null;
  legal_form: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postcode: string | null;
  city: string | null;
  country: string | null;
  siret: string | null;
  ape_code: string | null;
  rcs_or_rm: string | null;
  vat_status: "franchise_293b" | "tva_registered";
  vat_number: string | null;
  vat_rate: number;
  rc_pro_insurer: string | null;
  rc_pro_policy: string | null;
  decennale_insurer: string | null;
  insurance_geographic_cover: string | null;
  iban: string | null;
  bic: string | null;
  default_validity_days: number;
  default_payment_terms: string | null;
  late_penalty_terms: string | null;
  default_footer_note: string | null;
  logo_url: string | null;
  brand_color: string | null;
  sender_email: string | null;
};

function SettingsPage() {
  const [p, setP] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("business_profile").select("*").limit(1).maybeSingle().then(({ data }) => {
      setP(data as Profile);
    });
  }, []);

  const update = (patch: Partial<Profile>) => setP((prev) => (prev ? { ...prev, ...patch } : prev));

  const save = async () => {
    if (!p) return;
    setSaving(true);
    const { error } = await supabase.from("business_profile").update(p).eq("id", p.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
  };

  const onLogo = async (file: File) => {
    if (!p) return;
    const path = `logo-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("logos").upload(path, file, { upsert: true });
    if (error) return toast.error(error.message);
    const { data } = supabase.storage.from("logos").getPublicUrl(path);
    update({ logo_url: data.publicUrl });
    await supabase.from("business_profile").update({ logo_url: data.publicUrl }).eq("id", p.id);
    toast.success("Logo uploaded");
  };

  if (!p) return <div className="text-muted-foreground">Loading…</div>;

  const tva = p.vat_status === "tva_registered";

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Business profile</h1>
        <p className="text-sm text-muted-foreground mt-1">Legal identity printed on every devis.</p>
      </div>

      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold">Identity</h2>
        <Row><F label="Legal name" v={p.legal_name} on={(v) => update({ legal_name: v })} /><F label="Trading name" v={p.trading_name} on={(v) => update({ trading_name: v })} /></Row>
        <Row><F label="Legal form" v={p.legal_form} on={(v) => update({ legal_form: v })} /><F label="SIRET" v={p.siret} on={(v) => update({ siret: v })} /></Row>
        <Row><F label="APE / NAF code" v={p.ape_code} on={(v) => update({ ape_code: v })} /><F label="RCS / RM" v={p.rcs_or_rm} on={(v) => update({ rcs_or_rm: v })} /></Row>
      </Card>

      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold">Address</h2>
        <F label="Address line 1" v={p.address_line1} on={(v) => update({ address_line1: v })} />
        <F label="Address line 2" v={p.address_line2} on={(v) => update({ address_line2: v })} />
        <Row><F label="Postcode" v={p.postcode} on={(v) => update({ postcode: v })} /><F label="City" v={p.city} on={(v) => update({ city: v })} /><F label="Country" v={p.country} on={(v) => update({ country: v })} /></Row>
      </Card>

      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold">VAT status</h2>
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div>
            <div className="font-medium">{tva ? "TVA registered" : "Franchise en base (art. 293 B)"}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {tva ? "VAT applied on all devis." : 'PDF prints "TVA non applicable, article 293 B du CGI".'}
            </div>
          </div>
          <Switch checked={tva} onCheckedChange={(c) => update({ vat_status: c ? "tva_registered" : "franchise_293b" })} />
        </div>
        {tva && (
          <Row>
            <F label="VAT number" v={p.vat_number} on={(v) => update({ vat_number: v })} />
            <div className="space-y-1.5"><Label className="text-xs">VAT rate (%)</Label><Input type="number" value={p.vat_rate} onChange={(e) => update({ vat_rate: Number(e.target.value) })} /></div>
          </Row>
        )}
      </Card>

      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold">Insurance</h2>
        <Row><F label="RC Pro insurer" v={p.rc_pro_insurer} on={(v) => update({ rc_pro_insurer: v })} /><F label="RC Pro policy" v={p.rc_pro_policy} on={(v) => update({ rc_pro_policy: v })} /></Row>
        <Row><F label="Décennale insurer" v={p.decennale_insurer} on={(v) => update({ decennale_insurer: v })} /><F label="Geographic cover" v={p.insurance_geographic_cover} on={(v) => update({ insurance_geographic_cover: v })} /></Row>
      </Card>

      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold">Bank</h2>
        <Row><F label="IBAN" v={p.iban} on={(v) => update({ iban: v })} /><F label="BIC" v={p.bic} on={(v) => update({ bic: v })} /></Row>
      </Card>

      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold">Email</h2>
        <F label="Sender email (must be on a Resend-verified domain)" v={p.sender_email} on={(v) => update({ sender_email: v })} />
        <p className="text-xs text-muted-foreground">Used as the From address when sending devis &amp; factures.</p>
      </Card>

      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold">Devis defaults</h2>
        <div className="space-y-1.5">
          <Label className="text-xs">Default validity (days)</Label>
          <Input type="number" value={p.default_validity_days} onChange={(e) => update({ default_validity_days: Number(e.target.value) })} className="max-w-[200px]" />
        </div>
        <TF label="Default payment terms" v={p.default_payment_terms} on={(v) => update({ default_payment_terms: v })} />
        <TF label="Late penalty wording" v={p.late_penalty_terms} on={(v) => update({ late_penalty_terms: v })} />
        <TF label="Default footer note" v={p.default_footer_note} on={(v) => update({ default_footer_note: v })} />
      </Card>

      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold">Branding</h2>
        <div className="flex items-center gap-4">
          {p.logo_url ? (
            <img src={p.logo_url} alt="Logo" className="size-20 object-contain border rounded-lg p-2 bg-white" />
          ) : (
            <div className="size-20 border-2 border-dashed rounded-lg flex items-center justify-center text-muted-foreground text-xs">No logo</div>
          )}
          <label className="cursor-pointer">
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onLogo(e.target.files[0])} />
            <span className="inline-flex items-center gap-2 px-4 py-2 border rounded-md text-sm hover:bg-accent"><Upload className="size-4" /> Upload logo</span>
          </label>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} size="lg" disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
      </div>
    </div>
  );
}

const Row = ({ children }: { children: React.ReactNode }) => <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>;
const F = ({ label, v, on }: { label: string; v: string | null; on: (v: string) => void }) => (
  <div className="space-y-1.5"><Label className="text-xs">{label}</Label><Input value={v ?? ""} onChange={(e) => on(e.target.value)} /></div>
);
const TF = ({ label, v, on }: { label: string; v: string | null; on: (v: string) => void }) => (
  <div className="space-y-1.5"><Label className="text-xs">{label}</Label><Textarea rows={3} value={v ?? ""} onChange={(e) => on(e.target.value)} /></div>
);
