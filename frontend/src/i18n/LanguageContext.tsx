// App-wide language state + translation helpers.
//
// English is the default. The choice is persisted to localStorage so it survives
// reloads (it's a UI preference, nothing sensitive). `t` does placeholder
// interpolation; `tn` additionally selects a plural form by count.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { type Lang, LANGS, locales, pluralCategory, translations } from "./translations";

const STORAGE_KEY = "astropage.lang";

type Vars = Record<string, string | number>;

interface LanguageState {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** Intl locale string for the active language (e.g. "en-GB"). */
  locale: string;
  /** Translate a key, filling `{name}` placeholders from `vars`. */
  t: (key: string, vars?: Vars) => string;
  /** Translate a plural key (`key.one` / `.few` / `.other`) for count `n`.
   *  `n` is also available as the `{n}` placeholder. */
  tn: (key: string, n: number, vars?: Vars) => string;
}

const LanguageContext = createContext<LanguageState | null>(null);

function readInitialLang(): Lang {
  if (typeof localStorage !== "undefined") {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && (LANGS as string[]).includes(stored)) return stored as Lang;
  }
  return "en"; // default
}

function fill(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readInitialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore storage failures (private mode etc.)
    }
  }, []);

  const t = useCallback(
    (key: string, vars?: Vars) => {
      const table = translations[lang];
      const template = table[key] ?? translations.en[key] ?? key;
      return fill(template, vars);
    },
    [lang],
  );

  const tn = useCallback(
    (key: string, n: number, vars?: Vars) => {
      const form = pluralCategory(lang, n);
      const table = translations[lang];
      const full = `${key}.${form}`;
      const template =
        table[full] ?? table[`${key}.other`] ?? translations.en[full] ?? translations.en[`${key}.other`] ?? key;
      return fill(template, { n, ...vars });
    },
    [lang],
  );

  const value = useMemo<LanguageState>(
    () => ({ lang, setLang, locale: locales[lang], t, tn }),
    [lang, setLang, t, tn],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- context + hook co-location is intentional
export function useT(): LanguageState {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useT must be used within a LanguageProvider");
  return ctx;
}
