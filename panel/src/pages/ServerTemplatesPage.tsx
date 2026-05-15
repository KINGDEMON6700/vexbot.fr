import { AuthenticatedSection } from "../components/layout/AuthenticatedSection.js";
import { ServerTemplatesPageContent } from "../components/serverTemplates/ServerTemplatesPageContent.js";
import { useGuild } from "../contexts/GuildContext.js";

function ServerTemplatesInner() {
  const { selectedGuild } = useGuild();
  if (!selectedGuild) return null;
  return <ServerTemplatesPageContent discordGuildId={selectedGuild.id} />;
}

export function ServerTemplatesPage() {
  return (
    <AuthenticatedSection
      title="Templates de serveur"
      description="Sauvegarde la structure d’un serveur Discord (catégories, salons, rôles, permissions) pour la réutiliser plus tard sur un autre serveur."
      wrapContent={false}
    >
      <ServerTemplatesInner />
    </AuthenticatedSection>
  );
}
