import { NavLink } from "react-router-dom";
import vexLogoFav from "@vexImg/logofav.png";
import { useAuth } from "../../contexts/AuthContext.js";
import { useGuildQuerySuffix } from "../../hooks/useGuildQuerySuffix.js";
import { GuildSelector } from "./GuildSelector.js";
import { UserAccountMenu } from "./UserAccountMenu.js";

const links = [
  { to: "/", label: "Vue d'ensemble", icon: "fa-chart-line" },
  { to: "/embeds", label: "Embeds", icon: "fa-layer-group" },
  { to: "/tickets", label: "Tickets", icon: "fa-ticket" },
  { to: "/templates", label: "Templates", icon: "fa-server" },
  { to: "/commands", label: "Commandes", icon: "fa-terminal" },
  { to: "/modules", label: "Modules", icon: "fa-puzzle-piece" },
  { to: "/logs", label: "Logs", icon: "fa-scroll" },
  { to: "/marketplace", label: "Marketplace", icon: "fa-store" },
] as const;

const navClass = ({ isActive }: { isActive: boolean }) =>
  [
    "inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium whitespace-nowrap transition duration-200",
    isActive
      ? "ui-nav-link-active"
      : "border-transparent text-zinc-400 hover:border-vex-border hover:bg-vex-surface/70 hover:text-zinc-200 [&_.nav-icon]:text-zinc-400",
    isActive ? "[&_.nav-icon]:text-indigo-300" : "",
  ].join(" ");

export function Navbar() {
  const { status, user, logout } = useAuth();
  const qs = useGuildQuerySuffix();

  return (
    <header className="sticky top-0 z-50 border-b border-vex-border/60 bg-vex-surface/40 shadow-[0_4px_24px_rgba(0,0,0,0.18)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-3 py-3 sm:px-6 sm:py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center justify-between gap-3 lg:justify-start">
            <NavLink to={`/${qs}`} className="flex min-w-0 items-center gap-2.5">
              <img
                src={vexLogoFav}
                alt=""
                className="h-8 w-8 shrink-0 rounded-lg object-contain ring-1 ring-white/10 sm:h-9 sm:w-9"
                width={36}
                height={36}
              />
              <span className="ui-gradient-text truncate text-lg font-bold tracking-tight">Vexbot</span>
            </NavLink>
            <span className="hidden text-zinc-600 sm:inline">|</span>
            <span className="hidden text-xs text-zinc-500 sm:inline">Panel</span>
          </div>

          {status === "ready" && user ? (
            <div className="flex w-full min-w-0 flex-row items-center justify-between gap-2 sm:gap-4 lg:w-auto lg:justify-end">
              <GuildSelector />
              <UserAccountMenu user={user} onLogout={logout} />
            </div>
          ) : status === "loading" ? (
            <span className="text-sm text-zinc-500">Chargement…</span>
          ) : null}
        </div>
      </div>

      <nav className="ui-nav-bar">
        <div className="ui-nav-scroll vex-scrollbar mx-auto max-w-6xl px-3 sm:px-6">
          <div className="ui-nav-pills ui-nav-track">
            {links.map(({ to, label, icon }) => (
              <NavLink key={to} to={`${to}${qs}`} className={navClass} end={to === "/"}>
                <span className={`nav-icon fa-solid ${icon}`} aria-hidden />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      </nav>
    </header>
  );
}
