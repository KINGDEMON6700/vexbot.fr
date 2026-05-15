import { AuthenticatedSection } from "../components/layout/AuthenticatedSection.js";
import { CommandsPageContent } from "../components/commands/CommandsPageContent.js";
import { useGuild } from "../contexts/GuildContext.js";

function CommandsInner() {
  const { selectedGuild } = useGuild();
  if (!selectedGuild) return null;
  return <CommandsPageContent discordGuildId={selectedGuild.id} />;
}

export function CommandsPage() {
  return (
    <AuthenticatedSection
      title="Commandes"
      description="Paramétrez les commandes natives du bot (tickets, embeds…) et créez vos propres commandes slash : activation, salons et rôles autorisés pour chacune."
      wrapContent={false}
    >
      <CommandsInner />
    </AuthenticatedSection>
  );
}
