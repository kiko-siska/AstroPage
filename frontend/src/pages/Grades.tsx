import { useMemo, useState } from "react";
import { api, type Grade, type SubjectGrades } from "../api/client";
import { useCachedResource } from "../api/useCachedResource";
import { useT } from "../i18n/LanguageContext";
import { useIsMobile } from "../hooks/useIsMobile";
import RefreshButton from "../components/RefreshButton";

// A grade inside the sandbox: every official grade is copied in, hypotheticals
// are appended with `simulated: true`. Official grades can be temporarily
// `hidden` to see how the average would look without them.
interface SimGrade extends Grade {
  simulated: boolean;
  hidden: boolean;
}

const GRADES_CACHE_KEY = "grades";

// EduPage scale is 1 (best) – 5 (worst). Earthy, desaturated badges that sit
// in the copper/cream palette — green → amber → red, matching the app's
// done/soon/overdue semantic tones.
interface GradeTone {
  text: string;
  bg: string;
  border: string;
}

const TONES: GradeTone[] = [
  { text: "#88c8a0", bg: "rgba(50,90,60,0.18)", border: "rgba(50,90,60,0.42)" }, // best
  { text: "#b6c887", bg: "rgba(74,90,40,0.18)", border: "rgba(74,90,40,0.42)" },
  { text: "#d4a85a", bg: "rgba(110,78,20,0.2)", border: "rgba(110,78,20,0.42)" },
  { text: "#d0875a", bg: "rgba(110,58,20,0.2)", border: "rgba(110,58,20,0.42)" },
  { text: "#c88888", bg: "rgba(90,40,40,0.2)", border: "rgba(90,40,40,0.42)" }, // worst
];

const NEUTRAL_TONE: GradeTone = {
  text: "rgba(232,220,199,0.5)",
  bg: "rgba(232,220,199,0.05)",
  border: "rgba(176,141,87,0.18)",
};

// EduPage's "A" (absent) mark counts as a 5 until the test is made up.
function isAbsent(value: string): boolean {
  return value.trim().toUpperCase() === "A";
}

// Numeric value of a classic grade for averaging — "A" resolves to 5.
function classicNumeric(value: string): number {
  return isAbsent(value) ? 5 : Number(value);
}

function classicTone(value: string): GradeTone {
  if (isAbsent(value)) return TONES[4]; // absent → worst (red)
  const n = Number(value);
  if (n >= 1 && n <= 5) return TONES[n - 1];
  return NEUTRAL_TONE;
}

// Higher percentage is better, so map the band onto the same 5-tone ramp.
function percentTone(pct: number): GradeTone {
  if (pct >= 90) return TONES[0];
  if (pct >= 75) return TONES[1];
  if (pct >= 60) return TONES[2];
  if (pct >= 45) return TONES[3];
  return TONES[4];
}

function gradePercent(g: Pick<Grade, "value" | "maxPoints">): number {
  if (isAbsent(g.value)) return 0; // absent → 0 points earned
  if (g.maxPoints == null || g.maxPoints <= 0) return 100; // e.g. a 1/0 grade
  return (Number(g.value) / g.maxPoints) * 100;
}

function toneFor(g: Pick<Grade, "value" | "maxPoints">): GradeTone {
  return g.maxPoints != null ? percentTone(gradePercent(g)) : classicTone(g.value);
}

