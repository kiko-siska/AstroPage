// Background warm-up of every page's data right after login.
//
// We fetch sequentially in priority order so the main page (dashboard) is ready
// first, then the rest fill in while the student reads it. Each result lands in
// the same session cache the pages read from, so navigating to any tab is an
// instant cache hit instead of a fresh EduPage round-trip. Failures are
// swallowed — a prefetch miss just means that page loads normally on visit.
//
// The cache keys here MUST match the keys each page passes to useCachedResource.

import { cachedFetch } from "./cache";
import { api } from "./client";

export async function prefetchAll(): Promise<void> {
  // Dashboard (main page) first, then the secondary tabs in display order.
  const tasks: Array<[string, () => Promise<unknown>]> = [
    ["dashboard", api.getDashboard],
    ["timetable:0", () => api.getTimetable(0)],
    ["homework", api.listHomework],
    ["grades", api.listGrades],
    ["canteen:meals:3", () => api.listMeals(3)],
  ];

  for (const [key, loader] of tasks) {
    try {
      await cachedFetch(key, loader);
    } catch {
      // Ignore — the page will load this resource itself when visited.
    }
  }
}
