import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { L, type Lang } from "@/lib/i18n";
// Inline the brand logo at build time so the PDF can embed it without any
// network fetch (avoids cross-origin / CORS issues when drawing into jsPDF).
import brandLogoDataUrl from "@/assets/plan-b-logo.png?inline";

export type PdfProfile = {
  id?: string;
  legal_name: string | null; trading_name: string | null; legal_form: string | null;
  address_line1: string | null; address_line2: string | null; postcode: string | null; city: string | null; country: string | null;
  siret: string | null; ape_code: string | null; rcs_or_rm: string | null;
  vat_status: "franchise_293b" | "tva_registered"; vat_number: string | null; vat_rate: number;
  rc_pro_insurer: string | null; rc_pro_policy: string | null; decennale_insurer: string | null; insurance_geographic_cover: string | null;
  iban: string | null; bic: string | null;
  default_payment_terms: string | null; late_penalty_terms: string | null; default_footer_note: string | null;
  default_validity_days?: number | null;
  logo_url: string | null; brand_color: string | null;
  sender_email?: string | null;
};

export type PdfClient = {
  name: string; contact_name: string | null; address_line1: string | null; address_line2: string | null;
  postcode: string | null; city: string | null; country: string | null; email: string | null; phone: string | null;
} | null;

export type PdfLine = { description: string; quantity: number; unit: string | null; unit_price_ht: number; line_total_ht: number };

export type SchedulePdfRow = { label: string; milestone: string; amount: number; pct: number };

export type PdfDevis = {
  devis_number: string; issue_date: string; validity_until: string; language: Lang;
  project_description: string | null; project_start: string | null; project_duration: string | null;
  subtotal_ht: number; vat_amount: number; total_ttc: number; deposit_amount: number | null; notes: string | null;
  project_name?: string | null;
  site_address?: string | null;
  operation_type?: string | null;
  surface_m2?: number | null;
  works_budget_ht?: number | null;
  mission_phases?: string[];
  honoraires_ht?: number;
  honoraires_pct?: number;
  payment_schedule?: SchedulePdfRow[];
};

export type PdfFacture = {
  facture_number: string; issue_date: string; due_date: string; language: Lang;
  project_description: string | null; project_start: string | null; project_duration: string | null;
  subtotal_ht: number; vat_amount: number; total_ttc: number; deposit_amount: number | null; notes: string | null;
};

const MAROON: [number, number, number] = [46, 16, 17];    // #2E1011
const BRICK: [number, number, number] = [155, 46, 42];    // #9B2E2A
const GOLD: [number, number, number] = [242, 203, 60];    // #F2CB3C
// Back-compat alias used throughout the file
const NAVY = MAROON;
const locale = (l: Lang) => (l === "fr" ? "fr-FR" : "en-GB");
const fmtMoney = (n: number, lang: Lang) =>
  new Intl.NumberFormat(locale(lang), { style: "currency", currency: "EUR" }).format(Number(n || 0));
const fmtD = (d: string | null | undefined, lang: Lang) =>
  d ? new Intl.DateTimeFormat(locale(lang), { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(d)) : "—";


async function dataUrlToDims(dataUrl: string): Promise<{ w: number; h: number }> {
  if (typeof Image === "undefined") return { w: 1, h: 1 };
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.width, h: img.height });
    img.onerror = () => resolve({ w: 1, h: 1 });
    img.src = dataUrl;
  });
}

async function fetchLogoDataUrl(logoUrl: string | null): Promise<{ data: string; w: number; h: number; fmt: "PNG" | "JPEG" } | null> {
  // No custom logo on the profile → embed the bundled brand logo directly.
  if (!logoUrl) {
    const dims = await dataUrlToDims(brandLogoDataUrl);
    return { data: brandLogoDataUrl, w: dims.w, h: dims.h, fmt: "PNG" };
  }
  try {
    // If it's a Supabase storage URL, try to grab a signed url for the path (bucket is private)
    let url = logoUrl;
    const m = logoUrl.match(/\/storage\/v1\/object\/(?:public|sign)\/logos\/([^?]+)/);
    if (m) {
      const { data } = await supabase.storage.from("logos").createSignedUrl(decodeURIComponent(m[1]), 300);
      if (data?.signedUrl) url = data.signedUrl;
    }
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const fmt: "PNG" | "JPEG" = blob.type.includes("png") ? "PNG" : "JPEG";
    const dataUrl: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    const dims = await dataUrlToDims(dataUrl);
    return { data: dataUrl, w: dims.w, h: dims.h, fmt };
  } catch {
    return null;
  }
}

