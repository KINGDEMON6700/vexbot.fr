import { useNavigate } from "react-router-dom";
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
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">Sélection du serveur</h1>
        <div className="ui-card-muted px-8 py-12 text-center text-sm text-zinc-500">Chargement…</div>
      </section>
    );
  }

  if (loadStatus === "error") {
    return (
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">Sélection du serveur</h1>
        <div className="ui-card-muted px-8 py-12 text-center text-sm text-amber-200/90">
          Impossible de charger tes serveurs. Réessaie dans un instant.
        </div>
      </section>
    );
  }

  if (eligibleGuilds.length === 0) {
    return (
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">Sélection du serveur</h1>
        <div className="ui-empty-state">
          Aucun serveur disponible. Il faut être propriétaire ou administrateur d’un serveur Discord.
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">Sélection du serveur</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Choisis un serveur pour continuer dans le panel.
        </p>
      </header>

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

                <div className="flex flex-wrap items-center gap-2">
                  {ready ? (
                    <button
                      type="button"
                      className="ui-btn-primary bg-emerald-600 hover:bg-emerald-500"
                      onClick={() => {
                        setSelectedGuildId(guild.id);
                        void navigate(`/?guild=${encodeURIComponent(guild.id)}`, { replace: true });
                      }}
                    >
                      Sélectionner ce serveur
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