// The same formulas the backend uses, run live over the (non-hidden) sandbox
// grades so the student sees instant "what-if" updates.
//  • classic : Σ(value × weight) / Σ(weight) on the 1–5 scale.
//  • points  : Σ(earned) / Σ(max) × 100 as a percentage.
function liveAverage(grades: SimGrade[], isPoints: boolean): number | null {
  const active = grades.filter((g) => !g.hidden);
  if (isPoints) {
    let earned = 0;
    let max = 0;
    for (const g of active) {
      if (g.maxPoints == null) continue;
      // Absent ("A") counts as 0 earned points — matching the backend — so it
      // drags the percentage down rather than being silently skipped.
      const v = isAbsent(g.value) ? 0 : Number(g.value);
      if (Number.isNaN(v)) continue;
      earned += v;
      max += g.maxPoints;
    }
    if (max <= 0) return null;
    return Math.round((earned / max) * 10000) / 100;
  }
  let totalWeight = 0;
  let total = 0;
  for (const g of active) {
    const v = classicNumeric(g.value);
    if (Number.isNaN(v) || g.weight <= 0) continue;
    total += v * g.weight;
    totalWeight += g.weight;
  }
  if (totalWeight === 0) return null;
  return Math.round((total / totalWeight) * 100) / 100;
}

function formatAverage(avg: number | null, isPoints: boolean): string {
  if (avg === null) return "—";
  return isPoints ? `${Math.round(avg)} %` : avg.toFixed(2);
}

// ── Shared type styles ────────────────────────────────────────────────────────

const eyebrow: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: 9,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "rgba(176,141,87,0.5)",
};

const fieldLabel: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: 9,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "rgba(176,141,87,0.5)",
  marginBottom: 5,
};

