import { useNavigate } from "react-router-dom";
import { PanelPageHeader } from "../components/ui/PanelPageHeader.js";
import { useGuild } from "../contexts/GuildContext.js";
import { guildIconUrl } from "../lib/guildIconUrl.js";

function GuildAvatar({
  guildId,
  guildName,
  guildIcon,
}: {
  guildId: string;
  guildName: string;
  guildIcon: string | null;
}) {
  const icon = guildIconUrl(guildId, guildIcon, 72);
  const initial = guildName.trim().charAt(0).toUpperCase() || "?";
  if (icon) {
    return (
      <img
        src={icon}
        alt=""
        width={44}
        height={44}
        className="h-11 w-11 rounded-lg object-cover"
        decoding="async"
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-vex-border text-sm font-semibold text-zinc-300">
      {initial}
    </div>
  );
}

export function ServerSelectionPage() {
  const navigate = useNavigate();
  const { loadStatus, eligibleGuilds, setSelectedGuildId } = useGuild();

  if (loadStatus === "idle" || loadStatus === "loading") {
    return (
      <section className="flex flex-col gap-6">
        <PanelPageHeader title="Sélection du serveur" description="Chargement de votre liste de serveurs…" />
        <div className="ui-card-muted px-8 py-12 text-center text-sm text-zinc-500">Chargement…</div>
      </section>
    );
  }

  if (loadStatus === "error") {
    return (
      <section className="flex flex-col gap-6">
        <PanelPageHeader title="Sélection du serveur" description="Choisissez un serveur pour continuer dans le panel." />
        <div className="ui-card-muted px-8 py-12 text-center text-sm text-amber-200/90">
          Impossible de charger vos serveurs. Réessayez dans un instant.
        </div>
      </section>
    );
  }

  if (eligibleGuilds.length === 0) {
    return (
      <section className="flex flex-col gap-6">
        <PanelPageHeader title="Sélection du serveur" description="Choisissez un serveur pour continuer dans le panel." />
        <div className="ui-empty-state">
          Aucun serveur disponible. Il faut être propriétaire ou administrateur d’un serveur Discord.
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <PanelPageHeader title="Sélection du serveur" description="Choisissez un serveur pour continuer dans le panel." />

      <div className="grid gap-3">
        {eligibleGuilds.map((guild) => {
          const ready = guild.botPresent;
          return (
            <article key={guild.id} className="ui-card p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <GuildAvatar guildId={guild.id} guildName={guild.name} guildIcon={guild.icon} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zinc-100">{guild.name}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      Statut :{" "}
                      <span className={ready ? "text-emerald-300" : "text-amber-200/90"}>
                        {ready ? "Prêt" : "À inviter"}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 sm:justify-end">
                  {ready ? (
                    <button
                      type="button"
                      className="group flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-zinc-900/40 text-indigo-200/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm transition duration-200 hover:border-indigo-500/35 hover:bg-indigo-500/15 hover:text-indigo-50 hover:shadow-[0_0_28px_rgba(99,102,241,0.22)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-vex-bg"
                      aria-label={`Ouvrir « ${guild.name} » dans le panel`}
                      onClick={() => {
                        setSelectedGuildId(guild.id);
                        void navigate(`/?guild=${encodeURIComponent(guild.id)}`, { replace: true });
                      }}
                    >
                      <span
                        className="fa-solid fa-chevron-right translate-x-[1px] text-[15px] font-semibold transition duration-200 group-hover:translate-x-1 group-hover:text-white"
                        aria-hidden
                      />
                    </button>
                  ) : null}

                  {!ready && guild.inviteUrl ? (
                    <a
                      href={guild.inviteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ui-btn-primary inline-flex"
                    >
                      Inviter le bot
                    </a>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

