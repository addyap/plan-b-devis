export type Locale = "fr" | "en";

const locale = (l: Locale) => (l === "fr" ? "fr-FR" : "en-GB");

export const fmtEUR = (n: number | null | undefined, lang: Locale = "fr") =>
  new Intl.NumberFormat(locale(lang), { style: "currency", currency: "EUR" }).format(Number(n ?? 0));

export const fmtDate = (d: string | null | undefined, lang: Locale = "fr") => {
  if (!d) return "";
  const date = new Date(d);
  return new Intl.DateTimeFormat(locale(lang), {
    day: "2-digit", month: "2-digit", year: "numeric",
  }).format(date);
};

export const fmtDateTime = (d: string | null | undefined, lang: Locale = "fr") => {
  if (!d) return "";
  return new Intl.DateTimeFormat(locale(lang), {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(d));
};

export const addDays = (iso: string, days: number) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export const todayISO = () => new Date().toISOString().slice(0, 10);