type DocKind = "devis" | "facture";


type CommonInput = {
  kind: DocKind;
  number: string;
  issueDate: string;
  rightDateLabel: string;
  rightDate: string;
  language: Lang;
  projectDescription: string | null;
  projectStart: string | null;
  projectDuration: string | null;
  subtotalHt: number;
  vatAmount: number;
  totalTtc: number;
  depositAmount: number | null;
  notes: string | null;
  lines: PdfLine[];
  // MOE extras (devis only)
  projectName?: string | null;
  siteAddress?: string | null;
  operationType?: string | null;
  surfaceM2?: number | null;
  worksBudgetHt?: number | null;
  missionPhases?: string[];
  honorairesHt?: number;
  honorairesPct?: number;
  paymentSchedule?: SchedulePdfRow[];
};

async function buildPdf(input: CommonInput, profile: PdfProfile, client: PdfClient): Promise<jsPDF> {
  const lang = input.language;
  const tva = profile.vat_status === "tva_registered";
  const tradingName = profile.trading_name || profile.legal_name || "Plan B Concept";
  const balance = input.depositAmount ? input.totalTtc - Number(input.depositAmount) : null;
  const titleWord = input.kind === "devis" ? L.devis[lang] : L.facture[lang];

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 14;
  let y = 0;

  // Maroon header band across the top
  const bandH = 30;
  doc.setFillColor(...MAROON).rect(0, 0, pageW, bandH, "F");
  // Gold accent rule beneath the band
  doc.setFillColor(...GOLD).rect(0, bandH, pageW, 1.2, "F");

  // Logo on the band
  const logo = await fetchLogoDataUrl(profile.logo_url);
  const logoH = 20;
  let logoW = 0;
  if (logo) {
    logoW = Math.min(34, (logo.w / logo.h) * logoH);
    try { doc.addImage(logo.data, logo.fmt, M, (bandH - logoH) / 2, logoW, logoH, undefined, "FAST"); } catch { /* ignore */ }
  }
  const nameX = M + (logo ? logoW + 10 : 0);
  doc.setFont("helvetica", "bold").setFontSize(15).setTextColor(255, 255, 255);
  doc.text(tradingName, nameX, 13);
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...GOLD);
  doc.text("C\u00F4te d\u2019Azur \u00B7 Ma\u00eetrise d\u2019\u0153uvre \u00b7 Project Management", nameX, 18);

  // Title + meta on right side of band
  doc.setFont("helvetica", "bold").setFontSize(18).setTextColor(...GOLD);
  doc.text(`${titleWord} N\u00B0 ${input.number}`, pageW - M, 14, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(255, 255, 255);
  doc.text(`${L.date[lang]} : ${fmtD(input.issueDate, lang)}`, pageW - M, 20, { align: "right" });
  doc.text(`${input.rightDateLabel} : ${fmtD(input.rightDate, lang)}`, pageW - M, 25, { align: "right" });

  y = bandH + 8;

  // Two-column: Issuer / Client
  const colW = (pageW - M * 2 - 6) / 2;
  const issuerLines: string[] = [];
  issuerLines.push(profile.legal_name || tradingName);
  if (profile.legal_form) issuerLines.push(profile.legal_form);
  if (profile.address_line1) issuerLines.push(profile.address_line1);
  if (profile.address_line2) issuerLines.push(profile.address_line2);
  const cityLine = [profile.postcode, profile.city].filter(Boolean).join(" ") + (profile.country ? `, ${profile.country}` : "");
  if (cityLine.trim()) issuerLines.push(cityLine);
  if (profile.siret) issuerLines.push(`SIRET : ${profile.siret}`);
  if (profile.ape_code) issuerLines.push(`APE : ${profile.ape_code}`);
  if (profile.rcs_or_rm) issuerLines.push(`RCS/RM : ${profile.rcs_or_rm}`);
  if (tva && profile.vat_number) issuerLines.push(`${L.vatNo[lang]} : ${profile.vat_number}`);

  const clientLines: string[] = [];
  if (client) {
    clientLines.push(client.name);
    if (client.contact_name) clientLines.push(client.contact_name);
    if (client.address_line1) clientLines.push(client.address_line1);
    if (client.address_line2) clientLines.push(client.address_line2);
    const cl = [client.postcode, client.city].filter(Boolean).join(" ") + (client.country ? `, ${client.country}` : "");
    if (cl.trim()) clientLines.push(cl);
    if (client.email) clientLines.push(client.email);
    if (client.phone) clientLines.push(client.phone);
  } else {
    clientLines.push("—");
  }

  const drawBox = (x: number, label: string, lines: string[]) => {
    const boxH = 8 + lines.length * 4.4 + 4;
    doc.setFillColor(247, 248, 250).rect(x, y, colW, boxH, "F");
    doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...NAVY);
    doc.text(label.toUpperCase(), x + 3, y + 5);
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(30);
    lines.forEach((ln, i) => doc.text(ln, x + 3, y + 10 + i * 4.4));
    return boxH;
  };
  const h1 = drawBox(M, L.issuer[lang], issuerLines);
  const h2 = drawBox(M + colW + 6, L.client[lang], clientLines);
  y += Math.max(h1, h2) + 6;

  // Project box
  if (input.projectDescription || input.projectStart || input.projectDuration) {
    doc.setDrawColor(...NAVY).setLineWidth(1.2).line(M, y, M, y + 16);
    doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...NAVY);
    doc.text(L.project[lang].toUpperCase(), M + 3, y + 4);
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(30);
    const descLines = input.projectDescription
      ? doc.splitTextToSize(input.projectDescription, pageW - M * 2 - 4)
      : [];
    descLines.forEach((ln: string, i: number) => doc.text(ln, M + 3, y + 9 + i * 4.4));
    let py = y + 9 + descLines.length * 4.4;
    const meta: string[] = [];
    if (input.projectStart) meta.push(`${L.startDate[lang]}: ${fmtD(input.projectStart, lang)}`);
    if (input.projectDuration) meta.push(`${L.duration[lang]}: ${input.projectDuration}`);
    if (meta.length) { doc.setTextColor(90); doc.text(meta.join("   "), M + 3, py + 2); py += 4.4; }
    y = py + 4;
  }

  // MOE project block (devis)
  if (input.kind === "devis" && (input.projectName || input.siteAddress || input.operationType || input.surfaceM2 || input.worksBudgetHt || (input.missionPhases && input.missionPhases.length))) {
    const rows: [string, string][] = [];
    if (input.projectName) rows.push([L.projectName[lang], input.projectName]);
    if (input.siteAddress) rows.push([L.siteAddress[lang], input.siteAddress]);
    if (input.operationType) rows.push([L.operationType[lang], input.operationType]);
    if (input.surfaceM2) rows.push([L.surface[lang], `${input.surfaceM2} m²`]);
    if (input.worksBudgetHt) rows.push([L.worksBudget[lang], fmtMoney(Number(input.worksBudgetHt), lang)]);
    if (input.missionPhases && input.missionPhases.length) rows.push([L.missionPhases[lang], input.missionPhases.join(" · ")]);
    const boxH = 6 + rows.length * 4.6 + 3;
    doc.setFillColor(247, 248, 250).rect(M, y, pageW - M * 2, boxH, "F");
    doc.setDrawColor(...GOLD).setLineWidth(1.2).line(M, y, M, y + boxH);
    rows.forEach((r, i) => {
      doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...NAVY);
      doc.text(r[0].toUpperCase(), M + 3, y + 6 + i * 4.6);
      doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(30);
      doc.text(r[1], M + 55, y + 6 + i * 4.6);
    });
    y += boxH + 4;
  }

  // Lines table
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [[L.description[lang], L.qty[lang], L.unit[lang], L.unitPrice[lang], L.lineTotal[lang]]],
    body: input.lines.map((l) => [
      l.description,
      String(Number(l.quantity)),
      l.unit || "—",
      fmtMoney(Number(l.unit_price_ht), lang),
      fmtMoney(Number(l.line_total_ht), lang),

    ]),
    headStyles: { fillColor: BRICK, textColor: 255, fontStyle: "bold", fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: 30 },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { halign: "right", cellWidth: 16 },
      2: { halign: "center", cellWidth: 20 },
      3: { halign: "right", cellWidth: 28 },
      4: { halign: "right", cellWidth: 30 },
    },
    styles: { cellPadding: 2.5, lineColor: [226, 228, 232], lineWidth: 0.2 },
  });
  // @ts-expect-error autotable side-effect
  y = doc.lastAutoTable.finalY + 6;

  // Totals right-aligned
  const totalsX = pageW - M - 80;
  const valX = pageW - M;
  const row = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal").setFontSize(bold ? 11 : 9).setTextColor(bold ? NAVY[0] : 30, bold ? NAVY[1] : 30, bold ? NAVY[2] : 30);
    doc.text(label, totalsX, y);
    doc.text(value, valX, y, { align: "right" });
    y += bold ? 6.5 : 5;
  };
  row(L.subtotal[lang], fmtMoney(input.subtotalHt, lang));
  if (tva) row(`${L.vat[lang]} (${profile.vat_rate} %)`, fmtMoney(input.vatAmount, lang));
  // Gold accent rule before the total
  doc.setDrawColor(...GOLD).setLineWidth(0.8).line(totalsX, y, valX, y); y += 3;
  // Total TTC row — brick red filled band with white text
  {
    const rowH = 9;
    doc.setFillColor(...BRICK).rect(totalsX - 2, y - 1, valX - totalsX + 2, rowH, "F");
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(255, 255, 255);
    doc.text(L.totalTtc[lang], totalsX, y + 5);
    doc.text(fmtMoney(input.totalTtc, lang), valX - 1, y + 5, { align: "right" });
    y += rowH + 1;
  }
  if (!tva) {
    doc.setFont("helvetica", "italic").setFontSize(8).setTextColor(80);
    doc.text(L.vatNa[lang], valX, y + 2, { align: "right" });
    y += 5;
  }
  if (input.depositAmount && balance !== null) {
    y += 2;
    row(L.deposit[lang], fmtMoney(Number(input.depositAmount), lang));
    row(L.balance[lang], fmtMoney(balance, lang));
  }

  y += 4;

  // Honoraires summary (MOE)
  if (input.kind === "devis" && input.honorairesHt && input.worksBudgetHt) {
    doc.setFillColor(247, 248, 250).rect(M, y, pageW - M * 2, 11, "F");
    doc.setDrawColor(...GOLD).setLineWidth(1.2).line(M, y, M, y + 11);
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...NAVY);
    doc.text(L.totalHonoraires[lang], M + 3, y + 7);
    const pctStr = `${String(input.honorairesPct ?? 0).replace(".", lang === "fr" ? "," : ".")} % ${L.pctOfWorks[lang]}`;
    doc.text(`${fmtMoney(input.honorairesHt, lang)}  \u00B7  ${pctStr}`, pageW - M - 3, y + 7, { align: "right" });
    y += 15;
  }

  // Payment schedule (MOE)
  if (input.kind === "devis" && input.paymentSchedule && input.paymentSchedule.length) {
    doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...NAVY);
    doc.text(L.paymentSchedule[lang].toUpperCase(), M, y); y += 2;
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      head: [[L.description[lang], L.milestone[lang], "%", L.amount[lang]]],
      body: input.paymentSchedule.map(r => [
        r.label || "—",
        r.milestone || "—",
        `${String(r.pct).replace(".", lang === "fr" ? "," : ".")} %`,
        fmtMoney(r.amount, lang),
      ]),
      headStyles: { fillColor: BRICK, textColor: 255, fontStyle: "bold", fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: 30 },
      columnStyles: { 2: { halign: "right", cellWidth: 24 }, 3: { halign: "right", cellWidth: 32 } },
      styles: { cellPadding: 2.5, lineColor: [226, 228, 232], lineWidth: 0.2 },
    });
    // @ts-expect-error autotable side-effect
    y = doc.lastAutoTable.finalY + 6;
  }

  // Conditions (devis only includes validity & "Devis gratuit")
  const ensureSpace = (need: number) => { if (y + need > pageH - 30) { doc.addPage(); y = M; } };

  const sec = (title: string, body: string) => {
    if (!body) return;
    ensureSpace(14);
    doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...NAVY);
    doc.text(title.toUpperCase(), M, y); y += 4;
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(40);
    const wrapped = doc.splitTextToSize(body, pageW - M * 2);
    ensureSpace(wrapped.length * 4.2 + 4);
    wrapped.forEach((ln: string) => { doc.text(ln, M, y); y += 4.2; });
    y += 3;
  };
  sec(L.paymentTerms[lang], profile.default_payment_terms || "");
  sec(L.latePenalty[lang], profile.late_penalty_terms || "");
  if (input.kind === "devis") {
    sec(`${L.validity[lang]} \u00B7 ${L.free[lang]}`, `${L.validUntil[lang]}: ${fmtD(input.rightDate, lang)}`);
  }
  sec(L.notes[lang], input.notes || "");

  // Signature (devis only)
  if (input.kind === "devis") {
    ensureSpace(28);
    doc.setDrawColor(...NAVY).setLineWidth(0.4).rect(M, y, pageW - M * 2, 22);
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...NAVY);
    doc.text(L.signatureBlock[lang], M + 3, y + 6);
    y += 26;
  }

  // Footer on each page
  const footerLines: string[] = [];
  footerLines.push(
    [profile.legal_name || tradingName, profile.legal_form, [profile.address_line1, profile.postcode, profile.city, profile.country].filter(Boolean).join(", "), profile.siret ? `SIRET ${profile.siret}` : null, profile.ape_code ? `APE ${profile.ape_code}` : null, tva && profile.vat_number ? `TVA ${profile.vat_number}` : null].filter(Boolean).join(" \u00B7 "),
  );
  const bank = [profile.iban ? `IBAN ${profile.iban}` : null, profile.bic ? `BIC ${profile.bic}` : null].filter(Boolean).join(" \u00B7 ");
  if (bank) footerLines.push(bank);
  const ins = [profile.rc_pro_insurer ? `RC Pro: ${profile.rc_pro_insurer}${profile.rc_pro_policy ? ` (${profile.rc_pro_policy})` : ""}` : null, profile.decennale_insurer ? `D\u00e9cennale: ${profile.decennale_insurer}` : null, profile.insurance_geographic_cover].filter(Boolean).join(" \u00B7 ");
  if (ins) footerLines.push(ins);
  if (profile.default_footer_note) footerLines.push(profile.default_footer_note);

  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setDrawColor(220).setLineWidth(0.2).line(M, pageH - 20, pageW - M, pageH - 20);
    doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(110);
    footerLines.forEach((ln, i) => doc.text(ln, pageW / 2, pageH - 17 + i * 3.2, { align: "center", maxWidth: pageW - M * 2 }));
  }

  return doc;
}

