import { useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { useT } from "../i18n/LanguageContext";
import LanguageSwitcher from "../components/LanguageSwitcher";
import type { ApiError } from "../api/client";

export default function Login() {
  const { login } = useAuth();
  const { t } = useT();
  const [subdomain, setSubdomain] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login({ username, password, subdomain });
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 429) {
        setError(t("login.tooManyAttempts"));
      } else {
        setError(apiErr.detail ?? t("login.failed"));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0805",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Radial glow blobs */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(60% 50% at 20% 30%, rgba(176,141,87,0.12), transparent 70%), " +
            "radial-gradient(40% 40% at 85% 80%, rgba(212,175,122,0.08), transparent 70%)",
          pointerEvents: "none",
        }}
      />
      {/* Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(120% 80% at 50% 50%, transparent 55%, rgba(0,0,0,0.5) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Card */}
      <div
        style={{
          width: "calc(100% - 32px)",
          maxWidth: 340,
          background: "#161208",
          borderRadius: 16,
          border: "1px solid rgba(176,141,87,0.22)",
          padding: "36px 24px",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "rgba(176,141,87,0.45)",
              marginBottom: 10,
            }}
          >
            EduPage · {t("login.eyebrow")}
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 1, height: 16, background: "rgba(176,141,87,0.5)" }} />
            <span
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 20,
                fontWeight: 400,
                color: "#E8DCC7",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              AstroPage
            </span>
            <div style={{ width: 1, height: 16, background: "rgba(176,141,87,0.5)" }} />
          </div>
        </div>

        <div style={{ height: 1, background: "rgba(176,141,87,0.12)", marginBottom: 20 }} />

        <form onSubmit={handleSubmit}>
          <Field
            label={t("login.school")}
            value={subdomain}
            onChange={setSubdomain}
            placeholder="spsezochova"
            autoComplete="organization"
          />
          <Field
            label={t("login.username")}
            value={username}
            onChange={setUsername}
            placeholder="janko.hrasko"
            autoComplete="username"
          />
          <Field
            label={t("login.password")}
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
            autoComplete="current-password"
            style={{ marginBottom: 20 }}
          />

          {error && (
            <div
              role="alert"
              style={{
                background: "rgba(100,48,48,0.2)",
                border: "1px solid rgba(100,48,48,0.35)",
                borderRadius: 6,
                padding: "9px 12px",
                marginBottom: 14,
                fontFamily: "'Inter', sans-serif",
                fontSize: 12,
                color: "#c88888",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: "100%",
              background: submitting ? "rgba(176,141,87,0.6)" : "#B08D57",
              color: "#0a0805",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              fontWeight: 500,
              padding: 13,
              textAlign: "center",
              borderRadius: 6,
              border: "none",
              cursor: submitting ? "not-allowed" : "pointer",
              transition: "background 0.2s",
            }}
          >
            {submitting ? t("login.submitting") : t("login.submit")}
          </button>
        </form>

        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 8,
            letterSpacing: "0.12em",
            color: "rgba(176,141,87,0.28)",
            marginTop: 14,
            textAlign: "center",
          }}
        >
          {t("settings.passwordNever")}
        </div>

        <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
          <LanguageSwitcher />
        </div>
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  style?: React.CSSProperties;
}

function Field({ label, value, onChange, type = "text", placeholder, autoComplete, style }: FieldProps) {
  return (
    <div style={{ marginBottom: 14, ...style }}>
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "rgba(176,141,87,0.6)",
          marginBottom: 5,
        }}
      >
        {label}
      </div>
      <input
        type={type}
        required
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          padding: "10px 12px",
          fontFamily: type === "password" ? "'Inter', sans-serif" : "'Cormorant Garamond', serif",
          fontSize: type === "password" ? 15 : 17,
        }}
      />
    </div>
  );
}
