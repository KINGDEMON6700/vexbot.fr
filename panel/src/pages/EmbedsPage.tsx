import { AuthenticatedSection } from "../components/layout/AuthenticatedSection.js";
import { EmbedsPageContent } from "../components/embeds/EmbedsPageContent.js";
import { useGuild } from "../contexts/GuildContext.js";

function EmbedsInner() {
  const { selectedGuild } = useGuild();
  if (!selectedGuild) return null;
  return <EmbedsPageContent discordGuildId={selectedGuild.id} />;
}

export function EmbedsPage() {
  return (
    <AuthenticatedSection
      title="Embeds"
      description="Crée des modèles de messages enrichis : éditeur à gauche, aperçu comme sur Discord à droite."
      wrapContent={false}
    >
      <EmbedsInner />
    </AuthenticatedSection>
  );
}