export default function GradesPage() {
  const { t } = useT();
  const isMobile = useIsMobile();
  const { data, loading, refreshing, error, lastUpdated, refresh } =
    useCachedResource<SubjectGrades[]>(GRADES_CACHE_KEY, api.listGrades, {
      errorFallback: t("grades.loadError"),
    });
  const subjects = useMemo(() => data ?? [], [data]);
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);

  function toggleSubject(name: string) {
    setExpandedSubject((prev) => (prev === name ? null : name));
  }

  return (
    <div style={{ padding: isMobile ? "20px 16px" : "36px 40px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <div>
          <div style={{ ...eyebrow, marginBottom: 6 }}>{t("grades.eyebrow")}</div>
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
            {t("grades.title")}
          </div>
        </div>
        <RefreshButton onRefresh={refresh} refreshing={refreshing} lastUpdated={lastUpdated} />
      </div>

      {error ? (
        <div
          style={{
            background: "rgba(90,40,40,0.2)",
            border: "1px solid rgba(90,40,40,0.35)",
            borderRadius: 10,
            padding: "48px 24px",
            textAlign: "center",
          }}
        >
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "#c88888", margin: 0 }}>{error}</p>
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: "rgba(232,220,199,0.3)", margin: "6px 0 0" }}>
            {t("common.retryOrLogin")}
          </p>
        </div>
      ) : loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {Array.from({ length: 5 }, (_, i) => (
            <div
              key={i}
              style={{ height: 92, background: "rgba(176,141,87,0.06)", borderRadius: 10, border: "1px solid rgba(176,141,87,0.08)" }}
            />
          ))}
        </div>
      ) : subjects.length === 0 ? (
        <div style={{ border: "1px dashed rgba(176,141,87,0.18)", borderRadius: 10, padding: "64px 24px", textAlign: "center" }}>
          <p style={{ ...eyebrow, color: "rgba(232,220,199,0.28)", margin: 0 }}>{t("grades.noGrades")}</p>
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: "rgba(232,220,199,0.3)", margin: "8px 0 0" }}>
            {t("grades.noGradesHint")}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }} aria-label={t("grades.subjects")}>
          {subjects.map((subject) => {
            const isOpen = expandedSubject === subject.subjectName;
            return (
              <div key={subject.subjectName}>
                <SubjectAccordionHeader
                  subject={subject}
                  isOpen={isOpen}
                  onToggle={() => toggleSubject(subject.subjectName)}
                  t={t}
                />
                {isOpen && (
                  <div style={{ marginTop: 10, paddingLeft: isMobile ? 0 : 2 }}>
                    <Sandbox key={subject.subjectName} subject={subject} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SubjectAccordionHeader({
  subject,
  isOpen,
  onToggle,
  t,
}: {
  subject: SubjectGrades;
  isOpen: boolean;
  onToggle: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      onMouseEnter={(e) => {
        if (!isOpen) e.currentTarget.style.borderColor = "rgba(176,141,87,0.3)";
      }}
      onMouseLeave={(e) => {
        if (!isOpen) e.currentTarget.style.borderColor = "rgba(176,141,87,0.14)";
      }}
      style={{
        width: "100%",
        textAlign: "left",
        cursor: "pointer",
        background: isOpen ? "rgba(176,141,87,0.12)" : "#161208",
        border: `1px solid ${isOpen ? "rgba(176,141,87,0.3)" : "rgba(176,141,87,0.14)"}`,
        borderRadius: isOpen ? "10px 10px 0 0" : 10,
        padding: 16,
        transition: "border-color 0.15s, background 0.15s, border-radius 0.15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            style={{ flexShrink: 0, transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
          >
            <path d="M4 2l4 4-4 4" stroke={isOpen ? "#B08D57" : "rgba(176,141,87,0.45)"} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 13,
              fontWeight: 500,
              color: "#E8DCC7",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {subject.subjectName}
          </span>
        </div>
        <span
          style={{
            flexShrink: 0,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12,
            fontWeight: 500,
            color: isOpen ? "#B08D57" : "rgba(176,141,87,0.75)",
            background: "rgba(176,141,87,0.08)",
            borderRadius: 5,
            padding: "3px 8px",
          }}
        >
          {subject.isPoints ? "" : "Ø "}
          {formatAverage(subject.currentAverage, subject.isPoints)}
        </span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 12, paddingLeft: 22 }}>
        {subject.grades.map((g) => (
          <span key={g.id} title={`${g.description}${g.maxPoints != null ? "" : ` · ${t("grades.weightMeta", { n: g.weight })}`}`}>
            <GradeBadge grade={g} />
          </span>
        ))}
      </div>
    </button>
  );
}

// ── Grade badge (classic square "2" or points pill "5/10") ────────────────────

function GradeBadge({ grade, size = "sm", dimmed = false }: { grade: Pick<Grade, "value" | "maxPoints">; size?: "sm" | "lg"; dimmed?: boolean }) {
  const tone = toneFor(grade);
  const isPoints = grade.maxPoints != null;
  const lg = size === "lg";
  return (
    <span
      style={{
        display: "grid",
        placeItems: "center",
        minWidth: lg ? 34 : 24,
        height: lg ? 34 : 24,
        padding: isPoints ? (lg ? "0 9px" : "0 6px") : 0,
        borderRadius: 5,
        flexShrink: 0,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: lg ? 13 : 11,
        fontWeight: 500,
        color: tone.text,
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        opacity: dimmed ? 0.4 : 1,
        whiteSpace: "nowrap",
      }}
    >
      {isPoints ? `${grade.value}/${grade.maxPoints}` : grade.value}
    </span>
  );
}

// ── Sandbox simulator ─────────────────────────────────────────────────────────

interface SandboxProps {
  subject: SubjectGrades;
}

function Sandbox({ subject }: SandboxProps) {
  const { t } = useT();
  const isMobile = useIsMobile();
  const isPoints = subject.isPoints;

  // Deep-copy the official grades into local, editable sandbox state.
  const official = useMemo<SimGrade[]>(
    () => subject.grades.map((g) => ({ ...g, simulated: false, hidden: false })),
    [subject],
  );
  const [grades, setGrades] = useState<SimGrade[]>(official);

  // Form state for a new hypothetical grade. Classic uses grade + weight;
  // points uses earned + max.
  const [newValue, setNewValue] = useState<string>("1");
  const [newWeight, setNewWeight] = useState<string>("20");
  const [newEarned, setNewEarned] = useState<string>("");
  const [newMax, setNewMax] = useState<string>("10");
  const [newLabel, setNewLabel] = useState<string>("");

  const officialAvg = subject.currentAverage;
  const simulatedAvg = useMemo(() => liveAverage(grades, isPoints), [grades, isPoints]);
  const modified = grades.some((g) => g.simulated || g.hidden);
  const delta =
    officialAvg !== null && simulatedAvg !== null
      ? Math.round((simulatedAvg - officialAvg) * 100) / 100
      : null;
  // Classic: lower is better. Points: higher is better.
  const improved = delta !== null && delta !== 0 ? (isPoints ? delta > 0 : delta < 0) : null;

  function addHypo(e: React.FormEvent) {
    e.preventDefault();
    let grade: SimGrade;
    if (isPoints) {
      const max = Number(newMax);
      const earned = Number(newEarned);
      if (Number.isNaN(max) || max <= 0 || Number.isNaN(earned) || earned < 0) return;
      grade = {
        id: `sim-${Date.now()}`,
        value: String(earned),
        weight: Math.round(max),
        maxPoints: max,
        description: newLabel.trim() || t("grades.hypotheticalGrade"),
        date: null,
        simulated: true,
        hidden: false,
      };
      setNewEarned("");
    } else {
      const weight = Number(newWeight);
      if (Number.isNaN(weight) || weight <= 0) return;
      grade = {
        id: `sim-${Date.now()}`,
        value: newValue,
        weight,
        maxPoints: null,
        description: newLabel.trim() || t("grades.hypotheticalGrade"),
        date: null,
        simulated: true,
        hidden: false,
      };
    }
    setGrades((prev) => [grade, ...prev]);
    setNewLabel("");
  }

  function removeGrade(id: string) {
    setGrades((prev) => prev.filter((g) => g.id !== id));
  }

  function toggleHidden(id: string) {
    setGrades((prev) => prev.map((g) => (g.id === id ? { ...g, hidden: !g.hidden } : g)));
  }

  function reset() {
    setGrades(official);
  }

  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
        background: "#161208",
        border: "1px solid rgba(176,141,87,0.3)",
        borderTop: "none",
        borderRadius: "0 0 10px 10px",
        padding: 20,
      }}
    >
      {/* Metric header: official vs simulated */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={{ background: "#100d08", border: "1px solid rgba(176,141,87,0.14)", borderRadius: 10, padding: "16px 18px" }}>
          <div style={{ ...fieldLabel, marginBottom: 10 }}>{t("grades.officialAverage")}</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 32, fontWeight: 400, color: "#E8DCC7", lineHeight: 1, letterSpacing: "-0.02em" }}>
            {formatAverage(officialAvg, isPoints)}
          </div>
        </div>
        <div style={{ background: "rgba(176,141,87,0.1)", border: "1px solid rgba(176,141,87,0.3)", borderRadius: 10, padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
            <FlaskIcon />
            <span style={{ ...fieldLabel, color: "#B08D57", marginBottom: 0 }}>{t("grades.simulatedAverage")}</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 32, fontWeight: 400, color: "#B08D57", lineHeight: 1, letterSpacing: "-0.02em" }}>
              {formatAverage(simulatedAvg, isPoints)}
            </span>
            {delta !== null && delta !== 0 && (
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 13,
                  fontWeight: 500,
                  color: improved ? "#88c8a0" : "#c88888",
                }}
              >
                {delta > 0 ? "+" : ""}
                {isPoints ? `${Math.round(delta)} %` : delta.toFixed(2)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* What-if form (adapts to the subject's grading system) */}
      <form
        onSubmit={addHypo}
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr 1fr" : "auto auto 1fr auto",
          gap: 12,
          alignItems: "end",
          background: "#100d08",
          border: "1px solid rgba(176,141,87,0.14)",
          borderRadius: 10,
          padding: 16,
        }}
      >
        {isPoints ? (
          <>
            <label style={{ display: "block" }}>
              <div style={fieldLabel}>{t("grades.points")}</div>
              <input
                type="number"
                min={0}
                value={newEarned}
                onChange={(e) => setNewEarned(e.target.value)}
                placeholder={t("grades.pointsPlaceholder")}
                style={{ width: 80, padding: "9px 11px", fontFamily: "'JetBrains Mono', monospace", fontSize: 14 }}
              />
            </label>
            <label style={{ display: "block" }}>
              <div style={fieldLabel}>{t("grades.max")}</div>
              <input
                type="number"
                min={1}
                value={newMax}
                onChange={(e) => setNewMax(e.target.value)}
                style={{ width: 80, padding: "9px 11px", fontFamily: "'JetBrains Mono', monospace", fontSize: 14 }}
              />
            </label>
          </>
        ) : (
          <>
            <label style={{ display: "block" }}>
              <div style={fieldLabel}>{t("grades.grade")}</div>
              <select
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                style={{ width: 64, padding: "9px 11px", fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}
              >
                {["1", "2", "3", "4", "5", "A"].map((v) => (
                  <option key={v} value={v}>
                    {v === "A" ? t("grades.absent") : v}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "block" }}>
              <div style={fieldLabel}>{t("grades.weight")}</div>
              <input
                type="number"
                min={1}
                value={newWeight}
                onChange={(e) => setNewWeight(e.target.value)}
                style={{ width: 80, padding: "9px 11px", fontFamily: "'JetBrains Mono', monospace", fontSize: 14 }}
              />
            </label>
          </>
        )}
        <label style={{ display: "block", gridColumn: isMobile ? "1 / -1" : undefined }}>
          <div style={fieldLabel}>{t("grades.descriptionOptional")}</div>
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder={t("grades.descriptionPlaceholder")}
            style={{ width: "100%", padding: "9px 11px", fontFamily: "'Inter', sans-serif", fontSize: 13 }}
          />
        </label>
        <button
          type="submit"
          onMouseEnter={(e) => (e.currentTarget.style.background = "#c0a06a")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#B08D57")}
          style={{
            background: "#B08D57",
            color: "#0a0805",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            fontWeight: 500,
            padding: "10px 14px",
            borderRadius: 6,
            border: "none",
            cursor: "pointer",
            whiteSpace: "nowrap",
            transition: "background 0.2s",
            gridColumn: isMobile ? "1 / -1" : undefined,
          }}
        >
          {t("grades.add")}
        </button>
      </form>

      {/* Grade list */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
            <span style={{ ...eyebrow, whiteSpace: "nowrap" }}>{t("grades.title")}</span>
            <div style={{ flex: 1, height: 1, background: "rgba(176,141,87,0.1)" }} />
          </div>
          {modified && (
            <button
              type="button"
              onClick={reset}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(176,141,87,0.3)";
                e.currentTarget.style.color = "rgba(232,220,199,0.7)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(176,141,87,0.14)";
                e.currentTarget.style.color = "rgba(232,220,199,0.4)";
              }}
              style={{
                marginLeft: 12,
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "transparent",
                border: "1px solid rgba(176,141,87,0.14)",
                borderRadius: 6,
                padding: "5px 10px",
                cursor: "pointer",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 9,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "rgba(232,220,199,0.4)",
                transition: "border-color 0.15s, color 0.15s",
                whiteSpace: "nowrap",
              }}
            >
              <ResetIcon />
              {t("grades.reset")}
            </button>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {grades.map((g) => (
            <GradeRow
              key={g.id}
              grade={g}
              onToggleHidden={() => toggleHidden(g.id)}
              onRemove={() => removeGrade(g.id)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

// ── One row in the sandbox grade list ─────────────────────────────────────────

function GradeRow({ grade, onToggleHidden, onRemove }: { grade: SimGrade; onToggleHidden: () => void; onRemove: () => void }) {
  const { t } = useT();
  const meta =
    grade.maxPoints != null
      ? t("grades.pointsMeta", { earned: grade.value, max: grade.maxPoints })
      : t("grades.weightMeta", { n: grade.weight });
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 12px",
        borderRadius: 8,
        background: grade.simulated ? "rgba(176,141,87,0.06)" : "#100d08",
        border: grade.simulated ? "1px dashed rgba(176,141,87,0.4)" : "1px solid rgba(176,141,87,0.12)",
        opacity: grade.hidden ? 0.55 : 1,
      }}
    >
      <GradeBadge grade={grade} size="lg" dimmed={grade.hidden} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 13,
              fontWeight: 500,
              color: "#E8DCC7",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              textDecoration: grade.hidden ? "line-through" : undefined,
            }}
          >
            {grade.description}
          </span>
          {grade.simulated && (
            <span
              style={{
                flexShrink: 0,
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 7,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#B08D57",
                background: "rgba(176,141,87,0.14)",
                borderRadius: 3,
                padding: "2px 6px",
              }}
            >
              {t("grades.simulatedBadge")}
            </span>
          )}
          {grade.hidden && (
            <span
              style={{
                flexShrink: 0,
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 7,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "rgba(232,220,199,0.4)",
                background: "rgba(232,220,199,0.06)",
                borderRadius: 3,
                padding: "2px 6px",
              }}
            >
              {t("grades.hidden")}
            </span>
          )}
        </div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "rgba(232,220,199,0.3)", letterSpacing: "0.04em", marginTop: 3 }}>
          {meta}
          {grade.date ? ` · ${grade.date}` : ""}
        </div>
      </div>
      {grade.simulated ? (
        <IconButton label={t("grades.removeAria", { name: grade.description })} onClick={onRemove} hoverColor="#c88888" hoverBg="rgba(90,40,40,0.18)">
          <TrashIcon />
        </IconButton>
      ) : (
        <IconButton
          label={grade.hidden ? t("grades.showAria", { name: grade.description }) : t("grades.hideAria", { name: grade.description })}
          onClick={onToggleHidden}
          hoverColor="#B08D57"
          hoverBg="rgba(176,141,87,0.12)"
        >
          {grade.hidden ? <EyeIcon /> : <EyeOffIcon />}
        </IconButton>
      )}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  hoverColor,
  hoverBg,
  children,
}: {
  label: string;
  onClick: () => void;
  hoverColor: string;
  hoverBg: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = hoverBg;
        e.currentTarget.style.color = hoverColor;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = "rgba(232,220,199,0.35)";
      }}
      style={{
        display: "grid",
        placeItems: "center",
        width: 30,
        height: 30,
        flexShrink: 0,
        borderRadius: 6,
        border: "none",
        background: "transparent",
        color: "rgba(232,220,199,0.35)",
        cursor: "pointer",
        transition: "background 0.15s, color 0.15s",
      }}
    >
      {children}
    </button>
  );
}

// ── Inline icons (stroke style consistent with the rest of the app) ───────────

function FlaskIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <path d="M6 1.5h4M6.5 1.5v4L3 12a1.5 1.5 0 001.3 2.3h7.4A1.5 1.5 0 0013 12L9.5 5.5v-4" stroke="#B08D57" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 9.5h6" stroke="#B08D57" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
      <path d="M3 8a5 5 0 105-5 5 5 0 00-3.5 1.5L3 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 3v3h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M3 4h10M6.5 4V2.8a.8.8 0 01.8-.8h1.4a.8.8 0 01.8.8V4M4.5 4l.5 8.2a1 1 0 001 .8h4a1 1 0 001-.8L11.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M6.5 4.2A6 6 0 018 4c3 0 5.3 2.2 6 4-.3.8-.9 1.7-1.7 2.4M9.5 11.8A6 6 0 018 12c-3 0-5.3-2.2-6-4 .4-1 1.2-2 2.3-2.8M6.6 6.6a2 2 0 102.8 2.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.5 2.5l11 11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M2 8c.7-1.8 3-4 6-4s5.3 2.2 6 4c-.7 1.8-3 4-6 4s-5.3-2.2-6-4z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}
