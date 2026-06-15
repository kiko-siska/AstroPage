import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Download,
  LoaderCircle,
  Paperclip,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import {
  buildAiDraft,
  daysRemainingLabel,
  formatDate,
  getHomeworkStatus,
  type Homework,
  type HomeworkStatus,
} from "../data/mock";
import { api, type HomeworkAttachment } from "../api/client";

type StatusFilter = "all" | HomeworkStatus;

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "due-soon", label: "Due soon" },
  { id: "pending", label: "Pending" },
  { id: "overdue", label: "Overdue" },
  { id: "done", label: "Done" },
];

const BADGE_STYLES: Record<HomeworkStatus, string> = {
  "due-soon": "bg-amber-500/15 text-amber-300",
  pending: "bg-sky-500/15 text-sky-300",
  overdue: "bg-red-500/15 text-red-300",
  done: "bg-emerald-500/15 text-emerald-300",
};

const BADGE_LABELS: Record<HomeworkStatus, string> = {
  "due-soon": "Due soon",
  pending: "Pending",
  overdue: "Overdue",
  done: "Done",
};

type AiState = { phase: "idle" } | { phase: "loading" } | { phase: "success"; draft: string };

export default function HomeworkPage() {
  // Master array: fetched once on mount, filtering happens client-side.
  const [homework, setHomework] = useState<Homework[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [selected, setSelected] = useState<Homework | null>(null);
  const [ai, setAi] = useState<AiState>({ phase: "idle" });
  // Assignment ids with an in-flight done-toggle, and a transient error toast.
  const [togglingDone, setTogglingDone] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .listHomework()
      .then((items) => {
        if (!cancelled) setHomework(items);
      })
      .catch((err: { detail?: string }) => {
        if (!cancelled) setError(err?.detail ?? "Could not load homework from EduPage.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return homework
      .filter((hw) => filter === "all" || getHomeworkStatus(hw) === filter)
      .filter(
        (hw) =>
          q === "" ||
          hw.title.toLowerCase().includes(q) ||
          hw.subject.toLowerCase().includes(q) ||
          hw.teacher.toLowerCase().includes(q),
      )
      .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  }, [homework, query, filter]);

  function openDetail(hw: Homework) {
    setSelected(hw);
    setAi({ phase: "idle" });
  }

  function closeDetail() {
    setSelected(null);
    setAi({ phase: "idle" });
  }

  function runAi(hw: Homework) {
    setAi({ phase: "loading" });
    // Simulated AI pipeline latency.
    setTimeout(() => setAi({ phase: "success", draft: buildAiDraft(hw) }), 1800);
  }

  // Optimistically flip the done flag, rolling back if EduPage rejects it.
  async function toggleDone(hw: Homework, done: boolean) {
    const apply = (submitted: boolean) => {
      setHomework((list) => list.map((h) => (h.id === hw.id ? { ...h, submitted } : h)));
      setSelected((cur) => (cur && cur.id === hw.id ? { ...cur, submitted } : cur));
    };
    setTogglingDone((prev) => new Set(prev).add(hw.id));
    apply(done);
    try {
      await api.setHomeworkDone(hw.id, done);
    } catch (err) {
      apply(!done); // roll back
      setToast((err as { detail?: string })?.detail ?? "Could not update homework on EduPage.");
    } finally {
      setTogglingDone((prev) => {
        const next = new Set(prev);
        next.delete(hw.id);
        return next;
      });
    }
  }

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 lg:px-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Homework Hub</h1>
        <p className="mt-1 text-sm text-slate-400">
          Everything your teachers assigned, in one place.
        </p>
      </header>

      {/* Filter bar */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <label className="relative min-w-0 flex-1 sm:max-w-xs">
          <span className="sr-only">Search homework</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search subject, title, teacher…"
            className="w-full rounded-lg border border-slate-700 bg-slate-900 py-2 pl-9 pr-3 text-sm text-white placeholder-slate-600 transition focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
        </label>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={[
                "cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-200",
                filter === f.id
                  ? "bg-violet-600 text-white"
                  : "border border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600 hover:text-slate-200",
              ].join(" ")}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cards */}
      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-6 py-16 text-center">
          <p className="text-sm font-medium text-red-300">{error}</p>
          <p className="mt-1 text-xs text-slate-500">
            Try reloading, or log in again if your session expired.
          </p>
        </div>
      ) : loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-xl border border-slate-800 bg-slate-900/60" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-800 px-6 py-16 text-center">
          <p className="text-sm font-medium text-slate-300">No assignments match.</p>
          <p className="mt-1 text-xs text-slate-500">Try a different search or status filter.</p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {visible.map((hw) => {
            const status = getHomeworkStatus(hw);
            return (
              <li key={hw.id}>
                <button
                  type="button"
                  onClick={() => openDetail(hw)}
                  className="w-full cursor-pointer rounded-xl border border-slate-800 bg-slate-900/60 p-5 text-left transition duration-200 hover:border-violet-500/50 hover:bg-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-violet-300">
                      {hw.subject}
                    </span>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${BADGE_STYLES[status]}`}
                    >
                      {BADGE_LABELS[status]}
                    </span>
                  </div>
                  <h2 className="mt-2 line-clamp-2 font-semibold text-white">{hw.title}</h2>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-400">{hw.description}</p>
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                    <CalendarClock className="size-3.5" aria-hidden />
                    {formatDate(hw.dueAt)} · {hw.submitted ? "submitted" : daysRemainingLabel(hw.dueAt)}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {selected && (
        <DetailDrawer
          key={selected.id}
          homework={selected}
          ai={ai}
          doneBusy={togglingDone.has(selected.id)}
          onToggleDone={(done) => toggleDone(selected, done)}
          onRunAi={() => runAi(selected)}
          onEditDraft={(draft) => setAi({ phase: "success", draft })}
          onClose={closeDetail}
        />
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-[60] flex max-w-md -translate-x-1/2 items-center gap-3 rounded-xl border border-red-500/40 bg-red-500/15 px-4 py-3 text-sm text-red-200 shadow-2xl"
        >
          <X className="size-4 shrink-0" aria-hidden />
          <span className="min-w-0">{toast}</span>
        </div>
      )}
    </div>
  );
}


interface DrawerProps {
  homework: Homework;
  ai: AiState;
  doneBusy: boolean;
  onToggleDone: (done: boolean) => void;
  onRunAi: () => void;
  onEditDraft: (draft: string) => void;
  onClose: () => void;
}

function DetailDrawer({
  homework,
  ai,
  doneBusy,
  onToggleDone,
  onRunAi,
  onEditDraft,
  onClose,
}: DrawerProps) {
  const status = getHomeworkStatus(homework);
  const wide = ai.phase === "success";

  const [attachments, setAttachments] = useState<HomeworkAttachment[]>([]);
  // Start in the loading state when we know a fetch is coming (drawer is keyed
  // by homework id, so this initialises fresh on each open).
  const [attLoading, setAttLoading] = useState(Boolean(homework.hasAttachments));
  const [attError, setAttError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Attachments live in a linked e-test and are fetched lazily on open. The
  // drawer is keyed by homework id at the call site, so this runs once per open.
  useEffect(() => {
    if (!homework.hasAttachments) return;
    let cancelled = false;
    api
      .listHomeworkAttachments(homework.id)
      .then((files) => {
        if (!cancelled) setAttachments(files);
      })
      .catch((err: { detail?: string }) => {
        if (!cancelled) setAttError(err?.detail ?? "Could not load attachments.");
      })
      .finally(() => {
        if (!cancelled) setAttLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [homework.id, homework.hasAttachments]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={homework.title}>
      <button
        type="button"
        aria-label="Close details"
        onClick={onClose}
        className="absolute inset-0 cursor-pointer bg-black/60 backdrop-blur-sm"
      />
      <div
        className={[
          "relative flex h-full flex-col overflow-y-auto border-l border-slate-800 bg-slate-950 shadow-2xl transition-all duration-300",
          wide ? "w-full max-w-4xl" : "w-full max-w-lg",
        ].join(" ")}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-800 bg-slate-950/95 px-6 py-5 backdrop-blur">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-violet-300">
                {homework.subject}
              </span>
              <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${BADGE_STYLES[status]}`}>
                {BADGE_LABELS[status]}
              </span>
            </div>
            <h2 className="mt-1 text-lg font-semibold text-white">{homework.title}</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {homework.teacher} · due {formatDate(homework.dueAt)}
              {homework.submitted ? " · submitted" : ` (${daysRemainingLabel(homework.dueAt)})`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg text-slate-400 transition-colors duration-200 hover:bg-slate-800 hover:text-white"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <div className="flex-1 px-6 py-6">
          {ai.phase !== "success" && (
            <>
              <button
                type="button"
                onClick={() => onToggleDone(!homework.submitted)}
                disabled={doneBusy}
                aria-pressed={homework.submitted}
                className={[
                  "mb-5 flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-70",
                  homework.submitted
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                    : "cursor-pointer border-slate-700 text-slate-200 hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-300",
                ].join(" ")}
              >
                {doneBusy ? (
                  <LoaderCircle className="size-4 animate-spin" aria-hidden />
                ) : (
                  <CheckCircle2 className="size-4" aria-hidden />
                )}
                {homework.submitted ? "Done — mark as not done" : "Mark as done"}
              </button>

              <h3 className="text-sm font-semibold text-slate-300">Instructions</h3>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-400">
                {homework.description}
              </p>

              {homework.hasAttachments && (
                <div className="mt-6">
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-300">
                    <Paperclip className="size-4" aria-hidden />
                    Attachments
                  </h3>
                  {attLoading ? (
                    <div className="mt-2 h-10 animate-pulse rounded-lg bg-slate-800" aria-hidden />
                  ) : attError ? (
                    <p className="mt-2 text-sm text-red-300">{attError}</p>
                  ) : attachments.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-500">No files attached.</p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {attachments.map((f) => (
                        <li key={f.url}>
                          <a
                            href={f.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2.5 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 transition-colors duration-200 hover:border-violet-500/50 hover:bg-slate-900"
                          >
                            <Download className="size-4 shrink-0 text-violet-300" aria-hidden />
                            <span className="min-w-0 flex-1 truncate">{f.name}</span>
                            {f.extension && (
                              <span className="shrink-0 text-xs font-medium uppercase text-slate-500">
                                {f.extension}
                              </span>
                            )}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={onRunAi}
                disabled={ai.phase === "loading"}
                className="mt-8 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 font-medium text-white transition-colors duration-200 hover:bg-violet-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {ai.phase === "loading" ? (
                  <>
                    <LoaderCircle className="size-5 animate-spin" aria-hidden />
                    Drafting your homework…
                  </>
                ) : (
                  <>
                    <Sparkles className="size-5" aria-hidden />
                    Let AI Make My Homework
                  </>
                )}
              </button>
              {ai.phase === "loading" && (
                <div className="mt-6 space-y-2" aria-hidden>
                  <div className="h-3 w-3/4 animate-pulse rounded bg-slate-800" />
                  <div className="h-3 w-full animate-pulse rounded bg-slate-800" />
                  <div className="h-3 w-5/6 animate-pulse rounded bg-slate-800" />
                </div>
              )}
              <p className="mt-3 text-center text-xs text-slate-600">
                The AI prepares a draft for your review — nothing is ever submitted automatically.
              </p>
            </>
          )}

          {ai.phase === "success" && (
            <div className="flex h-full flex-col">
              <p className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                <CheckCircle2 className="size-4 shrink-0" aria-hidden />
                Draft ready — review and edit it before using anything.
              </p>
              <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
                <section className="flex min-h-0 flex-col rounded-xl border border-slate-800 bg-slate-900/60">
                  <h3 className="border-b border-slate-800 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Teacher's instructions
                  </h3>
                  <p className="flex-1 overflow-y-auto whitespace-pre-line px-4 py-3 text-sm leading-relaxed text-slate-400">
                    {homework.description}
                  </p>
                </section>
                <section className="flex min-h-0 flex-col rounded-xl border border-violet-500/30 bg-slate-900/60">
                  <h3 className="border-b border-violet-500/20 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-violet-300">
                    AI draft — editable
                  </h3>
                  <textarea
                    value={ai.draft}
                    onChange={(e) => onEditDraft(e.target.value)}
                    aria-label="AI draft (editable)"
                    spellCheck={false}
                    className="min-h-[20rem] flex-1 resize-none bg-transparent px-4 py-3 font-mono text-sm leading-relaxed text-slate-200 focus:outline-none"
                  />
                </section>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


