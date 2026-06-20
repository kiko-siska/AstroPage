# AstroPage — Frontend

React 19 + Vite + TypeScript SPA. Connects to the FastAPI backend at `/api` (proxied by Vite in dev, same-origin via nginx in production).

## Stack

- **React 19** with strict ESLint rules (`react-hooks/purity`, `react-refresh`)
- **Vite** — dev server + production build
- **TypeScript** — strict mode
- **Tailwind CSS** (inline styles used for custom design tokens)
- **Custom i18n** — `LanguageContext` with EN/SK catalogue; no third-party i18n library

## Pages

| Route | Component | Data source |
|---|---|---|
| `/login` | `Login.tsx` | `api.login()` |
| `/` | `Dashboard.tsx` | `api.getDashboard()` |
| `/homework` | `Homework.tsx` | `api.listHomework()`, `api.generateAiDraft()` |
| `/timetable` | `Timetable.tsx` | `api.getTimetable(weekOffset)` |
| `/grades` | `Grades.tsx` | `api.listGrades()` |
| `/canteen` | `Canteen.tsx` | `api.listMeals()`, `api.orderMeal()` |
| `/settings` | `Settings.tsx` | local state (AI rules) |

## Key modules

### `src/api/client.ts`
Central API client — all `fetch` calls go here, nowhere else. Exports the `api` object with typed methods and the `ApiError` class. Uses the `HttpOnly` JWT cookie automatically (credentials: 'include').

### `src/api/cache.ts`
Session-scoped in-memory cache keyed by string. Stores data + timestamp. `cachedFetch(key, loader, ttl?)` returns cached data if fresh, otherwise calls the loader. `invalidate(key)` forces a refetch. Cleared on logout.

### `src/api/useCachedResource.ts`
React hook wrapping the cache. Returns `{ data, loading, refreshing, error, lastUpdated, refresh, mutate }`. Automatically:
- Seeds state synchronously from cache on mount (no loading flash on a cache hit)
- Refetches in the background when the cache is stale
- Triggers a refresh on tab focus with stale data
- Re-fetches when the TTL elapses while the page is open

### `src/api/prefetch.ts`
Called once on login (`void prefetchAll()`). Sequentially warms every page's cache in priority order: `dashboard` → `timetable:0` → `homework` → `grades` → `canteen:meals:3`. Each task swallows errors. Cache keys are identical to those used by each page's `useCachedResource` call.

### `src/i18n/`
- `translations.ts` — flat EN/SK dictionary. Keys are dot-separated strings (`"nav.homework"`, `"homework.aiDraft"`). Plural forms use `.one`/`.few`/`.other` suffixes.
- `LanguageContext.tsx` — `LanguageProvider` + `useT()`. Provides `t(key, vars?)`, `tn(key, n, vars?)`, and `locale` (`"en-GB"` or `"sk-SK"`).

### `src/context/AuthContext.tsx`
Manages `{ user, login, logout }`. JWT lives in an `HttpOnly` cookie; only `username` + `subdomain` are kept in memory. Calls `prefetchAll()` after a successful login.

### `src/components/`
- `AppLayout.tsx` — sidebar nav, user chip, logout button, language switcher
- `RefreshButton.tsx` — spinner + "updated N min ago" label (module-scoped to satisfy React 19 purity rules)
- `LanguageSwitcher.tsx` — EN/SK toggle; appears in sidebar footer and login card

## Development

```bash
npm install          # install deps
npm run dev          # Vite dev server on http://localhost:5173
npm run build        # production build → dist/
npm run lint         # eslint
npm run type-check   # tsc --noEmit
```

The Vite dev server proxies `/api` to `http://localhost:8000`, so run the backend separately (`make dev-backend` from the repo root).

## Design tokens

The UI uses a dark, copper-gold aesthetic:

| Token | Value |
|---|---|
| Background | `#0a0805` |
| Surface | `#161208` |
| Gold accent | `#B08D57` |
| Text primary | `#E8DCC7` |
| Success | `#88c8a0` |

Typography: **Cormorant Garamond** (headings), **Inter** (body), **JetBrains Mono** (labels, metadata).

## Adding a new page

1. Create `src/pages/<PageName>.tsx`.
2. Add a route in the router.
3. Add a nav entry in `AppLayout.tsx` using `t("nav.<key>")`.
4. Add the translation key to both `en` and `sk` dictionaries in `translations.ts`.
5. Use `useCachedResource(key, loader)` for any server data.
6. Add the cache key + loader to `prefetchAll()` in `prefetch.ts`.
