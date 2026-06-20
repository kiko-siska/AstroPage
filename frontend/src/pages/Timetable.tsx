import { useState } from "react";
import { api, type DashboardPeriod, type TimetableDay, type TimetableWeek } from "../api/client";
import { useCachedResource } from "../api/useCachedResource";
import { useT } from "../i18n/LanguageContext";
import RefreshButton from "../components/RefreshButton";

type Translate = (key: string, vars?: Record<string, string | number>) => string;

const cacheKey = (offset: number) => `timetable:${offset}`;

function parseDay(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function nowHm(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function weekRangeLabel(weekStartIso: string, locale: string): string {
  const mon = parseDay(weekStartIso);
  const fri = new Date(mon);
  fri.setDate(fri.getDate() + 4);
  const fmt = (d: Date) => d.toLocaleDateString(locale, { day: "numeric", month: "short" });
  return `${fmt(mon)} – ${fmt(fri)}`;
}

function offsetLabel(offset: number, t: Translate): string {
  if (offset === 0) return t("timetable.thisWeek");
  if (offset === 1) return t("timetable.nextWeek");
  if (offset === -1) return t("timetable.lastWeek");
  return offset > 0 ? t("timetable.inWeeks", { n: offset }) : t("timetable.weeksAgo", { n: -offset });
}

const eyebrow: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: 9,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "rgba(176,141,87,0.5)",
};

export default function TimetablePage() {
  const { t, locale } = useT();
  const [offset, setOffset] = useState(0);

  // One cache entry per week offset; auto-refreshes when stale + manual button.
  const { data: week, refreshing, error, lastUpdated, refresh } = useCachedResource<TimetableWeek>(
    cacheKey(offset),
    () => api.getTimetable(offset),
    { errorFallback: t("timetable.loadError") },
  );

  // Show the skeleton until the loaded week matches the selected offset. Cache
  // hits resolve synchronously, so this barely flashes when revisiting.
  const loading = !error && (week == null || week.weekOffset !== offset);

  return (
    <div style={{ padding: "36px 40px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 24 }}>
        <div>
          <div style={{ ...eyebrow, marginBottom: 6 }}>{offsetLabel(offset, t)}</div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 34, fontWeight: 500, color: "#E8DCC7", letterSpacing: "-0.01em", lineHeight: 1 }}>
            {t("timetable.title")}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <RefreshButton onRefresh={refresh} refreshing={refreshing} lastUpdated={lastUpdated} />
          <WeekNav
            label={week ? weekRangeLabel(week.weekStart, locale) : "—"}
            offset={offset}
            onPrev={() => setOffset((o) => o - 1)}
            onNext={() => setOffset((o) => o + 1)}
            onToday={() => setOffset(0)}
          />
        </div>
      </div>

      {error ? (
        <div style={{ background: "rgba(90,40,40,0.2)", border: "1px solid rgba(90,40,40,0.35)", borderRadius: 10, padding: "48px 24px", textAlign: "center" }}>
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "#c88888", margin: 0 }}>{error}</p>
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: "rgba(232,220,199,0.3)", margin: "6px 0 0" }}>
            {t("common.retryOrLogin")}
          </p>
        </div>
      ) : loading || !week ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10 }}>
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} style={{ height: 360, background: "rgba(176,141,87,0.06)", borderRadius: 10, border: "1px solid rgba(176,141,87,0.08)" }} />
          ))}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10 }}>
          {week.days.map((day) => (
            <DayColumn key={day.date} day={day} isWeekViewable={offset === 0} />
          ))}
        </div>
      )}
    </div>
  );
}

function WeekNav({
  label,
  offset,
  onPrev,
  onNext,
  onToday,
}: {
  label: string;
  offset: number;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  const { t } = useT();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {offset !== 0 && (
        <button type="button" onClick={onToday} style={pillBtn(false)}>
          {t("timetable.today")}
        </button>
      )}
      <button type="button" onClick={onPrev} aria-label={t("timetable.prevWeek")} style={arrowBtn}>‹</button>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#E8DCC7", letterSpacing: "0.04em", minWidth: 120, textAlign: "center" }}>
        {label}
      </span>
      <button type="button" onClick={onNext} aria-label={t("timetable.nextWeekAria")} style={arrowBtn}>›</button>
    </div>
  );
}

