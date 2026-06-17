import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api, type DashboardPeriod, type DashboardSummary } from "../api/client";
import { cachedFetch, peekCache } from "../api/cache";

const DASHBOARD_CACHE_KEY = "dashboard";

type ScheduleState = "past" | "now" | "cancelled" | "normal";

function getScheduleState(p: DashboardPeriod): ScheduleState {
  if (p.isCancelled) return "cancelled";
  const now = new Date();
  const hm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  if (hm > p.end) return "past";
  if (hm >= p.start) return "now";
  return "normal";
}

function skDate(): string {
  return new Date().toLocaleDateString("sk-SK", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function Dashboard() {
  const { user } = useAuth();

  // Seed from cache so returning to the home tab is instant (no spinner/refetch).
  const cached = peekCache<DashboardSummary>(DASHBOARD_CACHE_KEY);
  const [summary, setSummary] = useState<DashboardSummary | null>(cached ?? null);
  const [loading, setLoading] = useState(cached === undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    cachedFetch(DASHBOARD_CACHE_KEY, api.getDashboard)
      .then((data) => { if (!cancelled) setSummary(data); })
      .catch((err: { detail?: string }) => {
        if (!cancelled) setError(err?.detail ?? "Nepodarilo sa načítať prehľad z EduPage.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const firstName = (user?.username ?? "Študent").split(".")[0];
  const displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1);

  return (
    <div style={{ padding: "36px 40px" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "rgba(176,141,87,0.5)",
            marginBottom: 6,
          }}
        >
          {skDate()}
        </div>
        <div
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 34,
            fontWeight: 500,
            color: "#E8DCC7",
            letterSpacing: "-0.01em",
            lineHeight: 1,
          }}
        >
          Dobrý deň,{" "}
          <em style={{ fontStyle: "italic", color: "#B08D57" }}>{displayName}.</em>
        </div>
      </div>

      {error ? (
        <div style={{ background: "rgba(90,40,40,0.2)", border: "1px solid rgba(90,40,40,0.35)", borderRadius: 10, padding: "48px 24px", textAlign: "center" }}>
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "#c88888", margin: 0 }}>{error}</p>
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: "rgba(232,220,199,0.3)", margin: "6px 0 0" }}>
            Skúste znova alebo sa prihláste.
          </p>
        </div>
      ) : loading || !summary ? (
        <DashboardSkeleton />
      ) : (
        <DashboardBody summary={summary} />
      )}
    </div>
  );
}

function DashboardBody({ summary }: { summary: DashboardSummary }) {
  const { dueWithin24h, pendingHomework, lessonsTotal, lessonsCancelled, schedule, scheduleAvailable } = summary;

  return (
    <>
      {/* Urgent banner */}
      {dueWithin24h > 0 && (
        <Link to="/homework" style={{ textDecoration: "none" }}>
          <div
            style={{
              background: "rgba(120,88,32,0.14)",
              border: "1px solid rgba(140,106,48,0.3)",
              borderRadius: 8,
              padding: "11px 16px",
              marginBottom: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#d4a85a", flexShrink: 0 }} />
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "#d4a85a" }}>
                {dueWithin24h === 1
                  ? "1 úloha splatná do 24 hodín"
                  : `${dueWithin24h} ${dueWithin24h < 5 ? "úlohy" : "úloh"} splatných do 24 hodín`}
              </span>
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(212,168,90,0.65)" }}>
              Otvoriť →
            </div>
          </div>
        </Link>
      )}

      {/* Metric cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 32 }}>
        <MetricCard
          dot="#B08D57"
          dotLabelColor="rgba(176,141,87,0.55)"
          label="Aktívne úlohy"
          value={String(pendingHomework)}
          sub={pendingHomework === 0 ? "všetko hotové" : "nedokončené úlohy"}
        />
        <MetricCard
          dot={dueWithin24h > 0 ? "#d4a85a" : "#4a8c62"}
          dotLabelColor={dueWithin24h > 0 ? "rgba(212,168,90,0.65)" : "rgba(74,140,98,0.65)"}
          label="Splatné do 24h"
          value={String(dueWithin24h)}
          sub={dueWithin24h > 0 ? "vyžaduje pozornosť" : "žiadny zhon"}
        />
        <MetricCard
          dot="#4a7a8c"
          dotLabelColor="rgba(74,122,140,0.65)"
          label="Dnešné hodiny"
          value={String(lessonsTotal)}
          sub={lessonsCancelled > 0 ? `${lessonsCancelled} zrušené` : "žiadne zrušené"}
        />
      </div>

      {/* Schedule section header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(176,141,87,0.5)", whiteSpace: "nowrap" }}>
          Dnešný rozvrh
        </div>
        <div style={{ flex: 1, height: 1, background: "rgba(176,141,87,0.1)" }} />
      </div>

      {/* Timeline */}
      {schedule.length === 0 ? (
        <div style={{ border: "1px dashed rgba(176,141,87,0.18)", borderRadius: 10, padding: "48px 24px", textAlign: "center" }}>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(232,220,199,0.28)", margin: 0 }}>
            {scheduleAvailable ? "Dnes nemáš žiadne hodiny." : "Rozvrh sa nepodarilo načítať."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {schedule.map((p, i) => (
            <ScheduleItem key={p.period ?? `p-${i}`} period={p} />
          ))}
        </div>
      )}
    </>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 32 }}>
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} style={{ height: 116, background: "rgba(176,141,87,0.06)", borderRadius: 10, border: "1px solid rgba(176,141,87,0.08)" }} />
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} style={{ height: 64, background: "rgba(176,141,87,0.06)", borderRadius: 8, border: "1px solid rgba(176,141,87,0.08)" }} />
        ))}
      </div>
    </>
  );
}

