import { Document, Page, Text, View, StyleSheet, Image, Font } from "@react-pdf/renderer";
import type { Lang } from "@/lib/i18n";
import { L } from "@/lib/i18n";

export type PdfProfile = {
  legal_name: string | null; trading_name: string | null; legal_form: string | null;
  address_line1: string | null; address_line2: string | null; postcode: string | null; city: string | null; country: string | null;
  siret: string | null; ape_code: string | null; rcs_or_rm: string | null;
  vat_status: "franchise_293b" | "tva_registered"; vat_number: string | null; vat_rate: number;
  rc_pro_insurer: string | null; rc_pro_policy: string | null; decennale_insurer: string | null; insurance_geographic_cover: string | null;
  iban: string | null; bic: string | null;
  default_payment_terms: string | null; late_penalty_terms: string | null; default_footer_note: string | null;
  logo_url: string | null; brand_color: string | null;
};

export type PdfClient = {
  name: string; contact_name: string | null; address_line1: string | null; address_line2: string | null;
  postcode: string | null; city: string | null; country: string | null; email: string | null; phone: string | null;
} | null;

export type PdfDevis = {
  devis_number: string; issue_date: string; validity_until: string; language: Lang;
  project_description: string | null; project_start: string | null; project_duration: string | null;
  subtotal_ht: number; vat_amount: number; total_ttc: number; deposit_amount: number | null; notes: string | null;
  lines: { description: string; quantity: number; unit: string | null; unit_price_ht: number; line_total_ht: number }[];
};

const NAVY = "#0f1b3d";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: "#1a1a1a", fontFamily: "Helvetica", lineHeight: 1.4 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 30, paddingBottom: 16, borderBottom: `2pt solid ${NAVY}` },
  logo: { width: 60, height: 60, objectFit: "contain" },
  brand: { fontSize: 18, fontWeight: 700, color: NAVY, letterSpacing: 1 },
  brandSub: { fontSize: 8, color: "#555", marginTop: 2, textTransform: "uppercase", letterSpacing: 1 },
  devisBlock: { textAlign: "right" },
  devisTitle: { fontSize: 20, fontWeight: 700, color: NAVY, letterSpacing: 2 },
  meta: { fontSize: 9, color: "#444", marginTop: 4 },
  twoCol: { flexDirection: "row", gap: 16, marginBottom: 20 },
  col: { flex: 1, padding: 12, backgroundColor: "#f7f8fa", borderRadius: 4 },
  colLabel: { fontSize: 8, color: NAVY, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, fontWeight: 700 },
  projectBox: { padding: 12, borderLeft: `3pt solid ${NAVY}`, marginBottom: 18, backgroundColor: "#fafbfc" },
  table: { marginTop: 8 },
  tHead: { flexDirection: "row", backgroundColor: NAVY, color: "#fff", padding: 8, fontSize: 9, fontWeight: 700 },
  tRow: { flexDirection: "row", padding: 8, borderBottom: "0.5pt solid #e2e4e8", fontSize: 9 },
  cDesc: { flex: 4 },
  cQty: { flex: 1, textAlign: "right" },
  cUnit: { flex: 1, textAlign: "center" },
  cPU: { flex: 1.3, textAlign: "right" },
  cTot: { flex: 1.5, textAlign: "right" },
  totals: { marginTop: 18, alignSelf: "flex-end", width: 260 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  totalRowBold: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderTop: `1pt solid ${NAVY}`, marginTop: 4, fontWeight: 700, fontSize: 11, color: NAVY },
  tvaMention: { fontSize: 8, fontStyle: "italic", color: "#444", marginTop: 6, textAlign: "right" },
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 9, color: NAVY, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700, marginBottom: 4 },
  signature: { marginTop: 28, padding: 12, border: `1pt solid ${NAVY}` },
  signatureText: { fontSize: 9.5, fontWeight: 700, color: NAVY },
  signatureSpace: { marginTop: 24, height: 40 },
  footer: { position: "absolute", bottom: 20, left: 40, right: 40, fontSize: 7, color: "#666", textAlign: "center", borderTop: "0.5pt solid #ddd", paddingTop: 6 },
});

