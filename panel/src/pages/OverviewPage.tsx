import { Navigate } from "react-router-dom";
import { ConnectPrompt } from "../components/auth/ConnectPrompt.js";
import { PanelPageHeader } from "../components/ui/PanelPageHeader.js";
import { PageAuthSkeleton } from "../components/ui/PageSkeleton.js";
import { OverviewPageContent } from "../components/overview/OverviewPageContent.js";
import { useAuth } from "../contexts/AuthContext.js";
import { useGuild } from "../contexts/GuildContext.js";

export function OverviewPage() {
  const { status, user } = useAuth();
  const g = useGuild();

  if (status === "loading") {
    return (
      <PageAuthSkeleton
        title="Vue d'ensemble"
        description={"Votre serveur Discord et l'activité de Vex sur ce serveur."}
      />
    );
  }

  if (!user) {
    return <ConnectPrompt pageTitle="Vue d'ensemble" />;
  }

  if (g.loadStatus === "loading" || g.loadStatus === "idle") {
    return (
      <PageAuthSkeleton
        title="Vue d'ensemble"
        description={"Votre serveur Discord et l'activité de Vex sur ce serveur."}
      />
    );
  }

  if (g.loadStatus === "error") {
    return (
      <div className="flex flex-col gap-6">
        <PanelPageHeader title="Vue d'ensemble" description={"Votre serveur Discord et l'activité de Vex sur ce serveur."} />
        <div className="ui-card-muted px-8 py-12 text-center text-sm text-amber-200/90">
          Impossible de charger vos serveurs. Réessayez dans un instant.
        </div>
      </div>
    );
  }

  if (g.eligibleGuilds.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PanelPageHeader title="Vue d'ensemble" description={"Votre serveur Discord et l'activité de Vex sur ce serveur."} />
        <div className="ui-card px-6 py-10 text-center text-sm text-zinc-400">
          Vous n’avez aucun serveur où vous êtes propriétaire ou administrateur.
        </div>
      </div>
    );
  }

  if (g.needsGuildSelection) {
    return <Navigate to="/select-server" replace />;
  }

  if (g.isGuildParamInvalid || !g.selectedGuild) {
    return (
      <div className="flex flex-col gap-6">
        <PanelPageHeader title="Vue d'ensemble" description={"Votre serveur Discord et l'activité de Vex sur ce serveur."} />
        <div className="ui-empty-state py-12">
          Sélectionnez un serveur valide dans le menu.
        </div>
      </div>
    );
  }

  return <OverviewPageContent discordGuildId={g.selectedGuild.id} />;
}
