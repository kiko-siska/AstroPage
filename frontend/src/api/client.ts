// Central API client. All requests go through here so auth, base URL, and
// error handling live in one place. `/api` is proxied to the backend by Vite
// in dev (see vite.config.ts) and by the reverse proxy in production.

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

export const api = {
  login: (payload: LoginPayload) =>
    request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
};