const arrowBtn: React.CSSProperties = {
  display: "grid",
  placeItems: "center",
  width: 30,
  height: 30,
  borderRadius: 6,
  border: "1px solid rgba(176,141,87,0.18)",
  background: "transparent",
  color: "#B08D57",
  cursor: "pointer",
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: 16,
  lineHeight: 1,
};

function pillBtn(active: boolean): React.CSSProperties {
  return {
    padding: "7px 12px",
    borderRadius: 6,
    background: active ? "rgba(176,141,87,0.12)" : "transparent",
    border: `1px solid ${active ? "rgba(176,141,87,0.3)" : "rgba(176,141,87,0.18)"}`,
    cursor: "pointer",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 9,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "#B08D57",
  };
}

function DayColumn({ day, isWeekViewable }: { day: TimetableDay; isWeekViewable: boolean }) {
  const { t, locale } = useT();
  const d = parseDay(day.date);
  const dayName = d.toLocaleDateString(locale, { weekday: "long" }).toUpperCase();
  const dateStr = `${d.getDate()}.${d.getMonth() + 1}.`;
  const isToday = isWeekViewable && day.date === todayIso();

  const sorted = [...day.periods].sort((a, b) => a.start.localeCompare(b.start));

  return (
    <div
      style={{
        background: isToday ? "rgba(176,141,87,0.07)" : "#161208",
        border: `1px solid ${isToday ? "rgba(176,141,87,0.3)" : "rgba(176,141,87,0.14)"}`,
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "12px 12px 10px", borderBottom: "1px solid rgba(176,141,87,0.1)" }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: isToday ? "#B08D57" : "rgba(232,220,199,0.4)", marginBottom: 2 }}>
          {dayName}
        </div>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, color: "#E8DCC7", fontWeight: 400 }}>
          {dateStr}
        </div>
      </div>

      {!day.available ? (
        <Placeholder text={t("timetable.unavailable")} />
      ) : sorted.length === 0 ? (
        <Placeholder text={t("timetable.noLessons")} />
      ) : (
        <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {sorted.map((p, i) => (
            <PeriodCard key={p.period ?? `p-${i}`} period={p} highlightNow={isToday} />
          ))}
        </div>
      )}
    </div>
  );
}

function Placeholder({ text }: { text: string }) {
  return (
    <div style={{ padding: "28px 12px", textAlign: "center" }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(232,220,199,0.18)" }}>
        {text}
      </div>
    </div>
  );
}

function PeriodCard({ period, highlightNow }: { period: DashboardPeriod; highlightNow: boolean }) {
  const { t } = useT();
  const hm = nowHm();
  const isNow = highlightNow && !period.isCancelled && period.start <= hm && hm <= period.end;
  const meta = [period.classroom, period.teacher].filter(Boolean).join(" · ");

  return (
    <div
      style={{
        borderRadius: 6,
        border: `1px solid ${isNow ? "rgba(176,141,87,0.4)" : "rgba(176,141,87,0.12)"}`,
        background: isNow ? "rgba(176,141,87,0.12)" : "rgba(232,220,199,0.03)",
        padding: "8px 9px",
        opacity: period.isCancelled ? 0.6 : 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 6, marginBottom: 3 }}>
        <span
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 12,
            fontWeight: 500,
            color: period.isCancelled ? "rgba(232,220,199,0.4)" : "#E8DCC7",
            textDecoration: period.isCancelled ? "line-through" : undefined,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {period.period != null ? `${period.period}. ` : ""}{period.subject}
        </span>
        {isNow && (
          <span style={{ flexShrink: 0, fontFamily: "'JetBrains Mono', monospace", fontSize: 7, letterSpacing: "0.1em", textTransform: "uppercase", padding: "2px 5px", borderRadius: 3, background: "#B08D57", color: "#0a0805" }}>
            {t("dashboard.now")}
          </span>
        )}
        {period.isCancelled && (
          <span style={{ flexShrink: 0, fontFamily: "'JetBrains Mono', monospace", fontSize: 7, letterSpacing: "0.1em", textTransform: "uppercase", padding: "2px 5px", borderRadius: 3, background: "rgba(100,48,48,0.2)", color: "#c88888" }}>
            {t("common.cancelled")}
          </span>
        )}
      </div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "rgba(232,220,199,0.4)", letterSpacing: "0.04em" }}>
        {period.start}–{period.end}
      </div>
      {meta && (
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: "rgba(232,220,199,0.28)", letterSpacing: "0.04em", marginTop: 2 }}>
          {meta}
        </div>
      )}
    </div>
  );
}
