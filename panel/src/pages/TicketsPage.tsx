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
      description="Liste des tickets en haut, puis salon Discord et messages du Panel (étapes 1 et 2). Sur Discord : /ticket pour fermer, inviter ou retirer quelqu’un."
      wrapContent={false}
    >
      <TicketsInner />
    </AuthenticatedSection>
  );
}
