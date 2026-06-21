export const fmtEUR = (n: number | null | undefined) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(n ?? 0));

export const fmtDate = (d: string | null | undefined, lang: "en" | "fr" = "fr") => {
  if (!d) return "";
  const date = new Date(d);
  return new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", {
    day: "2-digit", month: "2-digit", year: "numeric",
  }).format(date);
};

export const addDays = (iso: string, days: number) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export const todayISO = () => new Date().toISOString().slice(0, 10);
