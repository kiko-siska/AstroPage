// Central API client. All requests go through here so auth, base URL, and
// error handling live in one place. `/api` is proxied to the backend by Vite
// in dev (see vite.config.ts) and by the reverse proxy in production.

import type { Homework } from "../data/mock";

const BASE = "/api/v1";

export interface ApiError {
  status: number;
  detail: string;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    // Send the HttpOnly session cookie on every request.
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
    ...options,
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      // non-JSON error body; keep statusText
    }
    throw { status: res.status, detail } satisfies ApiError;
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface LoginPayload {
  username: string;
  password: string;
  subdomain: string;
}

export interface LoginResponse {
  username: string;
  subdomain: string;
}

// Wire shape returned by GET /homework/list (snake_case, nullable fields).
interface HomeworkItemDTO {
  id: string;
  subject: string | null;
  title: string;
  description: string;
  teacher: string | null;
  assigned_at: string | null;
  due_date: string | null;
  is_done: boolean;
  has_attachments: boolean;
}

export interface HomeworkAttachment {
  name: string;
  url: string;
  type: string | null;
  extension: string | null;
}

function toHomework(item: HomeworkItemDTO): Homework {
  // The UI's date helpers assume non-null ISO strings; fall back gracefully
  // when EduPage omits a due/assigned date.
  const fallbackDate = item.due_date ?? item.assigned_at ?? new Date().toISOString();
  return {
    id: item.id,
    subject: item.subject ?? "General",
    title: item.title,
    description: item.description,
    teacher: item.teacher ?? "Unknown",
    assignedAt: item.assigned_at ?? fallbackDate,
    dueAt: item.due_date ?? fallbackDate,
    submitted: item.is_done,
    hasAttachments: item.has_attachments,
  };
}

// ── Canteen wire shapes (snake_case, nullable fields) ───────────────────────

export interface MenuOptionDTO {
  letter: string;
  name: string | null;
  allergens: string | null;
  weight: string | null;
}

export interface MealDayDTO {
  date: string; // "YYYY-MM-DD"
  open: boolean;
  title: string | null;
  options: MenuOptionDTO[];
  /** Letter of the currently ordered menu, null when signed off / not ordered. */
  ordered_meal: string | null;
  can_be_changed_until: string | null;
}

// ── Grades wire shapes (snake_case, nullable fields) ────────────────────────

interface GradeDTO {
  id: string;
  value: string;
  weight: number;
  description: string;
  date: string | null; // "YYYY-MM-DD"
  max_points: number | null;
}

interface SubjectGradesDTO {
  subject_name: string;
  current_average: number | null;
  is_points: boolean;
  grades: GradeDTO[];
}

interface GradesResponseDTO {
  subjects: SubjectGradesDTO[];
}

/** One official grade on a subject's report card. For points grades `value`
 *  is the earned points and `maxPoints` the maximum (render as "value/max"). */
export interface Grade {
  id: string;
  value: string;
  weight: number;
  description: string;
  date: string | null;
  maxPoints: number | null;
}

/** A subject with its grades and EduPage's average. When `isPoints` is true,
 *  `currentAverage` is a percentage (0–100); otherwise a 1–5 weighted average. */
export interface SubjectGrades {
  subjectName: string;
  currentAverage: number | null;
  isPoints: boolean;
  grades: Grade[];
}

function toSubjectGrades(dto: SubjectGradesDTO): SubjectGrades {
  return {
    subjectName: dto.subject_name,
    currentAverage: dto.current_average,
    isPoints: dto.is_points,
    grades: dto.grades.map((g) => ({
      id: g.id,
      value: g.value,
      weight: g.weight,
      description: g.description,
      date: g.date,
      maxPoints: g.max_points,
    })),
  };
}

// ── Dashboard wire shapes ───────────────────────────────────────────────────

interface PeriodDTO {
  period: number | null;
  start: string;
  end: string;
  subject: string;
  classroom: string | null;
  teacher: string | null;
  is_cancelled: boolean;
  curriculum: string | null;
}

interface DashboardSummaryDTO {
  date: string;
  pending_homework: number;
  due_within_24h: number;
  lessons_total: number;
  lessons_cancelled: number;
  schedule_available: boolean;
  schedule: PeriodDTO[];
}

