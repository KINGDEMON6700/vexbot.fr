import { useCallback, useEffect, useState, type ReactNode } from "react";
import { fetchGuildOverview } from "../../lib/overviewApi.js";
import { createPageCache } from "../../lib/pageDataCache.js";
import { OverviewPageSkeleton } from "../ui/PageSkeleton.js";
import { PanelPageHeader } from "../ui/PanelPageHeader.js";
import type { OverviewResponse } from "../../types/overview.js";

const overviewCache = createPageCache<OverviewResponse>();

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function formatBoostTier(tier: number | null): string {
  if (tier === null || tier === undefined) return "—";
  if (tier === 0) return "Aucun";
  return `Palier ${tier}`;
}

function StatGroupTitle({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{children}</p>
  );
}

/** Icônes Font Awesome 6 (`fa-solid` + nom, ex. fa-users) */
function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: string;
}) {
  return (
    <div className="flex gap-3 rounded-lg border border-vex-border/80 bg-vex-bg/50 px-3 py-2.5">
      <span
        className={`fa-solid ${icon} mt-0.5 w-[1.1rem] shrink-0 text-center text-sm text-vex-accent/90`}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-zinc-500">{label}</p>
        <p className="mt-0.5 text-sm font-medium tabular-nums text-zinc-100">{value}</p>
      </div>
    </div>
  );
}

type Props = {
  discordGuildId: string;
};

export function OverviewPageContent({ discordGuildId }: Props) {
  const [data, setData] = useState<OverviewResponse | null>(
    () => overviewCache.get(discordGuildId) ?? null,
  );
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const o = await fetchGuildOverview(discordGuildId);
      overviewCache.set(discordGuildId, o);
      setData(o);
    } catch {
      setLoadError(true);
    }
  }, [discordGuildId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loadError && !data) {
    return (
      <div className="flex flex-col gap-6">
        <PanelPageHeader title="Vue d'ensemble" description={"Votre serveur Discord et l'activité de Vex sur ce serveur."} />
        <div className="rounded-xl border border-vex-border bg-vex-surface/50 px-6 py-10 text-center text-sm text-zinc-400">
          Impossible de charger la vue d’ensemble. Réessayez dans un instant.
        </div>
      </div>
    );
  }

  if (!data) {
    return <OverviewPageSkeleton />;
  }

  const d = data.discord;
  const graySecondThird = !data.botPresent;
  const inviteLink = data.inviteUrl;

  return (
    <div className="flex flex-col gap-6">
      <PanelPageHeader
        title="Vue d'ensemble"
        description={"Votre serveur Discord et l'activité de Vex sur ce serveur."}
      />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch lg:gap-6">
      {/* Bloc 1 — Discord */}
      <section className="min-w-0 flex-1 rounded-xl border border-vex-border bg-vex-surface p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Serveur Discord
        </h2>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-vex-border bg-vex-bg">
            {d.iconUrl ? (
              <img src={d.iconUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-2xl text-zinc-600">?</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold text-zinc-100">{d.name}</p>
            {d.partial && d.partialNotice ? (
              <p className="mt-2 text-sm text-amber-200/90">{d.partialNotice}</p>
            ) : null}
            <div className="mt-4 space-y-5">
              <div>
                <StatGroupTitle>Communauté</StatGroupTitle>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Stat
                    icon="fa-users"
                    label="Membres (approx.)"
                    value={d.memberCount != null ? String(d.memberCount) : "—"}
                  />
                  <Stat
                    icon="fa-signal"
                    label="En ligne (approx.)"
                    value={d.onlineCount != null ? String(d.onlineCount) : "—"}
                  />
                </div>
              </div>

              <div>
                <StatGroupTitle>Salons</StatGroupTitle>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <Stat
                    icon="fa-folder-tree"
                    label="Catégories"
                    value={
                      d.channelCategoriesCount != null ? String(d.channelCategoriesCount) : "—"
                    }
                  />
                  <Stat
                    icon="fa-hashtag"
                    label="Texte & annonces"
                    value={d.channelTextCount != null ? String(d.channelTextCount) : "—"}
                  />
                  <Stat
                    icon="fa-microphone-lines"
                    label="Salons vocaux"
                    value={d.channelVoiceCount != null ? String(d.channelVoiceCount) : "—"}
                  />
                  <Stat
                    icon="fa-comments"
                    label="Forums"
                    value={d.channelForumCount != null ? String(d.channelForumCount) : "—"}
                  />
                  {d.channelMediaCount != null && d.channelMediaCount > 0 ? (
                    <Stat icon="fa-photo-film" label="Médias" value={String(d.channelMediaCount)} />
                  ) : null}
                  {d.channelOtherCount != null && d.channelOtherCount > 0 ? (
                    <Stat
                      icon="fa-shapes"
                      label="Autres types"
                      value={String(d.channelOtherCount)}
                    />
                  ) : null}
                </div>
              </div>

              <div>
                <StatGroupTitle>Rôles & boost</StatGroupTitle>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <Stat
                    icon="fa-tags"
                    label="Rôles"
                    value={d.roleCount != null ? String(d.roleCount) : "—"}
                  />
                  <Stat
                    icon="fa-gem"
                    label="Niveau de boost"
                    value={formatBoostTier(d.boostTier)}
                  />
                  <Stat
                    icon="fa-rocket"
                    label="Nombre de boosts"
                    value={d.boostCount != null ? String(d.boostCount) : "—"}
                  />
                  <Stat
                    icon="fa-calendar-days"
                    label="Création du serveur"
                    value={formatDate(d.createdAtIso)}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bloc 2 — Vex (à droite du bloc Serveur sur grands écrans) */}
      <section
        className={`w-full shrink-0 rounded-xl border border-vex-border bg-vex-surface p-5 lg:max-w-sm xl:max-w-md ${graySecondThird ? "opacity-55" : ""}`}
        aria-disabled={graySecondThird}
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Vex sur ce serveur
        </h2>
        {graySecondThird || !data.vex ? (
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-vex-border/60 bg-vex-bg/50">
              <span className="fa-solid fa-plug text-2xl text-zinc-600" aria-hidden />
            </div>
            <div className="min-w-0 flex-1 rounded-lg border border-dashed border-vex-border bg-vex-bg/40 px-4 py-6 text-center text-sm text-zinc-500 sm:text-left">
              Invitez le bot pour afficher ces statistiques.
              {inviteLink ? (
                <a
                  href={inviteLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 block font-medium text-vex-accent hover:underline sm:mt-2"
                >
                  Inviter Vex sur ce serveur
                </a>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-vex-border bg-vex-bg">
              <span className="fa-solid fa-chart-line text-2xl text-vex-accent/90" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <div className="mt-4 space-y-5">
                <div>
                  <StatGroupTitle>Tickets</StatGroupTitle>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Stat icon="fa-folder-open" label="Ouverts" value={data.vex.ticketsOpen} />
                    <Stat icon="fa-box-archive" label="Fermés" value={data.vex.ticketsClosed} />
                  </div>
                </div>
                <div>
                  <StatGroupTitle>Contenu</StatGroupTitle>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Stat icon="fa-pen-to-square" label="Embeds enregistrés" value={data.vex.embedCount} />
                    <Stat icon="fa-terminal" label="Commandes actives" value={data.vex.slashCommandsActive} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
      </div>
    </div>
  );
}
