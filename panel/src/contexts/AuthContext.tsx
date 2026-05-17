import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiFetch, getDiscordLoginUrl } from "../lib/api.js";
import type { PanelGuild, PanelUser } from "../types/auth.js";

type AuthStatus = "loading" | "ready";

type AuthContextValue = {
  status: AuthStatus;
  user: PanelUser | null;
  guilds: PanelGuild[];
  refresh: () => Promise<void>;
  startDiscordLogin: () => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<PanelUser | null>(null);
  const [guilds, setGuilds] = useState<PanelGuild[]>([]);

  const refresh = useCallback(async () => {
    setStatus("loading");
    try {
      const res = await apiFetch("/api/auth/me");
      if (res.status === 401) {
        setUser(null);
        setGuilds([]);
        return;
      }
      if (!res.ok) {
        setUser(null);
        setGuilds([]);
        return;
      }
      const data = (await res.json()) as { user: PanelUser; guilds?: PanelGuild[]; isAdmin?: boolean };
      setUser({ ...data.user, isAdmin: Boolean(data.isAdmin) });
      setGuilds(data.guilds ?? []);
    } catch {
      setUser(null);
      setGuilds([]);
    } finally {
      setStatus("ready");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const startDiscordLogin = useCallback(() => {
    window.location.href = getDiscordLoginUrl();
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
      setGuilds([]);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      guilds,
      refresh,
      startDiscordLogin,
      logout,
    }),
    [status, user, guilds, refresh, startDiscordLogin, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth doit être utilisé dans un AuthProvider.");
  }
  return ctx;
}
