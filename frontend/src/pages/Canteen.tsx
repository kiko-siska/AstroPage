import { useEffect, useMemo, useState } from "react";
import { api, type MealDayDTO, type MenuOptionDTO } from "../api/client";
import { useCachedResource } from "../api/useCachedResource";
import { useT } from "../i18n/LanguageContext";
import { useIsMobile } from "../hooks/useIsMobile";
import RefreshButton from "../components/RefreshButton";

type Translate = (key: string, vars?: Record<string, string | number>) => string;

const WEEKS_AHEAD = 3;
const MEALS_CACHE_KEY = `canteen:meals:${WEEKS_AHEAD}`;

function parseDay(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

function weekKey(iso: string): string {
  const d = parseDay(iso);
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return d.toISOString().slice(0, 10);
}

function weekLabel(key: string, t: Translate): string {
  const thisMonday = weekKey(new Date().toISOString().slice(0, 10));
  const diffWeeks = Math.round(
    (parseDay(key).getTime() - parseDay(thisMonday).getTime()) / (7 * 24 * 60 * 60 * 1000),
  );
  if (diffWeeks <= 0) return t("canteen.thisWeek");
  if (diffWeeks === 1) return t("canteen.nextWeek");
  return t("canteen.inWeeks", { n: diffWeeks });
}

interface Week {
  key: string;
  label: string;
  days: MealDayDTO[];
}

function groupByWeek(meals: MealDayDTO[], t: Translate): Week[] {
  const buckets = new Map<string, MealDayDTO[]>();
  for (const meal of meals) {
    const key = weekKey(meal.date);
    (buckets.get(key) ?? buckets.set(key, []).get(key)!).push(meal);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, days]) => ({
      key,
      label: weekLabel(key, t),
      days: days.sort((a, b) => a.date.localeCompare(b.date)),
    }));
}

type Toast = { tone: "error" | "success"; message: string } | null;

