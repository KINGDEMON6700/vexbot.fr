import { useEffect, useState } from "react";
import { patchBotMember } from "../../lib/overviewApi.js";
import type { OverviewResponse } from "../../types/overview.js";
import { BotAppearanceCard } from "../overview/BotAppearanceCard.js";
import { ModuleCard } from "./ModuleCard.js";

type Props = {
  discordGuildId: string;
  overview: OverviewResponse | null;
  onRefresh: () => Promise<void>;
};

type BotInfo = NonNullable<OverviewResponse["bot"]>;

/** Y a-t-il une personnalisation enregistrée sur ce serveur (Discord) ? */
function hasCustomization(b: BotInfo): boolean {
  if (b.guildAvatarUrl) return true;
  if (b.guildBannerUrl) return true;
  if (b.nickname != null && String(b.nickname).trim() !== "") return true;
  return false;
}

/** Apparence du membre bot sur ce serveur (nom, avatar, bannière) — carte alignée sur les autres modules. */
export function BotAppearanceModuleCard({ discordGuildId, overview, onRefresh }: Props) {
  const botPresent = overview?.botPresent ?? false;
  const bot = overview?.bot ?? null;
  const inviteLink = overview?.inviteUrl ?? null;

  /** null = suivre ce que renvoie le serveur (personnalisé ou non) */
  const [modeOverride, setModeOverride] = useState<"editing" | null>(null);
  const [toggleBusy, setToggleBusy] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);

  useEffect(() => {
    setModeOverride(null);
    setToggleError(null);
  }, [discordGuildId]);

  const derivedEditing = !!(bot && hasCustomization(bot));
  const effectiveEditing = modeOverride === "editing" || derivedEditing;

  const handleToggle = async () => {
    setToggleError(null);
    if (effectiveEditing) {
      /* Désactiver la personnalisation : tout remettre comme le compte du bot… */
      setToggleBusy(true);
      try {
        await patchBotMember(discordGuildId, {
          nickname: null,
          avatar: null,
          banner: null,
        });
        await onRefresh();
        setModeOverride(null);
      } catch {
        setToggleError(
          "Impossible de désactiver. Vérifiez que Vex peut modifier son profil sur ce serveur (droits Discord).",
        );
      } finally {
        setToggleBusy(false);
      }
    } else {
      setModeOverride("editing");
    }
  };

  const bodyMissing = (
    <>
      {!overview ? (
        <p className="text-sm text-amber-200/90">
          Impossible de charger ces données. Réessayez en rechargeant la page Modules.
        </p>
      ) : (
        <div className="rounded-lg border border-dashed border-vex-border bg-vex-bg/40 px-4 py-6 text-center text-sm text-zinc-500">
          Invitez Vexbot pour accéder à ces réglages.
          {inviteLink ? (
            <a
              href={inviteLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 block font-medium text-vex-accent hover:underline"
            >
              Inviter Vexbot sur ce serveur
            </a>
          ) : null}
        </div>
      )}
    </>
  );

  return (
    <>
      {!botPresent || !bot ? (
        <ModuleCard
          icon="wand-magic-sparkles"
          title="Apparence du bot"
          description="Personnaliser ou non le nom, la photo et la bannière du bot uniquement sur ce serveur."
          enabled={false}
          keepFormVisibleWhenDisabled
          hideEnabledToggle
          onToggleEnabled={() => {}}
        >
          {bodyMissing}
        </ModuleCard>
      ) : (
        <ModuleCard
          icon="wand-magic-sparkles"
          title="Apparence du bot"
          description="« Activée » : vous choisissez un nom, une photo ou une bannière pour ce serveur. « Désactivée » : les réglages sont masqués ; le bot garde son profil Discord habituel."
          enabled={effectiveEditing}
          enabledBusy={toggleBusy}
          onToggleEnabled={() => void handleToggle()}
        >
          {toggleError ? <p className="mb-3 text-sm text-amber-200/90">{toggleError}</p> : null}
          <BotAppearanceCard discordGuildId={discordGuildId} bot={bot} onSaved={onRefresh} />
        </ModuleCard>
      )}
    </>
  );
}
