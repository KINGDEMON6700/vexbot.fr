import { AuthenticatedSection } from "../components/layout/AuthenticatedSection.js";
import { ModulesPageContent } from "../components/modules/ModulesPageContent.js";
import { useGuild } from "../contexts/GuildContext.js";

function ModulesInner() {
  const { selectedGuild } = useGuild();
  if (!selectedGuild) return null;
  return <ModulesPageContent discordGuildId={selectedGuild.id} />;
}

export function ModulesPage() {
  return (
    <AuthenticatedSection
      title="Modules"
      description="Options du bot hors commandes slash : messages automatiques, arrivées/départs, apparence du bot sur ce serveur, etc."
      wrapContent={false}
    >
      <ModulesInner />
    </AuthenticatedSection>
  );
}
