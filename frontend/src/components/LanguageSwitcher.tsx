// Compact EN / SK toggle. Used in the sidebar footer and on the login screen.

import { useT } from "../i18n/LanguageContext";
import { LANG_SHORT, LANGS } from "../i18n/translations";

export default function LanguageSwitcher() {
  const { lang, setLang } = useT();
  return (
    <div style={{ display: "inline-flex", gap: 2, padding: 2, borderRadius: 6, border: "1px solid rgba(176,141,87,0.18)" }}>
      {LANGS.map((l) => {
        const active = l === lang;
        return (
          <button
            key={l}
            type="button"
            onClick={() => setLang(l)}
            aria-pressed={active}
            style={{
              padding: "4px 9px",
              borderRadius: 4,
              border: "none",
              cursor: active ? "default" : "pointer",
              background: active ? "rgba(176,141,87,0.16)" : "transparent",
              color: active ? "#B08D57" : "rgba(232,220,199,0.45)",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9,
              letterSpacing: "0.1em",
            }}
          >
            {LANG_SHORT[l]}
          </button>
        );
      })}
    </div>
  );
}
