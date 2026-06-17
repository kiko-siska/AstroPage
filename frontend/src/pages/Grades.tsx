import { useEffect, useMemo, useState } from "react";
import { FlaskConical, GraduationCap, Plus, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { api, type Grade, type SubjectGrades } from "../api/client";

// A grade inside the sandbox: every official grade is copied in, hypotheticals
// are appended with `simulated: true` so the UI can distinguish them.
interface SimGrade extends Grade {
  simulated: boolean;
}

const GRADE_VALUES = ["1", "2", "3", "4", "5"] as const;

// EduPage scale is 1 (best) – 5 (worst); colour badges accordingly.
function gradeBadgeClass(value: string): string {
  switch (value) {
    case "1":
      return "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30";
    case "2":
      return "bg-lime-500/15 text-lime-300 ring-lime-500/30";
    case "3":
      return "bg-amber-500/15 text-amber-300 ring-amber-500/30";
    case "4":
      return "bg-orange-500/15 text-orange-300 ring-orange-500/30";
    case "5":
      return "bg-red-500/15 text-red-300 ring-red-500/30";
    default:
      return "bg-slate-500/15 text-slate-300 ring-slate-500/30";
  }
}

// Σ(value × weight) / Σ(weight) — the same formula the backend uses, run live
// over the sandbox grades so the student sees instant "what-if" updates.
function weightedAverage(grades: SimGrade[]): number | null {
  let totalWeight = 0;
  let total = 0;
  for (const g of grades) {
    const value = Number(g.value);
    if (Number.isNaN(value) || g.weight <= 0) continue;
    total += value * g.weight;
    totalWeight += g.weight;
  }
  if (totalWeight === 0) return null;
  return Math.round((total / totalWeight) * 100) / 100;
}

function formatAverage(avg: number | null): string {
  return avg === null ? "—" : avg.toFixed(2);
}

export default function GradesPage() {
  const [subjects, setSubjects] = useState<SubjectGrades[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .listGrades()
      .then((data) => {
        if (cancelled) return;
        setSubjects(data);
        setSelectedSubject(data[0]?.subjectName ?? null);
      })
      .catch((err: { detail?: string }) => {
        if (!cancelled) setError(err?.detail ?? "Could not load grades from EduPage.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = useMemo(
    () => subjects.find((s) => s.subjectName === selectedSubject) ?? null,
    [subjects, selectedSubject],
  );

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-white">
          <GraduationCap className="size-6 text-violet-300" aria-hidden />
          Grades &amp; Sandbox
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Your official report card — and a sandbox to simulate upcoming grades.
        </p>
      </header>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-6 py-16 text-center">
          <p className="text-sm font-medium text-red-300">{error}</p>
          <p className="mt-1 text-xs text-slate-500">
            Try reloading, or log in again if your session expired.
          </p>
        </div>
      ) : loading ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
          <div className="space-y-3">
            {Array.from({ length: 5 }, (_, i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-xl border border-slate-800 bg-slate-900/60"
              />
            ))}
          </div>
          <div className="h-96 animate-pulse rounded-xl border border-slate-800 bg-slate-900/60" />
        </div>
      ) : subjects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-800 px-6 py-16 text-center">
          <p className="text-sm font-medium text-slate-300">No grades yet.</p>
          <p className="mt-1 text-xs text-slate-500">
            Once your teachers enter grades they'll show up here.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
          <ReportCard
            subjects={subjects}
            selected={selectedSubject}
            onSelect={setSelectedSubject}
          />
          {selected ? (
            <Sandbox key={selected.subjectName} subject={selected} />
          ) : (
            <div className="grid place-items-center rounded-xl border border-dashed border-slate-800 text-sm text-slate-500">
              Select a subject to open the simulator.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Left pane: the official report card ───────────────────────────────────────

interface ReportCardProps {
  subjects: SubjectGrades[];
  selected: string | null;
  onSelect: (name: string) => void;
}

function ReportCard({ subjects, selected, onSelect }: ReportCardProps) {
  return (
    <ul className="space-y-3" aria-label="Subjects">
      {subjects.map((subject) => {
        const isActive = subject.subjectName === selected;
        return (
          <li key={subject.subjectName}>
            <button
              type="button"
              onClick={() => onSelect(subject.subjectName)}
              aria-pressed={isActive}
              className={[
                "w-full cursor-pointer rounded-xl border p-4 text-left transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400",
                isActive
                  ? "border-violet-500/60 bg-violet-500/10"
                  : "border-slate-800 bg-slate-900/60 hover:border-violet-500/40 hover:bg-slate-900",
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate font-semibold text-white">
                  {subject.subjectName}
                </span>
                <span className="shrink-0 rounded-lg bg-slate-800 px-2 py-1 text-sm font-semibold text-violet-200">
                  Ø {formatAverage(subject.currentAverage)}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {subject.grades.map((g) => (
                  <span
                    key={g.id}
                    title={`${g.description} · weight ${g.weight}`}
                    className={`grid size-7 place-items-center rounded-md text-xs font-bold ring-1 ${gradeBadgeClass(g.value)}`}
                  >
                    {g.value}
                  </span>
                ))}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ── Right pane: the sandbox simulator ─────────────────────────────────────────

interface SandboxProps {
  subject: SubjectGrades;
}

function Sandbox({ subject }: SandboxProps) {
  // Deep-copy the official grades into local, editable sandbox state.
  const official = useMemo<SimGrade[]>(
    () => subject.grades.map((g) => ({ ...g, simulated: false })),
    [subject],
  );
  const [grades, setGrades] = useState<SimGrade[]>(official);

  // Form state for a new hypothetical grade.
  const [newValue, setNewValue] = useState<string>("1");
  const [newWeight, setNewWeight] = useState<string>("20");
  const [newLabel, setNewLabel] = useState<string>("");

  const officialAvg = subject.currentAverage;
  const simulatedAvg = useMemo(() => weightedAverage(grades), [grades]);
  const hasSimulated = grades.some((g) => g.simulated);
  const delta =
    officialAvg !== null && simulatedAvg !== null
      ? Math.round((simulatedAvg - officialAvg) * 100) / 100
      : null;

  function addHypo(e: React.FormEvent) {
    e.preventDefault();
    const weight = Number(newWeight);
    if (Number.isNaN(weight) || weight <= 0) return;
    setGrades((prev) => [
      {
        id: `sim-${Date.now()}`,
        value: newValue,
        weight,
        description: newLabel.trim() || "Hypothetical grade",
        date: null,
        simulated: true,
      },
      ...prev,
    ]);
    setNewLabel("");
  }

  function removeGrade(id: string) {
    setGrades((prev) => prev.filter((g) => g.id !== id));
  }

  function reset() {
    setGrades(official);
  }

  return (
    <section className="flex min-h-0 flex-col gap-5 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      {/* Metric header: official vs simulated */}
      <div className="flex flex-wrap items-stretch gap-4">
        <div className="flex-1 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Official average
          </p>
          <p className="mt-1 text-3xl font-bold text-white tabular-nums">
            {formatAverage(officialAvg)}
          </p>
        </div>
        <div className="flex-1 rounded-xl border border-violet-500/40 bg-violet-500/10 px-4 py-3">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-violet-300">
            <FlaskConical className="size-3.5" aria-hidden />
            Simulated average
          </p>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-violet-200 tabular-nums">
              {formatAverage(simulatedAvg)}
            </span>
            {delta !== null && delta !== 0 && (
              <span
                className={`text-sm font-semibold tabular-nums ${
                  // Lower is better on a 1–5 scale.
                  delta < 0 ? "text-emerald-300" : "text-red-300"
                }`}
              >
                {delta > 0 ? "+" : ""}
                {delta.toFixed(2)}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* What-if form */}
      <form
        onSubmit={addHypo}
        className="grid gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4 sm:grid-cols-[auto_auto_1fr_auto] sm:items-end"
      >
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">Grade</span>
          <select
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          >
            {GRADE_VALUES.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">Weight</span>
          <input
            type="number"
            min={1}
            value={newWeight}
            onChange={(e) => setNewWeight(e.target.value)}
            className="w-24 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">Label (optional)</span>
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="e.g. Upcoming Final Test"
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
        </label>
        <button
          type="submit"
          className="flex h-[38px] cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-4 text-sm font-medium text-white transition-colors duration-200 hover:bg-violet-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
        >
          <Plus className="size-4" aria-hidden />
          Add Hypo Grade
        </button>
      </form>

      {/* Grade list */}
      <div className="min-h-0 flex-1">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-300">Grades</h3>
          {hasSimulated && (
            <button
              type="button"
              onClick={reset}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-400 transition-colors duration-200 hover:border-slate-600 hover:text-slate-200"
            >
              <RotateCcw className="size-3.5" aria-hidden />
              Reset sandbox
            </button>
          )}
        </div>
        <ul className="space-y-2">
          {grades.map((g) => (
            <li
              key={g.id}
              className={[
                "flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                g.simulated
                  ? "border-dashed border-violet-500/60 bg-violet-500/5 shadow-[0_0_12px_-4px_rgb(139_92_246/0.6)]"
                  : "border-slate-800 bg-slate-950/40",
              ].join(" ")}
            >
              <span
                className={`grid size-9 shrink-0 place-items-center rounded-md text-sm font-bold ring-1 ${gradeBadgeClass(g.value)}`}
              >
                {g.value}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate text-sm font-medium text-slate-200">
                  {g.description}
                  {g.simulated && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded bg-violet-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-300">
                      <Sparkles className="size-3" aria-hidden />
                      Simulated
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-500">
                  weight {g.weight}
                  {g.date ? ` · ${g.date}` : ""}
                </p>
              </div>
              {g.simulated && (
                <button
                  type="button"
                  onClick={() => removeGrade(g.id)}
                  aria-label={`Remove ${g.description}`}
                  className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-slate-500 transition-colors duration-200 hover:bg-red-500/10 hover:text-red-300"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
