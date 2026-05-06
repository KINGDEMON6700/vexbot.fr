import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSearchParams } from "react-router-dom";
import { apiFetch } from "../lib/api.js";
import type { EligibleGuild } from "../types/guild.js";
import { useAuth } from "./AuthContext.js";

type GuildLoadStatus = "idle" | "loading" | "ready" | "error";

type GuildContextValue = {
  eligibleGuilds: EligibleGuild[];
  loadStatus: GuildLoadStatus;
  selectedGuildId: string | null;
  selectedGuild: EligibleGuild | null;
  /** ?guild= présent mais inconnu dans la liste */
  isGuildParamInvalid: boolean;
  /** Aucune sélection alors que la liste est chargée */
  needsGuildSelection: boolean;
  setSelectedGuildId: (id: string | null) => void;
};

const GuildContext = createContext<GuildContextValue | null>(null);

export function GuildProvider({ children }: { children: ReactNode }) {
  const { status: authStatus, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [eligibleGuilds, setEligibleGuilds] = useState<EligibleGuild[]>([]);
  const [loadStatus, setLoadStatus] = useState<GuildLoadStatus>("idle");

  const selectedGuildId = searchParams.get("guild");

  useEffect(() => {
    if (authStatus !== "ready" || !user) {
      setEligibleGuilds([]);
      setLoadStatus("idle");
      return;
    }

    let cancelled = false;
    setLoadStatus("loading");

    void (async () => {
      try {
        const res = await apiFetch("/api/guilds/eligible");
        if (!res.ok) throw new Error("eligible");
        const data = (await res.json()) as { guilds: EligibleGuild[] };
        if (!cancelled) {
          setEligibleGuilds(data.guilds);
          setLoadStatus("ready");
        }
      } catch {
        if (!cancelled) {
          setEligibleGuilds([]);
          setLoadStatus("error");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authStatus, user]);

  useEffect(() => {
    if (authStatus === "ready" && !user) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("guild");
          return next;
        },
        { replace: true },
      );
    }
  }, [authStatus, user, setSearchParams]);

  const selectedGuild = useMemo(() => {
    if (!selectedGuildId) return null;
    return eligibleGuilds.find((g) => g.id === selectedGuildId) ?? null;
  }, [eligibleGuilds, selectedGuildId]);

  const isGuildParamInvalid = Boolean(
    selectedGuildId && loadStatus === "ready" && eligibleGuilds.length > 0 && !selectedGuild,
  );

  const needsGuildSelection = Boolean(
    user && loadStatus === "ready" && !selectedGuildId && eligibleGuilds.length > 0,
  );

  const setSelectedGuildId = useCallback(
    (id: string | null) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (id) next.set("guild", id);
          else next.delete("guild");
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const value = useMemo<GuildContextValue>(
    () => ({
      eligibleGuilds,
      loadStatus,
      selectedGuildId,
      selectedGuild,
      isGuildParamInvalid,
      needsGuildSelection,
      setSelectedGuildId,
    }),
    [
      eligibleGuilds,
      loadStatus,
      selectedGuildId,
      selectedGuild,
      isGuildParamInvalid,
      needsGuildSelection,
      setSelectedGuildId,
    ],
  );

  return <GuildContext.Provider value={value}>{children}</GuildContext.Provider>;
}

export function useGuild(): GuildContextValue {
  const ctx = useContext(GuildContext);
  if (!ctx) {
    throw new Error("useGuild doit être utilisé dans un GuildProvider.");
  }
  return ctx;
}
