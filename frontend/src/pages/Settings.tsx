import { useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { useT } from "../i18n/LanguageContext";

interface AiRules {
  systemPrompt: string;
  stepByStep: boolean;
  simpleLanguage: boolean;
  citeSources: boolean;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { t } = useT();
  const [rules, setRules] = useState<AiRules>(() => ({
    systemPrompt: t("settings.defaultPrompt"),
    stepByStep: true,
    simpleLanguage: false,
    citeSources: true,
  }));
  const [saved, setSaved] = useState(false);

  function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div style={{ padding: "36px 40px", maxWidth: 680 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(176,141,87,0.5)", marginBottom: 6 }}>
          {t("settings.accountAi")}
        </div>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 34, fontWeight: 500, color: "#E8DCC7", letterSpacing: "-0.01em" }}>
          {t("settings.title")}
        </div>
      </div>

      {/* AI panel */}
      <form
        onSubmit={handleSave}
        style={{
          background: "#161208",
          border: "1px solid rgba(176,141,87,0.14)",
          borderRadius: 12,
          padding: 24,
          marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="3" stroke="#B08D57" strokeWidth="1.2" />
            <path d="M8 1v1.5M8 13.5V15M15 8h-1.5M2.5 8H1M12.6 3.4l-1.1 1.1M4.5 11.5l-1.1 1.1M12.6 12.6l-1.1-1.1M4.5 4.5L3.4 3.4" stroke="#B08D57" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 500, color: "#E8DCC7" }}>
            {t("settings.aiRules")}
          </span>
        </div>

        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(176,141,87,0.5)", marginBottom: 6 }}>
          {t("settings.promptLabel")}
        </div>
        <textarea
          rows={4}
          value={rules.systemPrompt}
          onChange={(e) => setRules((r) => ({ ...r, systemPrompt: e.target.value }))}
          style={{ width: "100%", padding: 12, fontFamily: "'Inter', sans-serif", fontSize: 13, lineHeight: 1.6, resize: "vertical" }}
        />
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: "rgba(232,220,199,0.28)", marginTop: 6, marginBottom: 18 }}>
          {t("settings.promptNote")}
        </div>

        <Toggle
          label={t("settings.presetStepByStep")}
          description={t("settings.presetStepByStepDesc")}
          checked={rules.stepByStep}
          onChange={(v) => setRules((r) => ({ ...r, stepByStep: v }))}
        />
        <Toggle
          label={t("settings.presetSimpler")}
          description={t("settings.presetSimplerDesc")}
          checked={rules.simpleLanguage}
          onChange={(v) => setRules((r) => ({ ...r, simpleLanguage: v }))}
        />
        <Toggle
          label={t("settings.presetCite")}
          description={t("settings.presetCiteDesc")}
          checked={rules.citeSources}
          onChange={(v) => setRules((r) => ({ ...r, citeSources: v }))}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}>
          <button
            type="submit"
            style={{
              background: "#B08D57",
              color: "#0a0805",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              fontWeight: 500,
              padding: "10px 16px",
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              transition: "background 0.2s",
            }}
          >
            {t("settings.save")}
          </button>
          {saved && (
            <span
              aria-live="polite"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 9,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "#88c8a0",
              }}
            >
              ✓ {t("settings.saved")}
            </span>
          )}
        </div>
      </form>

      {/* Account panel */}
      <div
        style={{
          background: "#161208",
          border: "1px solid rgba(176,141,87,0.14)",
          borderRadius: 12,
          padding: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="6" r="3" stroke="#B08D57" strokeWidth="1.2" />
            <path d="M2 14c0-3 2.7-5 6-5s6 2 6 5" stroke="#B08D57" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 500, color: "#E8DCC7" }}>
            {t("settings.account")}
          </span>
        </div>

        <MetaRow label={t("login.username")} value={user?.username ?? "—"} />
        <MetaRow label={t("common.school")} value={`${user?.subdomain ?? "—"}.edupage.org`} />
        <MetaRow label={t("settings.session")} value={t("settings.sessionValue")} />

        <div
          style={{
            marginTop: 16,
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(60,100,72,0.1)",
            border: "1px solid rgba(60,100,72,0.22)",
            borderRadius: 6,
            padding: "10px 14px",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <path d="M7 1L1 5v3c0 3 2.5 5 6 5s6-2 6-5V5L7 1z" stroke="#88c8a0" strokeWidth="1.2" />
            <path d="M4.5 7l1.5 1.5L9.5 5" stroke="#88c8a0" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: "#88c8a0" }}>
            {t("settings.passwordNever")}
          </span>
        </div>
      </div>
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 0",
        borderTop: "1px solid rgba(176,141,87,0.1)",
        gap: 16,
      }}
    >
      <div>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 500, color: "#E8DCC7", marginBottom: 2 }}>
          {label}
        </div>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: "rgba(232,220,199,0.38)" }}>
          {description}
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{
          width: 36,
          height: 20,
          borderRadius: 10,
          background: checked ? "#B08D57" : "rgba(232,220,199,0.1)",
          position: "relative",
          cursor: "pointer",
          flexShrink: 0,
          border: "none",
          transition: "background 0.2s",
          padding: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: checked ? 18 : 2,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "#fff",
            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
            transition: "left 0.2s",
          }}
        />
      </button>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "110px 1fr",
        gap: 10,
        padding: "11px 0",
        borderTop: "1px solid rgba(176,141,87,0.1)",
      }}
    >
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(176,141,87,0.45)" }}>
        {label}
      </span>
      <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "rgba(232,220,199,0.7)" }}>
        {value}
      </span>
    </div>
  );
}