/** One timetable period on the dashboard. */
export interface DashboardPeriod {
  period: number | null;
  start: string;
  end: string;
  subject: string;
  classroom: string | null;
  teacher: string | null;
  isCancelled: boolean;
  curriculum: string | null;
}

/** Live home-page summary: today's timetable + homework counts. */
export interface DashboardSummary {
  date: string;
  pendingHomework: number;
  dueWithin24h: number;
  lessonsTotal: number;
  lessonsCancelled: number;
  scheduleAvailable: boolean;
  schedule: DashboardPeriod[];
}

function toDashboardSummary(dto: DashboardSummaryDTO): DashboardSummary {
  return {
    date: dto.date,
    pendingHomework: dto.pending_homework,
    dueWithin24h: dto.due_within_24h,
    lessonsTotal: dto.lessons_total,
    lessonsCancelled: dto.lessons_cancelled,
    scheduleAvailable: dto.schedule_available,
    schedule: dto.schedule.map((p) => ({
      period: p.period,
      start: p.start,
      end: p.end,
      subject: p.subject,
      classroom: p.classroom,
      teacher: p.teacher,
      isCancelled: p.is_cancelled,
      curriculum: p.curriculum,
    })),
  };
}

// ── Timetable wire shapes ───────────────────────────────────────────────────

interface TimetableDayDTO {
  date: string;
  available: boolean;
  periods: PeriodDTO[];
}

interface TimetableWeekDTO {
  week_start: string;
  week_offset: number;
  days: TimetableDayDTO[];
}

/** One weekday's lessons. `available` is false when EduPage couldn't load it. */
export interface TimetableDay {
  date: string;
  available: boolean;
  periods: DashboardPeriod[];
}

export interface TimetableWeek {
  weekStart: string;
  weekOffset: number;
  days: TimetableDay[];
}

function toTimetableWeek(dto: TimetableWeekDTO): TimetableWeek {
  return {
    weekStart: dto.week_start,
    weekOffset: dto.week_offset,
    days: dto.days.map((d) => ({
      date: d.date,
      available: d.available,
      periods: d.periods.map((p) => ({
        period: p.period,
        start: p.start,
        end: p.end,
        subject: p.subject,
        classroom: p.classroom,
        teacher: p.teacher,
        isCancelled: p.is_cancelled,
        curriculum: p.curriculum,
      })),
    })),
  };
}

export interface OrderResponseDTO {
  date: string;
  ordered_meal: string | null;
}

export interface BulkSignupResponseDTO {
  updated_days: number;
  skipped_days: number;
}

export const api = {
  login: (payload: LoginPayload) =>
    request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  getDashboard: async (): Promise<DashboardSummary> =>
    toDashboardSummary(await request<DashboardSummaryDTO>("/dashboard/summary")),
  getTimetable: async (offset = 0): Promise<TimetableWeek> =>
    toTimetableWeek(await request<TimetableWeekDTO>(`/timetable/week?offset=${offset}`)),
  listHomework: async (): Promise<Homework[]> => {
    const items = await request<HomeworkItemDTO[]>("/homework/list");
    return items.map(toHomework);
  },
  listHomeworkAttachments: (id: string) =>
    request<HomeworkAttachment[]>(`/homework/${encodeURIComponent(id)}/attachments`),
  setHomeworkDone: (id: string, done: boolean) =>
    request<{ assignment_id: string; is_done: boolean }>(
      `/homework/${encodeURIComponent(id)}/done`,
      { method: "POST", body: JSON.stringify({ done }) },
    ),
  listGrades: async (): Promise<SubjectGrades[]> => {
    const body = await request<GradesResponseDTO>("/grades");
    return body.subjects.map(toSubjectGrades);
  },
  listMeals: (weeks = 3) => request<MealDayDTO[]>(`/canteen/meals?weeks=${weeks}`),
  // `choice` is a menu letter ("A", "B", …), or null to sign off the meal.
  orderMeal: (date: string, choice: string | null) =>
    request<OrderResponseDTO>("/canteen/order", {
      method: "POST",
      body: JSON.stringify({ date, choice }),
    }),
  bulkSignup: (daysCount: number, preferredChoice: string) =>
    request<BulkSignupResponseDTO>("/canteen/bulk-signup", {
      method: "POST",
      body: JSON.stringify({ days_count: daysCount, preferred_choice: preferredChoice }),
    }),
};
