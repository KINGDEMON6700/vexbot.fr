import { AuthenticatedSection } from "../components/layout/AuthenticatedSection.js";
import { MarketplacePageContent } from "../components/marketplace/MarketplacePageContent.js";
import { useAuth } from "../contexts/AuthContext.js";
import { useGuild } from "../contexts/GuildContext.js";

function MarketplaceInner() {
  const { selectedGuild, eligibleGuilds } = useGuild();
  const { user } = useAuth();
  if (!selectedGuild || !user) return null;
  return (
    <MarketplacePageContent discordGuildId={selectedGuild.id} eligibleGuilds={eligibleGuilds} user={user} />
  );
}

export function MarketplacePage() {
  return (
    <AuthenticatedSection
      title="Marketplace"
      description="Parcours et importe des templates créés par la communauté Vex."
      wrapContent={false}
    >
      <MarketplaceInner />
    </AuthenticatedSection>
  );
}