export default function CanteenPage() {
  const { t } = useT();
  const isMobile = useIsMobile();
  // Cached across tab switches; auto-refreshes when stale, plus a manual button.
  const { data, loading, refreshing, error, lastUpdated, refresh, mutate } =
    useCachedResource<MealDayDTO[]>(MEALS_CACHE_KEY, () => api.listMeals(WEEKS_AHEAD), {
      errorFallback: t("canteen.loadError"),
    });
  const meals = useMemo(() => data ?? [], [data]);
  const [activeWeek, setActiveWeek] = useState<string | null>(null);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [bulkDays, setBulkDays] = useState(5);
  const [bulkChoice, setBulkChoice] = useState("A");

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(id);
  }, [toast]);

  const weeks = useMemo(() => groupByWeek(meals, t), [meals, t]);
  const week = weeks.find((w) => w.key === activeWeek) ?? weeks[0];

  const letters = useMemo(() => {
    const set = new Set<string>();
    for (const m of meals) for (const o of m.options) set.add(o.letter);
    return set.size ? [...set].sort() : ["A", "B"];
  }, [meals]);

  function setOrdered(date: string, ordered: string | null) {
    // `mutate` (updater form) keeps the on-screen list and cache in sync and is
    // race-safe when several days are changed in quick succession.
    mutate((prev) => (prev ?? []).map((m) => (m.date === date ? { ...m, ordered_meal: ordered } : m)));
  }

  function markPending(date: string, on: boolean) {
    setPending((prev) => { const next = new Set(prev); if (on) next.add(date); else next.delete(date); return next; });
  }

  async function changeMeal(date: string, choice: string | null) {
    const previous = meals.find((m) => m.date === date)?.ordered_meal ?? null;
    if (previous === choice) return;
    setOrdered(date, choice);
    markPending(date, true);
    try {
      const res = await api.orderMeal(date, choice);
      setOrdered(date, res.ordered_meal);
    } catch (err) {
      setOrdered(date, previous);
      setToast({ tone: "error", message: (err as { detail?: string })?.detail ?? t("canteen.orderError") });
    } finally {
      markPending(date, false);
    }
  }

  async function runBulk() {
    setBulkBusy(true);
    try {
      const res = await api.bulkSignup(bulkDays, bulkChoice);
      refresh(); // bulk changed server state — force a fresh meals fetch
      if (res.updated_days === 0) {
        // Nothing actually landed on EduPage — usually every day was already
        // ordered, closed, or past its ordering window. Don't fake success.
        const skipped = res.skipped_days ? t("canteen.bulkNoneSkipped", { n: res.skipped_days }) : "";
        setToast({ tone: "error", message: t("canteen.bulkNone", { skipped }) });
      } else {
        const skipped = res.skipped_days ? t("canteen.bulkOkSkipped", { n: res.skipped_days }) : "";
        setToast({
          tone: "success",
          message: t("canteen.bulkOk", { updated: res.updated_days, choice: bulkChoice, skipped }),
        });
      }
    } catch (err) {
      setToast({ tone: "error", message: (err as { detail?: string })?.detail ?? t("canteen.bulkError") });
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div style={{ padding: isMobile ? "20px 16px" : "36px 40px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(176,141,87,0.5)", marginBottom: 6 }}>
            {t("canteen.eyebrow")}
          </div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 34, fontWeight: 500, color: "#E8DCC7", letterSpacing: "-0.01em" }}>
            {t("canteen.title")}
          </div>
        </div>
        <RefreshButton onRefresh={refresh} refreshing={refreshing} lastUpdated={lastUpdated} />
      </div>

      {/* Bulk automation */}
      <div
        style={{
          background: "#161208",
          border: "1px solid rgba(176,141,87,0.18)",
          borderRadius: 10,
          padding: "20px 22px",
          marginBottom: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M7 1l1.4 3.5L12 5 9.7 7.3l.8 3.7L7 9.5 3.5 11l.8-3.7L2 5l3.6-.5L7 1z" stroke="#B08D57" strokeWidth="1.2" strokeLinejoin="round" />
          </svg>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "#B08D57" }}>
            {t("canteen.autoOrder")}
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr auto", gap: 12, alignItems: "end" }}>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(176,141,87,0.5)", marginBottom: 5 }}>
              {t("canteen.daysCount")}
            </div>
            <input
              type="number"
              min={1}
              max={31}
              value={bulkDays}
              disabled={bulkBusy}
              onChange={(e) => setBulkDays(Math.min(31, Math.max(1, Number(e.target.value) || 1)))}
              style={{ width: "100%", padding: "9px 11px", fontFamily: "'JetBrains Mono', monospace", fontSize: 14 }}
            />
          </div>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(176,141,87,0.5)", marginBottom: 5 }}>
              {t("canteen.preferredMenu")}
            </div>
            <select
              value={bulkChoice}
              disabled={bulkBusy}
              onChange={(e) => setBulkChoice(e.target.value)}
              style={{ width: "100%", padding: "9px 11px", fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}
            >
              {letters.map((l) => (
                <option key={l} value={l}>{t("canteen.menu", { letter: l })}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={runBulk}
            disabled={bulkBusy || loading || !!error}
            style={{
              background: bulkBusy ? "rgba(176,141,87,0.5)" : "#B08D57",
              color: "#0a0805",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              fontWeight: 500,
              padding: "10px 14px",
              borderRadius: 6,
              border: "none",
              cursor: bulkBusy ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
              transition: "background 0.2s",
              gridColumn: isMobile ? "1 / -1" : undefined,
            }}
          >
            {bulkBusy ? t("canteen.running") : t("canteen.run")}
          </button>
        </div>
      </div>

      {error ? (
        <div style={{ background: "rgba(90,40,40,0.2)", border: "1px solid rgba(90,40,40,0.35)", borderRadius: 10, padding: "48px 24px", textAlign: "center" }}>
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "#c88888", margin: 0 }}>{error}</p>
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: "rgba(232,220,199,0.3)", margin: "6px 0 0" }}>{t("common.retryOrLogin")}</p>
        </div>
      ) : loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} style={{ height: 120, background: "rgba(176,141,87,0.06)", borderRadius: 10, border: "1px solid rgba(176,141,87,0.08)" }} />
          ))}
        </div>
      ) : !week ? (
        <div style={{ border: "1px dashed rgba(176,141,87,0.18)", borderRadius: 10, padding: "64px 24px", textAlign: "center" }}>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(232,220,199,0.28)", margin: 0 }}>
            {t("canteen.noMenu")}
          </p>
        </div>
      ) : (
        <>
          {/* Week tabs */}
          <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
            {weeks.map((w) => {
              const active = w.key === week.key;
              return (
                <button
                  key={w.key}
                  type="button"
                  onClick={() => setActiveWeek(w.key)}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 6,
                    background: active ? "rgba(176,141,87,0.12)" : "transparent",
                    border: `1px solid ${active ? "rgba(176,141,87,0.3)" : "rgba(176,141,87,0.12)"}`,
                    cursor: "pointer",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 9,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: active ? "#B08D57" : "rgba(232,220,199,0.3)",
                    transition: "all 0.15s",
                  }}
                >
                  {w.label}
                </button>
              );
            })}
          </div>

          {/* Day rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {week.days.map((day) => (
              <DayCard
                key={day.date}
                day={day}
                isPending={pending.has(day.date)}
                onChange={(choice) => changeMeal(day.date, choice)}
              />
            ))}
          </div>
        </>
      )}

      {/* Toast */}
      {toast && (
        <div
          role="status"
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 200,
            background: "#161208",
            border: "1px solid rgba(176,141,87,0.28)",
            borderRadius: 8,
            padding: "11px 18px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
            whiteSpace: "nowrap",
            display: "flex",
            alignItems: "center",
            gap: 10,
            transition: "opacity 0.3s",
          }}
        >
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              letterSpacing: "0.12em",
              color: toast.tone === "success" ? "#88c8a0" : "#c88888",
            }}
          >
            {toast.message}
          </span>
          <button
            type="button"
            onClick={() => setToast(null)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(232,220,199,0.4)", padding: 0, fontSize: 12 }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

function DayCard({
  day,
  isPending,
  onChange,
}: {
  day: MealDayDTO;
  isPending: boolean;
  onChange: (choice: string | null) => void;
}) {
  const { t, locale } = useT();
  const isMobile = useIsMobile();
  const d = parseDay(day.date);
  const dayName = d.toLocaleDateString(locale, { weekday: "long" }).toUpperCase();
  const dateStr = `${d.getDate()}.${d.getMonth() + 1}.`;
  const signedUp = day.ordered_meal !== null;

  return (
    <div
      style={{
        background: "#161208",
        border: "1px solid rgba(176,141,87,0.14)",
        borderRadius: 10,
        overflow: "hidden",
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
      }}
    >
      {/* Day info panel */}
      <div
        style={{
          padding: "14px 16px",
          borderBottom: isMobile ? "1px solid rgba(176,141,87,0.1)" : "none",
          borderRight: isMobile ? "none" : "1px solid rgba(176,141,87,0.1)",
          width: isMobile ? "auto" : 156,
          flexShrink: 0,
          display: "flex",
          flexDirection: isMobile ? "row" : "column",
          alignItems: isMobile ? "center" : "flex-start",
          gap: isMobile ? 10 : 4,
        }}
      >
        <div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(232,220,199,0.4)", marginBottom: 2 }}>
            {dayName}
          </div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, color: "#E8DCC7", fontWeight: 400 }}>
            {dateStr}
          </div>
        </div>
        <div style={{ marginLeft: isMobile ? "auto" : 0, marginTop: isMobile ? 0 : 8, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
          <div
            style={{
              padding: "3px 7px",
              borderRadius: 3,
              background: signedUp ? "rgba(50,90,60,0.15)" : "rgba(232,220,199,0.04)",
            }}
          >
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 7, letterSpacing: "0.1em", color: signedUp ? "#88c8a0" : "rgba(232,220,199,0.32)" }}>
              {signedUp ? t("canteen.signedUp", { letter: day.ordered_meal ?? "" }) : t("canteen.notSignedUp")}
            </span>
          </div>
          {signedUp && day.open && (
            <button
              type="button"
              onClick={() => onChange(null)}
              disabled={isPending}
              onMouseEnter={(e) => { if (!isPending) e.currentTarget.style.color = "#c88888"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(200,120,120,0.65)"; }}
              style={{
                background: "transparent",
                border: "none",
                padding: "2px 0",
                cursor: isPending ? "wait" : "pointer",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 7,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "rgba(200,120,120,0.65)",
                transition: "color 0.15s",
                whiteSpace: "nowrap",
              }}
            >
              {t("canteen.signOff")} ✕
            </button>
          )}
        </div>
      </div>

      {/* Meals panel */}
      {!day.open ? (
        <div style={{ flex: 1, display: "grid", placeItems: "center", padding: "18px 12px" }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(232,220,199,0.18)" }}>
            {t("canteen.closed")}
          </div>
        </div>
      ) : day.options.length === 0 ? (
        <div style={{ flex: 1, display: "grid", placeItems: "center", padding: "18px 12px" }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(232,220,199,0.18)" }}>
            {t("canteen.menuNotPublished")}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          {day.options.map((opt) => (
            <MealOption
              key={opt.letter}
              opt={opt}
              selected={day.ordered_meal === opt.letter}
              disabled={isPending}
              onClick={() => onChange(opt.letter)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MealOption({
  opt,
  selected,
  disabled,
  onClick,
}: {
  opt: MenuOptionDTO;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const { t } = useT();
  const details = [opt.weight, opt.allergens ? t("canteen.allergens", { a: opt.allergens }) : null].filter(Boolean).join(" · ");

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "9px 10px",
        borderRadius: 6,
        border: `1px solid ${selected ? "rgba(176,141,87,0.4)" : "rgba(176,141,87,0.12)"}`,
        background: selected ? "rgba(176,141,87,0.12)" : "transparent",
        cursor: disabled ? "wait" : "pointer",
        opacity: disabled ? 0.7 : 1,
        textAlign: "left",
        transition: "all 0.15s",
        width: "100%",
      }}
    >
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", color: "#B08D57", marginBottom: 3 }}>
        {t("canteen.menu", { letter: opt.letter })}
      </div>
      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 500, color: "#E8DCC7", lineHeight: 1.3, marginBottom: 2 }}>
        {opt.name ?? "—"}
      </div>
      {details && (
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 7, color: "rgba(232,220,199,0.25)", lineHeight: 1.4 }}>
          {details}
        </div>
      )}
    </button>
  );
}
