// Manual reload control shared by every data page. Shows a spinning glyph while
// a refresh is in flight and, optionally, how long ago the data was last loaded
// (so the user knows whether what they're seeing is current).

import { useEffect, useState } from "react";

import { useT } from "../i18n/LanguageContext";

type Translate = (key: string, vars?: Record<string, string | number>) => string;

function agoLabel(ts: number, t: Translate): string {
  const secs = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (secs < 60) return t("time.justNow");
  const mins = Math.floor(secs / 60);
  if (mins < 60) return t("time.minAgo", { n: mins });
  const hrs = Math.floor(mins / 60);
  return t("time.hAgo", { n: hrs });
}

export default function RefreshButton({
  onRefresh,
  refreshing,
  lastUpdated,
}: {
  onRefresh: () => void;
  refreshing: boolean;
  lastUpdated: number | null;
}) {
  const { t } = useT();
  // Re-render once a minute so the "X min ago" label stays accurate.
  const [, force] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => force((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {lastUpdated !== null && (
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "rgba(176,141,87,0.45)",
          }}
        >
          {refreshing ? t("refresh.refreshing") : t("refresh.updated", { ago: agoLabel(lastUpdated, t) })}
        </span>
      )}
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        aria-label={t("refresh.label")}
        title={t("refresh.label")}
        style={{
          display: "grid",
          placeItems: "center",
          width: 30,
          height: 30,
          borderRadius: 6,
          border: "1px solid rgba(176,141,87,0.18)",
          background: "transparent",
          color: "#B08D57",
          cursor: refreshing ? "default" : "pointer",
          opacity: refreshing ? 0.6 : 1,
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            animation: refreshing ? "ap-spin 0.8s linear infinite" : undefined,
            transformOrigin: "center",
          }}
        >
          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
          <path d="M21 3v6h-6" />
        </svg>
      </button>
      <style>{`@keyframes ap-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