const fmt = (n: number) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + " €";
const fmtD = (d: string | null) => (d ? new Date(d).toLocaleDateString("fr-FR") : "—");

export function DevisPDF({ profile, client, devis }: { profile: PdfProfile; client: PdfClient; devis: PdfDevis }) {
  const lang = devis.language;
  const tva = profile.vat_status === "tva_registered";
  const tradingName = profile.trading_name || profile.legal_name || "Plan B Concept";
  const balance = devis.deposit_amount ? devis.total_ttc - Number(devis.deposit_amount) : null;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            {profile.logo_url ? <Image src={profile.logo_url} style={styles.logo} /> : null}
            <View>
              <Text style={styles.brand}>{tradingName}</Text>
              <Text style={styles.brandSub}>Maîtrise d'œuvre · Project Management</Text>
            </View>
          </View>
          <View style={styles.devisBlock}>
            <Text style={styles.devisTitle}>{L.devis[lang]} {L.number[lang]} {devis.devis_number}</Text>
            <Text style={styles.meta}>{L.date[lang]}: {fmtD(devis.issue_date)}</Text>
            <Text style={styles.meta}>{L.validUntil[lang]}: {fmtD(devis.validity_until)}</Text>
          </View>
        </View>

        {/* Issuer + Client */}
        <View style={styles.twoCol}>
          <View style={styles.col}>
            <Text style={styles.colLabel}>{L.issuer[lang]}</Text>
            <Text style={{ fontWeight: 700 }}>{profile.legal_name || tradingName}</Text>
            {profile.legal_form ? <Text>{profile.legal_form}</Text> : null}
            {profile.address_line1 ? <Text>{profile.address_line1}</Text> : null}
            {profile.address_line2 ? <Text>{profile.address_line2}</Text> : null}
            <Text>{[profile.postcode, profile.city].filter(Boolean).join(" ")}{profile.country ? `, ${profile.country}` : ""}</Text>
            {profile.siret ? <Text style={{ marginTop: 4 }}>SIRET: {profile.siret}</Text> : null}
            {profile.ape_code ? <Text>APE: {profile.ape_code}</Text> : null}
            {profile.rcs_or_rm ? <Text>RCS/RM: {profile.rcs_or_rm}</Text> : null}
            {tva && profile.vat_number ? <Text>{L.vatNo[lang]}: {profile.vat_number}</Text> : null}
          </View>
          <View style={styles.col}>
            <Text style={styles.colLabel}>{L.client[lang]}</Text>
            {client ? (
              <>
                <Text style={{ fontWeight: 700 }}>{client.name}</Text>
                {client.contact_name ? <Text>{client.contact_name}</Text> : null}
                {client.address_line1 ? <Text>{client.address_line1}</Text> : null}
                {client.address_line2 ? <Text>{client.address_line2}</Text> : null}
                <Text>{[client.postcode, client.city].filter(Boolean).join(" ")}{client.country ? `, ${client.country}` : ""}</Text>
                {client.email ? <Text style={{ marginTop: 4, color: "#555" }}>{client.email}</Text> : null}
                {client.phone ? <Text style={{ color: "#555" }}>{client.phone}</Text> : null}
              </>
            ) : <Text style={{ color: "#999" }}>—</Text>}
          </View>
        </View>

        {/* Project */}
        {(devis.project_description || devis.project_start || devis.project_duration) ? (
          <View style={styles.projectBox}>
            <Text style={styles.colLabel}>{L.project[lang]}</Text>
            {devis.project_description ? <Text>{devis.project_description}</Text> : null}
            <View style={{ flexDirection: "row", gap: 16, marginTop: 4 }}>
              {devis.project_start ? <Text style={{ color: "#555" }}>{L.startDate[lang]}: {fmtD(devis.project_start)}</Text> : null}
              {devis.project_duration ? <Text style={{ color: "#555" }}>{L.duration[lang]}: {devis.project_duration}</Text> : null}
            </View>
          </View>
        ) : null}

        {/* Lines */}
        <View style={styles.table}>
          <View style={styles.tHead}>
            <Text style={styles.cDesc}>{L.description[lang]}</Text>
            <Text style={styles.cQty}>{L.qty[lang]}</Text>
            <Text style={styles.cUnit}>{L.unit[lang]}</Text>
            <Text style={styles.cPU}>{L.unitPrice[lang]}</Text>
            <Text style={styles.cTot}>{L.lineTotal[lang]}</Text>
          </View>
          {devis.lines.map((l, i) => (
            <View key={i} style={styles.tRow}>
              <Text style={styles.cDesc}>{l.description}</Text>
              <Text style={styles.cQty}>{Number(l.quantity)}</Text>
              <Text style={styles.cUnit}>{l.unit || "—"}</Text>
              <Text style={styles.cPU}>{fmt(Number(l.unit_price_ht))}</Text>
              <Text style={styles.cTot}>{fmt(Number(l.line_total_ht))}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text>{L.subtotal[lang]}</Text>
            <Text>{fmt(devis.subtotal_ht)}</Text>
          </View>
          {tva ? (
            <View style={styles.totalRow}>
              <Text>{L.vat[lang]} ({profile.vat_rate} %)</Text>
              <Text>{fmt(devis.vat_amount)}</Text>
            </View>
          ) : null}
          <View style={styles.totalRowBold}>
            <Text>{L.totalTtc[lang]}</Text>
            <Text>{fmt(devis.total_ttc)}</Text>
          </View>
          {!tva ? <Text style={styles.tvaMention}>TVA non applicable, article 293 B du CGI</Text> : null}
          {devis.deposit_amount && balance !== null ? (
            <>
              <View style={[styles.totalRow, { marginTop: 8 }]}><Text>{L.deposit[lang]}</Text><Text>{fmt(Number(devis.deposit_amount))}</Text></View>
              <View style={styles.totalRow}><Text>{L.balance[lang]}</Text><Text>{fmt(balance)}</Text></View>
            </>
          ) : null}
        </View>

        {/* Conditions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{L.paymentTerms[lang]}</Text>
          {profile.default_payment_terms ? <Text>{profile.default_payment_terms}</Text> : null}
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{L.latePenalty[lang]}</Text>
          {profile.late_penalty_terms ? <Text>{profile.late_penalty_terms}</Text> : null}
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{L.validity[lang]} · {L.free[lang]}</Text>
          <Text>{L.validUntil[lang]}: {fmtD(devis.validity_until)}</Text>
        </View>

        {devis.notes ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{L.notes[lang]}</Text>
            <Text>{devis.notes}</Text>
          </View>
        ) : null}

        {/* Signature — French only */}
        <View style={styles.signature} wrap={false}>
          <Text style={styles.signatureText}>Devis reçu avant l'exécution des travaux — Bon pour accord, le …………  Signature :</Text>
          <View style={styles.signatureSpace} />
        </View>

        {/* Footer */}
        <Text style={styles.footer} fixed>
          {[profile.legal_name || tradingName, profile.legal_form, [profile.address_line1, profile.postcode, profile.city, profile.country].filter(Boolean).join(", "), profile.siret ? `SIRET ${profile.siret}` : null, profile.ape_code ? `APE ${profile.ape_code}` : null, tva && profile.vat_number ? `TVA ${profile.vat_number}` : null].filter(Boolean).join(" · ")}
          {"\n"}
          {[profile.iban ? `IBAN ${profile.iban}` : null, profile.bic ? `BIC ${profile.bic}` : null].filter(Boolean).join(" · ")}
          {"\n"}
          {[profile.rc_pro_insurer ? `RC Pro: ${profile.rc_pro_insurer}${profile.rc_pro_policy ? ` (${profile.rc_pro_policy})` : ""}` : null, profile.decennale_insurer ? `Décennale: ${profile.decennale_insurer}` : null, profile.insurance_geographic_cover].filter(Boolean).join(" · ")}
          {profile.default_footer_note ? `\n${profile.default_footer_note}` : ""}
        </Text>
      </Page>
    </Document>
  );
}