function MetricCard({
  dot,
  dotLabelColor,
  label,
  value,
  sub,
}: {
  dot: string;
  dotLabelColor: string;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div style={{ background: "#161208", border: "1px solid rgba(176,141,87,0.14)", borderRadius: 10, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: dot }} />
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: dotLabelColor }}>
          {label}
        </span>
      </div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 40, fontWeight: 400, color: "#E8DCC7", lineHeight: 1, letterSpacing: "-0.02em" }}>
        {value}
      </div>
      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: "rgba(232,220,199,0.32)", marginTop: 6 }}>
        {sub}
      </div>
    </div>
  );
}

function ScheduleItem({ period }: { period: DashboardPeriod }) {
  const state = getScheduleState(period);

  const dotColor =
    state === "now" ? "#B08D57" :
    state === "cancelled" ? "rgba(232,220,199,0.15)" :
    "rgba(176,141,87,0.32)";

  const cardBg = state === "now" ? "rgba(176,141,87,0.12)" : "rgba(232,220,199,0.03)";
  const cardBorder = state === "now" ? "rgba(176,141,87,0.32)" : "rgba(176,141,87,0.12)";

  const subjColor =
    state === "cancelled" ? "rgba(232,220,199,0.28)" :
    state === "now" ? "#E8DCC7" :
    "rgba(232,220,199,0.75)";

  const badge =
    state === "now" ? { text: "Teraz", bg: "#B08D57", color: "#0a0805" } :
    state === "cancelled" ? { text: "Zrušená", bg: "rgba(100,48,48,0.2)", color: "#c88888" } :
    null;

  const meta = [period.classroom, period.teacher].filter(Boolean).join(" · ");

  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 13, flexShrink: 0, width: 14 }}>
        <div style={{ width: 9, height: 9, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
      </div>
      <div
        style={{
          flex: 1,
          background: cardBg,
          border: `1px solid ${cardBorder}`,
          borderRadius: 8,
          padding: "11px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 2,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <span
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 13,
                fontWeight: 500,
                color: subjColor,
                textDecoration: state === "cancelled" ? "line-through" : undefined,
              }}
            >
              {period.subject}
            </span>
            {badge && (
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, letterSpacing: "0.1em", textTransform: "uppercase", padding: "2px 6px", borderRadius: 3, background: badge.bg, color: badge.color }}>
                {badge.text}
              </span>
            )}
          </div>
          {meta && (
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "rgba(232,220,199,0.3)", letterSpacing: "0.05em" }}>
              {meta}
            </div>
          )}
          {period.curriculum && (
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: "rgba(232,220,199,0.35)", marginTop: 3 }}>
              {period.curriculum}
            </div>
          )}
        </div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "rgba(232,220,199,0.38)", letterSpacing: "0.04em", flexShrink: 0, marginLeft: 12 }}>
          {period.start}–{period.end}
        </div>
      </div>
    </div>
  );
}
