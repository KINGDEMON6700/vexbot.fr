import { AuthenticatedSection } from "../components/layout/AuthenticatedSection.js";
import { TicketsPageContent } from "../components/tickets/TicketsPageContent.js";
import { useGuild } from "../contexts/GuildContext.js";

function TicketsInner() {
  const { selectedGuild } = useGuild();
  if (!selectedGuild) return null;
  return <TicketsPageContent discordGuildId={selectedGuild.id} />;
}

export function TicketsPage() {
  return (
    <AuthenticatedSection
      title="Tickets"
      description="Configuration en haut, puis liste des tickets. Sur Discord : /ticket pour fermer, inviter ou retirer quelqu’un."
      wrapContent={false}
    >
      <TicketsInner />
    </AuthenticatedSection>
  );
}
