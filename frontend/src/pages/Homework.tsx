import { useEffect, useMemo, useState } from "react";
import {
  buildAiDraft,
  getHomeworkStatus,
  type Homework,
  type HomeworkStatus,
} from "../data/mock";
import { api, type HomeworkAttachment } from "../api/client";
import { cachedFetch, peekCache, setCache } from "../api/cache";

const HOMEWORK_CACHE_KEY = "homework";

type StatusFilter = "all" | HomeworkStatus;

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "Všetky" },
  { id: "due-soon", label: "Čoskoro" },
  { id: "pending", label: "Pending" },
  { id: "overdue", label: "Oneskorené" },
  { id: "done", label: "Hotové" },
];

type StatusStyle = { bg: string; border: string; color: string; label: string };

const STATUS_STYLES: Record<HomeworkStatus, StatusStyle> = {
  done:       { bg: "rgba(50,90,60,0.20)",  border: "rgba(50,90,60,0.35)",  color: "#88c8a0", label: "Hotové" },
  overdue:    { bg: "rgba(90,40,40,0.20)",  border: "rgba(90,40,40,0.35)",  color: "#c88888", label: "Oneskorené" },
  "due-soon": { bg: "rgba(110,78,20,0.20)", border: "rgba(110,78,20,0.35)", color: "#d4a85a", label: "Čoskoro" },
  pending:    { bg: "rgba(30,54,84,0.20)",  border: "rgba(30,54,84,0.35)",  color: "#7ab0d4", label: "Pending" },
};

type AiState = { phase: "idle" } | { phase: "loading" } | { phase: "success"; draft: string };

function fmtDue(iso: string): string {
  return new Date(iso).toLocaleDateString("sk-SK", { day: "numeric", month: "short" });
}

