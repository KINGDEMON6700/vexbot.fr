import { ConnectPrompt } from "../components/auth/ConnectPrompt.js";
import { OverviewPageContent } from "../components/overview/OverviewPageContent.js";
import { useAuth } from "../contexts/AuthContext.js";
import { useGuild } from "../contexts/GuildContext.js";

export function OverviewPage() {
  const { status, user } = useAuth();
  const g = useGuild();

  if (status === "loading") {
    return (
      <div className="rounded-xl border border-vex-border bg-vex-surface/50 px-8 py-12 text-center text-sm text-zinc-500">
        Chargement…
      </div>
    );
  }

  if (!user) {
    return <ConnectPrompt pageTitle="Vue d'ensemble" />;
  }

  if (g.loadStatus === "loading" || g.loadStatus === "idle") {
    return (
      <div className="rounded-xl border border-vex-border bg-vex-surface/50 px-8 py-12 text-center text-sm text-zinc-500">
        Chargement des serveurs…
      </div>
    );
  }

  if (g.loadStatus === "error") {
    return (
      <div className="rounded-xl border border-vex-border bg-vex-surface/50 px-8 py-12 text-center text-sm text-amber-200/90">
        Impossible de charger tes serveurs. Réessaie dans un instant.
      </div>
    );
  }

  if (g.eligibleGuilds.length === 0) {
    return (
      <div className="rounded-xl border border-vex-border bg-vex-surface px-6 py-10 text-center text-sm text-zinc-400">
        Tu n’as aucun serveur où tu es propriétaire ou administrateur.
      </div>
    );
  }

  if (g.needsGuildSelection) {
    return (
      <div className="rounded-xl border border-dashed border-vex-border bg-vex-bg/40 px-6 py-12 text-center text-sm text-zinc-400">
        Choisis un serveur dans le menu en haut pour afficher la vue d’ensemble.
      </div>
    );
  }

  if (g.isGuildParamInvalid || !g.selectedGuild) {
    return (
      <div className="rounded-xl border border-dashed border-vex-border bg-vex-bg/40 px-6 py-12 text-center text-sm text-zinc-400">
        Sélectionne un serveur valide dans le menu.
      </div>
    );
  }

  return <OverviewPageContent discordGuildId={g.selectedGuild.id} />;
}
