import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api, type LoginPayload } from "../api/client";

interface AuthUser {
  username: string;
  subdomain: string;
}

interface AuthState {
  user: AuthUser | null;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // The JWT lives in an HttpOnly cookie (not readable by JS), so we only keep
  // the non-sensitive identity here for rendering. Reset on logout.
  const [user, setUser] = useState<AuthUser | null>(null);

  const login = useCallback(async (payload: LoginPayload) => {
    const res = await api.login(payload);
    setUser({ username: res.username, subdomain: res.subdomain });
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(() => ({ user, login, logout }), [user, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
