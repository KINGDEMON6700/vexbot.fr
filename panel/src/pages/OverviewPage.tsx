import { Navigate } from "react-router-dom";
import { ConnectPrompt } from "../components/auth/ConnectPrompt.js";
import { OverviewPageContent } from "../components/overview/OverviewPageContent.js";
import { useAuth } from "../contexts/AuthContext.js";
import { useGuild } from "../contexts/GuildContext.js";

export function OverviewPage() {
  const { status, user } = useAuth();
  const g = useGuild();

  if (status === "loading") {
    return (
      <div className="ui-card-muted px-8 py-12 text-center text-sm text-zinc-500">
        Chargement…
      </div>
    );
  }

  if (!user) {
    return <ConnectPrompt pageTitle="Vue d'ensemble" />;
  }

  if (g.loadStatus === "loading" || g.loadStatus === "idle") {
    return (
      <div className="ui-card-muted px-8 py-12 text-center text-sm text-zinc-500">
        Chargement des serveurs…
      </div>
    );
  }

  if (g.loadStatus === "error") {
    return (
      <div className="ui-card-muted px-8 py-12 text-center text-sm text-amber-200/90">
        Impossible de charger tes serveurs. Réessaie dans un instant.
      </div>
    );
  }

  if (g.eligibleGuilds.length === 0) {
    return (
      <div className="ui-card px-6 py-10 text-center text-sm text-zinc-400">
        Tu n’as aucun serveur où tu es propriétaire ou administrateur.
      </div>
    );
  }

  if (g.needsGuildSelection) {
    return <Navigate to="/select-server" replace />;
  }

  if (g.isGuildParamInvalid || !g.selectedGuild) {
    return (
      <div className="ui-empty-state py-12">
        Sélectionne un serveur valide dans le menu.
      </div>
    );
  }

  return <OverviewPageContent discordGuildId={g.selectedGuild.id} />;
}
