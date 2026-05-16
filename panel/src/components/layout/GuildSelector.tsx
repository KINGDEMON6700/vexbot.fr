import { useEffect, useId, useRef, useState } from "react";
import { useGuild } from "../../contexts/GuildContext.js";
import type { EligibleGuild } from "../../types/guild.js";
import { guildIconUrl } from "../../lib/guildIconUrl.js";

function GuildAvatar({ guild, size }: { guild: EligibleGuild; size: number }) {
  const url = guildIconUrl(guild.id, guild.icon, Math.max(64, size * 2));
  const initial = guild.name?.trim()?.charAt(0)?.toUpperCase() ?? "?";

  if (url) {
    return (
      <div
        className="shrink-0 overflow-hidden rounded-lg bg-vex-border"
        style={{ width: size, height: size, minWidth: size, minHeight: size }}
      >
        <img
          src={url}
          alt=""
          width={size}
          height={size}
          decoding="async"
          referrerPolicy="no-referrer"
          className="block h-full w-full max-w-none object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-lg bg-vex-border text-sm font-semibold text-zinc-400"
      style={{ width: size, height: size, minWidth: size, minHeight: size }}
    >
      {initial}
    </div>
  );
}

export function GuildSelector() {
  const {
    eligibleGuilds,
    loadStatus,
    selectedGuildId,
    selectedGuild,
    setSelectedGuildId,
  } = useGuild();

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

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

  if (loadStatus === "idle" || loadStatus === "loading") {
    return (
      <span className="text-xs text-zinc-500" aria-live="polite">
        Chargement des serveurs…
      </span>
    );
  }

  if (loadStatus === "error") {
    return (
      <span className="text-xs text-amber-400/90">
        Impossible de charger vos serveurs. Réessayez plus tard.
      </span>
    );
  }

  if (eligibleGuilds.length === 0) {
    return (
      <span className="max-w-xs text-xs text-zinc-500">
        Aucun serveur éligible (il faut être propriétaire ou administrateur).
      </span>
    );
  }

  const guildsWithBot = eligibleGuilds.filter((g) => g.botPresent);

  return (
    <div className="flex min-w-0 flex-1 flex-row items-center gap-2 sm:flex-none sm:gap-3">
      <div
        className="relative min-w-0 flex-1 sm:w-[18rem] sm:max-w-xs sm:flex-none"
        ref={rootRef}
      >
        <label className="sr-only" htmlFor="vex-guild-trigger">
          Serveur Discord
        </label>
        <button
          type="button"
          id="vex-guild-trigger"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-2 rounded-lg border border-vex-border/90 bg-vex-surface/90 px-2 py-1.5 text-left text-[11px] text-zinc-100 shadow-[0_0_0_1px_rgba(255,255,255,0.03)_inset] outline-none backdrop-blur-sm transition hover:border-indigo-500/30 hover:bg-vex-bg/60 focus:border-vex-accent focus:ring-1 focus:ring-vex-accent sm:text-sm"
        >
          {selectedGuild ? (
            <>
              <GuildAvatar guild={selectedGuild} size={32} />
              <span className="min-w-0 flex-1 truncate font-medium">{selectedGuild.name}</span>
              {selectedGuild.botPresent ? (
                <span
                  className="shrink-0 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300"
                  title="Vexbot est sur ce serveur"
                >
                  Prêt
                </span>
              ) : (
                <span
                  className="shrink-0 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-200/90"
                  title="Invitez le bot pour configurer"
                >
                  À inviter
                </span>
              )}
            </>
          ) : (
            <span className="min-w-0 flex-1 truncate px-1 text-zinc-400">Choisir un serveur</span>
          )}
          <span
            className={`fa-solid fa-chevron-down shrink-0 text-xs text-zinc-500 transition ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>

        {open ? (
          <ul
            id={listboxId}
            role="listbox"
            aria-labelledby="vex-guild-trigger"
            className="absolute left-0 z-50 mt-1 max-h-[min(18rem,calc(100vh-9rem))] w-[min(20rem,calc(100vw-1.5rem))] overflow-auto rounded-xl border border-vex-border bg-vex-surface py-1 shadow-xl ring-1 ring-black/20"
          >
            <li role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={selectedGuildId == null || selectedGuildId === ""}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-zinc-400 transition hover:bg-vex-bg/60"
                onClick={() => {
                  setSelectedGuildId(null);
                  setOpen(false);
                }}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-dashed border-vex-border/80 text-xs text-zinc-500">
                  —
                </span>
                <span>Choisir plus tard</span>
              </button>
            </li>
            {guildsWithBot.length === 0 ? (
              <li role="presentation" className="px-3 py-3 text-xs leading-relaxed text-zinc-500">
                Aucun serveur avec Vex pour l’instant. Utilisez « Changer de serveur » dans votre profil pour
                inviter le bot.
              </li>
            ) : (
              guildsWithBot.map((g) => {
                const isActive = g.id === selectedGuildId;
                return (
                  <li key={g.id} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      className={`flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm transition hover:bg-vex-bg/60 ${
                        isActive ? "bg-vex-bg/50" : ""
                      }`}
                      onClick={() => {
                        setSelectedGuildId(g.id);
                        setOpen(false);
                      }}
                    >
                      <div className="mt-0.5 shrink-0">
                        <GuildAvatar guild={g} size={36} />
                      </div>
                      <span className="min-w-0 flex-1 break-words font-medium leading-snug text-zinc-100">
                        {g.name}
                      </span>
                      <span className="mt-0.5 shrink-0 self-start rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
                        Prêt
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        ) : null}
      </div>

      {selectedGuild && !selectedGuild.botPresent && selectedGuild.inviteUrl ? (
        <a
          href={selectedGuild.inviteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden shrink-0 text-center text-sm font-medium text-vex-accent underline-offset-2 hover:underline sm:inline"
        >
          Inviter Vex sur ce serveur
        </a>
      ) : null}
    </div>
  );
}