export default function HomeworkPage() {
  // Seed from cache so returning to this tab is instant (no spinner/refetch).
  const cachedHomework = peekCache<Homework[]>(HOMEWORK_CACHE_KEY);
  const [homework, setHomework] = useState<Homework[]>(cachedHomework ?? []);
  const [loading, setLoading] = useState(cachedHomework === undefined);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [selected, setSelected] = useState<Homework | null>(null);
  const [ai, setAi] = useState<AiState>({ phase: "idle" });
  const [togglingDone, setTogglingDone] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    cachedFetch(HOMEWORK_CACHE_KEY, api.listHomework)
      .then((items) => { if (!cancelled) setHomework(items); })
      .catch((err: { detail?: string }) => { if (!cancelled) setError(err?.detail ?? "Nepodarilo sa načítať úlohy z EduPage."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
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
    setTimeout(() => setAi({ phase: "success", draft: buildAiDraft(hw) }), 2200);
  }

  async function toggleDone(hw: Homework, done: boolean) {
    const apply = (submitted: boolean) => {
      setHomework((list) => {
        const next = list.map((h) => (h.id === hw.id ? { ...h, submitted } : h));
        setCache(HOMEWORK_CACHE_KEY, next); // keep the cached list in sync with the optimistic update
        return next;
      });
      setSelected((cur) => (cur?.id === hw.id ? { ...cur, submitted } : cur));
    };
    setTogglingDone((prev) => new Set(prev).add(hw.id));
    apply(done);
    try {
      await api.setHomeworkDone(hw.id, done);
    } catch (err) {
      apply(!done);
      setToast((err as { detail?: string })?.detail ?? "Nepodarilo sa uložiť zmenu.");
    } finally {
      setTogglingDone((prev) => { const next = new Set(prev); next.delete(hw.id); return next; });
    }
  }

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  return (
    <div style={{ padding: "36px 40px" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
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
          Zoznam
        </div>
        <div
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 34,
            fontWeight: 500,
            color: "#E8DCC7",
            letterSpacing: "-0.01em",
          }}
        >
          Domáce úlohy
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 22, flexWrap: "wrap" }}>
        {/* Search */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#161208",
            border: "1px solid rgba(176,141,87,0.14)",
            borderRadius: 7,
            padding: "8px 12px",
            flexShrink: 0,
          }}
        >
          <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
            <circle cx="6" cy="6" r="4" stroke="rgba(176,141,87,0.45)" strokeWidth="1.3" />
            <path d="M10 10l3 3" stroke="rgba(176,141,87,0.45)" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Hľadať…"
            style={{
              background: "transparent",
              border: "none",
              outline: "none",
              fontFamily: "'Inter', sans-serif",
              fontSize: 12,
              color: "rgba(232,220,199,0.6)",
              width: 160,
              padding: 0,
            }}
          />
        </div>

        {/* Filter pills */}
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              style={{
                padding: "7px 12px",
                borderRadius: 6,
                border: `1px solid ${active ? "rgba(176,141,87,0.32)" : "rgba(176,141,87,0.12)"}`,
                background: active ? "rgba(176,141,87,0.12)" : "transparent",
                cursor: "pointer",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 9,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: active ? "#B08D57" : "rgba(232,220,199,0.42)",
                transition: "all 0.15s",
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {error ? (
        <ErrorPanel message={error} />
      ) : loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              style={{
                height: 144,
                background: "rgba(176,141,87,0.06)",
                borderRadius: 10,
                border: "1px solid rgba(176,141,87,0.08)",
                animation: "none",
                opacity: 0.6,
              }}
            />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div
          style={{
            border: "1px dashed rgba(176,141,87,0.18)",
            borderRadius: 10,
            padding: "64px 24px",
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "rgba(232,220,199,0.28)",
            }}
          >
            Žiadne úlohy nezodpovedajú filtru.
          </p>
        </div>
      ) : (
        <ul style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, listStyle: "none", padding: 0, margin: 0 }}>
          {visible.map((hw) => {
            const st = STATUS_STYLES[getHomeworkStatus(hw)];
            return (
              <li key={hw.id}>
                <HomeworkCard hw={hw} st={st} onClick={() => openDetail(hw)} />
              </li>
            );
          })}
        </ul>
      )}

      {/* Detail drawer */}
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
          }}
        >
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.12em", color: "#c88888" }}>
            {toast}
          </span>
          <button
            type="button"
            onClick={() => setToast(null)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(232,220,199,0.4)", padding: 0 }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

function HomeworkCard({ hw, st, onClick }: { hw: Homework; st: StatusStyle; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: "100%",
        background: hovered ? "#1c1710" : "#161208",
        border: `1px solid ${hovered ? "rgba(176,141,87,0.3)" : "rgba(176,141,87,0.14)"}`,
        borderRadius: 10,
        padding: 18,
        cursor: "pointer",
        textAlign: "left",
        transition: "background 0.15s, border-color 0.15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10, gap: 8 }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.13em", textTransform: "uppercase", color: "#B08D57" }}>
          {hw.subject}
        </div>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 8,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            padding: "3px 7px",
            borderRadius: 4,
            background: st.bg,
            color: st.color,
            border: `1px solid ${st.border}`,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {st.label}
        </span>
      </div>
      <div
        style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 14,
          fontWeight: 500,
          color: "#E8DCC7",
          marginBottom: 6,
          lineHeight: 1.3,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {hw.title}
      </div>
      <div
        style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 12,
          color: "rgba(232,220,199,0.42)",
          lineHeight: 1.5,
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          marginBottom: 12,
        }}
      >
        {hw.description}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="2" width="12" height="11" rx="1" stroke="rgba(232,220,199,0.28)" strokeWidth="1.2" />
            <path d="M4 1v2M10 1v2M1 5h12" stroke="rgba(232,220,199,0.28)" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "rgba(232,220,199,0.35)", letterSpacing: "0.05em" }}>
            {fmtDue(hw.dueAt)}
          </span>
        </div>
        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: "rgba(232,220,199,0.28)" }}>
          {hw.teacher}
        </span>
      </div>
    </button>
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

