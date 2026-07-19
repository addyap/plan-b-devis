import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import fr from "./locales/fr.json";
import en from "./locales/en.json";

// SSR-safe init: no browser language detector at module load.
// We always boot in French (the default) so the server and the client
// first paint match. The client-side hook below switches the language
// after hydration based on localStorage.
if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
      fr: { translation: fr },
      en: { translation: en },
    },
    lng: "fr",
    fallbackLng: "fr",
    supportedLngs: ["fr", "en"],
    load: "languageOnly",
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
}

const STORAGE_KEY = "pbc.lang";

export function syncClientLocale() {
  if (typeof window === "undefined") return;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const nav = (typeof navigator !== "undefined" ? navigator.language : "fr") || "fr";
    const detected = (saved || nav).toLowerCase().startsWith("fr") ? "fr" : "en";
    if (i18n.language !== detected) void i18n.changeLanguage(detected);
  } catch {
    /* ignore */
  }
}

export function persistLocale(lang: "fr" | "en") {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* ignore */
  }
}

export default i18n;
export type UiLang = "fr" | "en";
