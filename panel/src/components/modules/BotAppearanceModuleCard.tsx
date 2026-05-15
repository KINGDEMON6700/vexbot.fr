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

/** Aperçu lecture seule : identité globale du bot (sans surnom / images du serveur). */
function BotAppearanceDefaultPreview({ bot }: { bot: BotInfo }) {
  const avatar = bot.defaultAvatarUrl;
  const banner = bot.defaultBannerUrl;

  return (
    <div className="mt-1 flex flex-col gap-4">
      <p className="text-sm leading-relaxed text-zinc-400">
        Sur ce serveur, le bot utilise son profil Discord habituel&nbsp;: nom du compte, photo et bannière par défaut
        (aucune photo ou bannière spécifique au serveur).
      </p>

      <div>
        <p className="mb-1 text-xs font-medium text-zinc-500">Nom affiché (compte)</p>
        <p className="text-sm font-medium text-zinc-200">{bot.accountUsername}</p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-zinc-500">Photo</p>
          <div className="flex h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-vex-border bg-vex-bg">
            {avatar ? (
              <img src={avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-zinc-600">
                {bot.accountUsername.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <p className="mb-1.5 text-xs font-medium text-zinc-500">Bannière</p>
          <div className="h-24 w-full max-w-md overflow-hidden rounded-lg border border-vex-border bg-vex-bg">
            {banner ? (
              <img src={banner} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-zinc-600">
                Pas de bannière sur le compte
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
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
    <div className="min-w-0 lg:col-span-2 xl:col-span-3">
      {!botPresent || !bot ? (
        <ModuleCard
          icon="wand-magic-sparkles"
          title="Apparence du bot"
          description="Personnaliser ou non le nom, la photo et la bannière du bot uniquement sur ce serveur."
          enabled={false}
          hideEnabledToggle
          onToggleEnabled={() => {}}
        >
          {bodyMissing}
        </ModuleCard>
      ) : (
        <ModuleCard
          icon="wand-magic-sparkles"
          title="Apparence du bot"
          description="« Activée » : vous choisissez un nom, une photo ou une bannière pour ce serveur. « Désactivée » : profil habituel du compte Discord du bot."
          enabled={effectiveEditing}
          enabledBusy={toggleBusy}
          keepFormVisibleWhenDisabled
          onToggleEnabled={() => void handleToggle()}
        >
          {toggleError ? <p className="mb-3 text-sm text-amber-200/90">{toggleError}</p> : null}
          {effectiveEditing ? (
            <BotAppearanceCard discordGuildId={discordGuildId} bot={bot} onSaved={onRefresh} />
          ) : (
            <BotAppearanceDefaultPreview bot={bot} />
          )}
        </ModuleCard>
      )}
    </div>
  );
}