function DetailDrawer({ homework, ai, doneBusy, onToggleDone, onRunAi, onEditDraft, onClose }: DrawerProps) {
  const st = STATUS_STYLES[getHomeworkStatus(homework)];
  const [attachments, setAttachments] = useState<HomeworkAttachment[]>([]);
  const [attLoading, setAttLoading] = useState(Boolean(homework.hasAttachments));
  const [attError, setAttError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!homework.hasAttachments) return;
    let cancelled = false;
    api
      .listHomeworkAttachments(homework.id)
      .then((files) => { if (!cancelled) setAttachments(files); })
      .catch((err: { detail?: string }) => { if (!cancelled) setAttError(err?.detail ?? "Nepodarilo sa načítať prílohy."); })
      .finally(() => { if (!cancelled) setAttLoading(false); });
    return () => { cancelled = true; };
  }, [homework.id, homework.hasAttachments]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.42)",
          zIndex: 49,
          transition: "opacity 0.32s",
        }}
      />

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={homework.title}
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: 460,
          background: "#120f0b",
          borderLeft: "1px solid rgba(176,141,87,0.18)",
          boxShadow: "-24px 0 60px rgba(0,0,0,0.5)",
          zIndex: 50,
          overflowY: "auto",
          transform: "translateX(0)",
          transition: "transform 0.32s cubic-bezier(0.2,0.7,0.15,1)",
        }}
      >
        <div style={{ padding: "24px 24px 48px" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ paddingRight: 16, minWidth: 0 }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "#B08D57", marginBottom: 5 }}>
                {homework.subject}
              </div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 500, color: "#E8DCC7", lineHeight: 1.2 }}>
                {homework.title}
              </div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: "rgba(232,220,199,0.35)", marginTop: 5 }}>
                {homework.teacher} · splatné {fmtDue(homework.dueAt)}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Zavrieť"
              style={{
                width: 28,
                height: 28,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid rgba(176,141,87,0.18)",
                borderRadius: 5,
                cursor: "pointer",
                background: "transparent",
                flexShrink: 0,
              }}
            >
              <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                <path d="M1 1l8 8M9 1L1 9" stroke="rgba(232,220,199,0.45)" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Status badge */}
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 8,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              padding: "3px 8px",
              borderRadius: 4,
              background: st.bg,
              color: st.color,
              border: `1px solid ${st.border}`,
            }}
          >
            {st.label}
          </span>

          <div style={{ height: 1, background: "rgba(176,141,87,0.1)", margin: "16px 0" }} />

          {/* Mark as done */}
          <button
            type="button"
            onClick={() => onToggleDone(!homework.submitted)}
            disabled={doneBusy}
            aria-pressed={homework.submitted}
            style={{
              width: "100%",
              padding: 11,
              borderRadius: 8,
              border: `1px solid ${homework.submitted ? "rgba(50,90,60,0.35)" : "rgba(176,141,87,0.25)"}`,
              background: homework.submitted ? "rgba(50,90,60,0.18)" : "rgba(176,141,87,0.12)",
              textAlign: "center",
              cursor: doneBusy ? "not-allowed" : "pointer",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: homework.submitted ? "#88c8a0" : "#B08D57",
              marginBottom: 18,
              opacity: doneBusy ? 0.6 : 1,
              transition: "all 0.2s",
            }}
          >
            {doneBusy ? "Ukladanie…" : homework.submitted ? "✓ Hotové — kliknúť na zrušenie" : "Označiť ako hotové"}
          </button>

          {/* Description */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(176,141,87,0.5)", marginBottom: 8 }}>
              Zadanie
            </div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "rgba(232,220,199,0.68)", lineHeight: 1.65, whiteSpace: "pre-line" }}>
              {homework.description}
            </div>
          </div>

          {/* Attachments */}
          {homework.hasAttachments && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(176,141,87,0.5)", marginBottom: 8 }}>
                Prílohy
              </div>
              {attLoading ? (
                <div style={{ height: 36, background: "rgba(176,141,87,0.06)", borderRadius: 6 }} />
              ) : attError ? (
                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: "#c88888" }}>{attError}</p>
              ) : attachments.length === 0 ? (
                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: "rgba(232,220,199,0.3)" }}>Žiadne prílohy.</p>
              ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                  {attachments.map((f) => (
                    <li key={f.url}>
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          background: "rgba(176,141,87,0.06)",
                          border: "1px solid rgba(176,141,87,0.14)",
                          borderRadius: 6,
                          padding: "8px 10px",
                          textDecoration: "none",
                          color: "#E8DCC7",
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                          <path d="M7 1v8M4 6l3 3 3-3M2 11h10" stroke="#B08D57" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {f.name}
                        </span>
                        {f.extension && (
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, textTransform: "uppercase", color: "rgba(232,220,199,0.4)" }}>
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

          <div style={{ height: 1, background: "rgba(176,141,87,0.1)", marginBottom: 18 }} />

          {/* AI section */}
          {ai.phase === "idle" && (
            <AiButton onClick={onRunAi} />
          )}

          {ai.phase === "loading" && (
            <div
              style={{
                padding: 16,
                background: "rgba(176,141,87,0.06)",
                borderRadius: 8,
                border: "1px solid rgba(176,141,87,0.12)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div
                  style={{
                    width: 14,
                    height: 14,
                    border: "1.5px solid #B08D57",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.14em", color: "rgba(176,141,87,0.8)" }}>
                  AI generuje návrh…
                </span>
              </div>
              <div style={{ height: 8, background: "rgba(176,141,87,0.08)", borderRadius: 4, marginBottom: 6, width: "88%" }} />
              <div style={{ height: 8, background: "rgba(176,141,87,0.06)", borderRadius: 4, marginBottom: 6, width: "72%" }} />
              <div style={{ height: 8, background: "rgba(176,141,87,0.04)", borderRadius: 4, width: "55%" }} />
            </div>
          )}

          {ai.phase === "success" && (
            <div>
              <div
                style={{
                  background: "rgba(60,100,72,0.1)",
                  border: "1px solid rgba(60,100,72,0.22)",
                  borderRadius: 6,
                  padding: "10px 14px",
                  marginBottom: 14,
                }}
              >
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: "#88c8a0" }}>
                  Návrh je pripravený — skontroluj a uprav ho pred použitím.
                </span>
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(176,141,87,0.5)", marginBottom: 6 }}>
                AI Návrh — upraviteľné
              </div>
              <textarea
                value={ai.draft}
                onChange={(e) => onEditDraft(e.target.value)}
                rows={9}
                aria-label="AI návrh (upraviteľné)"
                spellCheck={false}
                style={{
                  width: "100%",
                  padding: 12,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11,
                  lineHeight: 1.65,
                  resize: "vertical",
                  borderColor: "rgba(176,141,87,0.28)",
                }}
              />
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, color: "rgba(232,220,199,0.22)", marginTop: 6 }}>
                Nič sa neodovzdáva automaticky.
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function AiButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: "100%",
        padding: 13,
        borderRadius: 8,
        background: hovered ? "rgba(176,141,87,0.14)" : "rgba(176,141,87,0.08)",
        border: "1px solid rgba(176,141,87,0.25)",
        textAlign: "center",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        transition: "background 0.15s",
      }}
    >
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
        <path d="M7 1l1.4 3.5L12 5 9.7 7.3l.8 3.7L7 9.5 3.5 11l.8-3.7L2 5l3.6-.5L7 1z" stroke="#B08D57" strokeWidth="1.2" strokeLinejoin="round" />
      </svg>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "#B08D57" }}>
        Nechaj AI vypracovať
      </span>
    </button>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div
      style={{
        background: "rgba(90,40,40,0.2)",
        border: "1px solid rgba(90,40,40,0.35)",
        borderRadius: 10,
        padding: "48px 24px",
        textAlign: "center",
      }}
    >
      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "#c88888", margin: 0 }}>{message}</p>
      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: "rgba(232,220,199,0.3)", margin: "6px 0 0" }}>
        Skúste znova alebo sa prihláste.
      </p>
    </div>
  );
}
