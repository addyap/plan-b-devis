export type Lang = "en" | "fr";

export const L = {
  devis: { en: "QUOTE", fr: "DEVIS" },
  number: { en: "No.", fr: "Nº" },
  date: { en: "Date", fr: "Date" },
  validUntil: { en: "Valid until", fr: "Valable jusqu'au" },
  issuer: { en: "Issuer", fr: "Émetteur" },
  client: { en: "Client", fr: "Client" },
  project: { en: "Project", fr: "Projet" },
  description: { en: "Description", fr: "Description" },
  qty: { en: "Qty", fr: "Qté" },
  unit: { en: "Unit", fr: "Unité" },
  unitPrice: { en: "Unit price (excl. VAT)", fr: "PU HT" },
  lineTotal: { en: "Total (excl. VAT)", fr: "Total HT" },
  subtotal: { en: "Subtotal (excl. VAT)", fr: "Total HT" },
  vat: { en: "VAT", fr: "TVA" },
  totalTtc: { en: "Total (incl. VAT)", fr: "Total TTC" },
  deposit: { en: "Deposit on order", fr: "Acompte à la commande" },
  balance: { en: "Balance on completion", fr: "Solde à l'achèvement" },
  startDate: { en: "Start date", fr: "Date de début" },
  duration: { en: "Estimated duration", fr: "Durée estimée" },
  notes: { en: "Notes", fr: "Notes" },
  paymentTerms: { en: "Payment terms", fr: "Conditions de règlement" },
  latePenalty: { en: "Late payment", fr: "Pénalités de retard" },
  validity: { en: "Validity", fr: "Validité" },
  free: { en: "Free quote", fr: "Devis gratuit" },
  days: { en: "days", fr: "jours" },
  siret: { en: "SIRET", fr: "SIRET" },
  ape: { en: "APE", fr: "APE" },
  vatNo: { en: "VAT No.", fr: "Nº TVA" },
  rcs: { en: "RCS/RM", fr: "RCS/RM" },
  insurance: { en: "Insurance", fr: "Assurance" },
  bank: { en: "Bank details", fr: "Coordonnées bancaires" },
};

export function t(key: keyof typeof L, lang: Lang) {
  return L[key][lang];
}