export async function generateDevisPdf(
  devis: PdfDevis,
  lines: PdfLine[],
  profile: PdfProfile,
  client: PdfClient,
): Promise<jsPDF> {
  return buildPdf(
    {
      kind: "devis",
      number: devis.devis_number,
      issueDate: devis.issue_date,
      rightDateLabel: L.validUntil[devis.language],
      rightDate: devis.validity_until,
      language: devis.language,
      projectDescription: devis.project_description,
      projectStart: devis.project_start,
      projectDuration: devis.project_duration,
      subtotalHt: devis.subtotal_ht,
      vatAmount: devis.vat_amount,
      totalTtc: devis.total_ttc,
      depositAmount: devis.deposit_amount,
      notes: devis.notes,
      lines,
      projectName: devis.project_name ?? null,
      siteAddress: devis.site_address ?? null,
      operationType: devis.operation_type ?? null,
      surfaceM2: devis.surface_m2 ?? null,
      worksBudgetHt: devis.works_budget_ht ?? null,
      missionPhases: devis.mission_phases ?? [],
      honorairesHt: devis.honoraires_ht ?? 0,
      honorairesPct: devis.honoraires_pct ?? 0,
      paymentSchedule: devis.payment_schedule ?? [],
    },
    profile,
    client,
  );
}

export async function generateFacturePdf(
  facture: PdfFacture,
  lines: PdfLine[],
  profile: PdfProfile,
  client: PdfClient,
): Promise<jsPDF> {
  return buildPdf(
    {
      kind: "facture",
      number: facture.facture_number,
      issueDate: facture.issue_date,
      rightDateLabel: facture.language === "fr" ? "\u00C9ch\u00e9ance" : "Due date",
      rightDate: facture.due_date,
      language: facture.language,
      projectDescription: facture.project_description,
      projectStart: facture.project_start,
      projectDuration: facture.project_duration,
      subtotalHt: facture.subtotal_ht,
      vatAmount: facture.vat_amount,
      totalTtc: facture.total_ttc,
      depositAmount: facture.deposit_amount,
      notes: facture.notes,
      lines,
    },
    profile,
    client,
  );
}

export async function pdfToBase64(doc: jsPDF): Promise<string> {
  // jsPDF returns a data URI; strip the prefix.
  const dataUri = doc.output("datauristring");
  return dataUri.split(",")[1] ?? "";
}
