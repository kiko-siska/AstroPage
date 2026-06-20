import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api, type DashboardPeriod, type DashboardSummary } from "../api/client";
import { useCachedResource } from "../api/useCachedResource";
import { useT } from "../i18n/LanguageContext";
import RefreshButton from "../components/RefreshButton";

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

function localeDate(locale: string): string {
  return new Date().toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function Dashboard() {
  const { user } = useAuth();
  const { t, locale } = useT();

  // Cached across tab switches; auto-refreshes when stale, plus a manual button.
  const { data: summary, loading, refreshing, error, lastUpdated, refresh } =
    useCachedResource<DashboardSummary>(DASHBOARD_CACHE_KEY, api.getDashboard, {
      errorFallback: t("dashboard.loadError"),
    });

  const firstName = (user?.username ?? t("common.student")).split(".")[0];
  const displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1);

  return (
    <div style={{ padding: "36px 40px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 28 }}>
        <div>
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
            {localeDate(locale)}
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
            {(() => {
              // Keep the student's name emphasised inside the localized greeting.
              const [before, after] = t("dashboard.greeting").split("{name}");
              return (
                <>
                  {before}
                  <em style={{ fontStyle: "italic", color: "#B08D57" }}>{displayName}</em>
                  {after}
                </>
              );
            })()}
          </div>
        </div>
        <RefreshButton onRefresh={refresh} refreshing={refreshing} lastUpdated={lastUpdated} />
      </div>

      {error ? (
        <div style={{ background: "rgba(90,40,40,0.2)", border: "1px solid rgba(90,40,40,0.35)", borderRadius: 10, padding: "48px 24px", textAlign: "center" }}>
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "#c88888", margin: 0 }}>{error}</p>
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: "rgba(232,220,199,0.3)", margin: "6px 0 0" }}>
            {t("common.retryOrLogin")}
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
  const { t, tn } = useT();
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
                {tn("dashboard.dueBanner", dueWithin24h)}
              </span>
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(212,168,90,0.65)" }}>
              {t("dashboard.open")}
            </div>
          </div>
        </Link>
      )}

      {/* Metric cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 32 }}>
        <MetricCard
          dot="#B08D57"
          dotLabelColor="rgba(176,141,87,0.55)"
          label={t("dashboard.activeTasks")}
          value={String(pendingHomework)}
          sub={pendingHomework === 0 ? t("dashboard.allDone") : t("dashboard.unfinishedTasks")}
        />
        <MetricCard
          dot={dueWithin24h > 0 ? "#d4a85a" : "#4a8c62"}
          dotLabelColor={dueWithin24h > 0 ? "rgba(212,168,90,0.65)" : "rgba(74,140,98,0.65)"}
          label={t("dashboard.due24")}
          value={String(dueWithin24h)}
          sub={dueWithin24h > 0 ? t("dashboard.needsAttention") : t("dashboard.noRush")}
        />
        <MetricCard
          dot="#4a7a8c"
          dotLabelColor="rgba(74,122,140,0.65)"
          label={t("dashboard.todayLessons")}
          value={String(lessonsTotal)}
          sub={lessonsCancelled > 0 ? tn("dashboard.cancelledN", lessonsCancelled) : t("dashboard.noneCancelled")}
        />
      </div>

      {/* Schedule section header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(176,141,87,0.5)", whiteSpace: "nowrap" }}>
          {t("dashboard.todaySchedule")}
        </div>
        <div style={{ flex: 1, height: 1, background: "rgba(176,141,87,0.1)" }} />
      </div>

      {/* Timeline */}
      {schedule.length === 0 ? (
        <div style={{ border: "1px dashed rgba(176,141,87,0.18)", borderRadius: 10, padding: "48px 24px", textAlign: "center" }}>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(232,220,199,0.28)", margin: 0 }}>
            {scheduleAvailable ? t("dashboard.noLessonsToday") : t("dashboard.scheduleLoadFailed")}
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
  const { t } = useT();
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
    state === "now" ? { text: t("dashboard.now"), bg: "#B08D57", color: "#0a0805" } :
    state === "cancelled" ? { text: t("common.cancelled"), bg: "rgba(100,48,48,0.2)", color: "#c88888" } :
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
