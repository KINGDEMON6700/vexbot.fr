import { NavLink } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext.js";
import { useGuildQuerySuffix } from "../../hooks/useGuildQuerySuffix.js";
import { GuildSelector } from "./GuildSelector.js";

const links = [
  { to: "/", label: "Vue d'ensemble" },
  { to: "/embeds", label: "Embeds" },
  { to: "/tickets", label: "Tickets" },
  { to: "/logs", label: "Logs" },
  { to: "/roles", label: "Rôles" },
  { to: "/commands", label: "Commandes" },
] as const;

const navClass = ({ isActive }: { isActive: boolean }) =>
  [
    "rounded-lg px-3 py-2 text-sm font-medium transition",
    isActive
      ? "bg-vex-surface text-zinc-100 shadow-sm"
      : "text-zinc-400 hover:bg-vex-surface/60 hover:text-zinc-200",
  ].join(" ");

export function Navbar() {
  const { status, user, startDiscordLogin, logout } = useAuth();
  const qs = useGuildQuerySuffix();

  return (
    <header className="border-b border-vex-border bg-vex-bg/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <NavLink to={`/${qs}`} className="text-lg font-semibold text-zinc-100">
              Vex
            </NavLink>
            <span className="hidden text-zinc-600 sm:inline">|</span>
            <span className="hidden text-xs text-zinc-500 sm:inline">
              Panneau d’administration
            </span>
          </div>

          {status === "ready" && user ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <GuildSelector />
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <span className="hidden text-sm text-zinc-400 sm:inline">
                  {user.global_name ?? user.username}
                </span>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="rounded-lg border border-vex-border px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-vex-surface"
                >
                  Se déconnecter
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {status === "ready" ? (
                <button
                  type="button"
                  onClick={startDiscordLogin}
                  className="rounded-lg bg-vex-accent px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90"
                >
                  Se connecter
                </button>
              ) : (
                <span className="text-sm text-zinc-500">Chargement…</span>
              )}
            </div>
          )}
        </div>
      </div>

      <nav className="border-t border-vex-border/60 bg-vex-bg/80">
        <div className="mx-auto flex max-w-6xl flex-wrap gap-1 px-4 py-2 sm:px-6">
          {links.map(({ to, label }) => (
            <NavLink
              key={to}
              to={`${to}${qs}`}
              className={navClass}
              end={to === "/"}
            >
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </header>
  );
}
