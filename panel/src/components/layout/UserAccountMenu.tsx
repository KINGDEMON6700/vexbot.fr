import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { PanelUser } from "../../types/auth.js";
import { discordUserAvatarUrl } from "../../lib/discordCdn.js";
import { useGuildQuerySuffix } from "../../hooks/useGuildQuerySuffix.js";

type Props = {
  user: PanelUser;
  onLogout: () => void | Promise<void>;
};

export function UserAccountMenu({ user, onLogout }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const qs = useGuildQuerySuffix();
  const avatarUrl = discordUserAvatarUrl(user.id, user.avatar, 80);
  const displayName = user.global_name ?? user.username;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div ref={rootRef} className="relative min-w-0 shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex min-h-10 max-w-full items-center gap-2 rounded-lg border border-vex-border/90 bg-vex-surface/90 px-2 py-1.5 text-left shadow-[0_0_0_1px_rgba(255,255,255,0.03)_inset] transition hover:border-indigo-500/30 hover:bg-vex-bg/60"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-white/10"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-vex-border text-sm font-semibold text-zinc-300">
            {displayName.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="inline min-w-0 max-w-24 truncate text-[11px] font-medium text-zinc-200 min-[420px]:max-w-32 sm:max-w-40 sm:text-sm">
          {displayName}
        </span>
        <span
          className={`fa-solid fa-chevron-down shrink-0 text-[10px] text-zinc-500 transition ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+0.35rem)] z-[120] w-[min(16rem,calc(100vw-1rem))] overflow-hidden rounded-xl border border-vex-border bg-vex-surface shadow-2xl ring-1 ring-white/5"
        >
          <div className="border-b border-vex-border/80 px-3 py-2.5">
            <p className="truncate text-sm font-medium text-zinc-100">{displayName}</p>
            <p className="truncate text-xs text-zinc-500">@{user.username}</p>
          </div>
          <div className="flex flex-col p-1">
            <Link
              role="menuitem"
              to={`/select-server${qs}`}
              className="rounded-lg px-3 py-2 text-sm text-zinc-300 transition hover:bg-vex-bg/70 hover:text-zinc-100"
              onClick={() => setOpen(false)}
            >
              <span className="fa-solid fa-server mr-2 w-4 text-center text-zinc-500" aria-hidden />
              Changer de serveur
            </Link>
            <Link
              role="menuitem"
              to={`/account-settings${qs}`}
              className="rounded-lg px-3 py-2 text-sm text-zinc-300 transition hover:bg-vex-bg/70 hover:text-zinc-100"
              onClick={() => setOpen(false)}
            >
              <span className="fa-solid fa-user-gear mr-2 w-4 text-center text-zinc-500" aria-hidden />
              Paramètres du compte
            </Link>
            <button
              type="button"
              role="menuitem"
              className="rounded-lg px-3 py-2 text-left text-sm text-zinc-300 transition hover:bg-vex-bg/70 hover:text-zinc-100"
              onClick={() => {
                setOpen(false);
                void onLogout();
              }}
            >
              <span className="fa-solid fa-right-from-bracket mr-2 w-4 text-center text-zinc-500" aria-hidden />
              Se déconnecter
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
