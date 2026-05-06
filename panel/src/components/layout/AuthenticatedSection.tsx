import type { ReactNode } from "react";
import { useAuth } from "../../contexts/AuthContext.js";
import { useGuild } from "../../contexts/GuildContext.js";
import { ConnectPrompt } from "../auth/ConnectPrompt.js";

type Props = {
  title: string;
  description?: string;
  children: ReactNode;
  /** Si false, le contenu n’est pas dans la carte en pointillés (pages avec éditeur large). */
  wrapContent?: boolean;
};

export function AuthenticatedSection({ title, description, children, wrapContent = true }: Props) {
  const { status, user } = useAuth();
  const {
    loadStatus,
    eligibleGuilds,
    needsGuildSelection,
    isGuildParamInvalid,
    selectedGuild,
  } = useGuild();

  if (status === "loading") {
    return (
      <div className="rounded-xl border border-vex-border bg-vex-surface/50 px-8 py-12 text-center text-sm text-zinc-500">
        Chargement…
      </div>
    );
  }

  if (!user) {
    return <ConnectPrompt pageTitle={title} />;
  }

  if (loadStatus === "loading" || loadStatus === "idle") {
    return (
      <div className="rounded-xl border border-vex-border bg-vex-surface/50 px-8 py-12 text-center text-sm text-zinc-500">
        Chargement des serveurs…
      </div>
    );
  }

  if (loadStatus === "error") {
    return (
      <div className="rounded-xl border border-vex-border bg-vex-surface/50 px-8 py-12 text-center text-sm text-amber-200/90">
        Impossible de charger tes serveurs. Réessaie dans un instant.
      </div>
    );
  }

  if (eligibleGuilds.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">{title}</h1>
          {description ? (
            <p className="mt-1 text-sm text-zinc-400">{description}</p>
          ) : null}
        </header>
        <div className="rounded-xl border border-vex-border bg-vex-surface px-6 py-10 text-center text-sm text-zinc-400">
          Tu n’as aucun serveur où tu es propriétaire ou administrateur. Reviens quand c’est le cas.
        </div>
      </div>
    );
  }

  if (needsGuildSelection) {
    return (
      <div className="flex flex-col gap-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">{title}</h1>
          {description ? (
            <p className="mt-1 text-sm text-zinc-400">{description}</p>
          ) : null}
        </header>
        <div className="rounded-xl border border-dashed border-vex-border/80 bg-vex-bg/40 px-6 py-10 text-center text-sm text-zinc-400">
          Choisis un serveur dans le menu en haut pour continuer.
        </div>
      </div>
    );
  }

  if (!selectedGuild) {
    return (
      <div className="flex flex-col gap-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">{title}</h1>
          {description ? (
            <p className="mt-1 text-sm text-zinc-400">{description}</p>
          ) : null}
        </header>
        <div className="rounded-xl border border-dashed border-vex-border/80 bg-vex-bg/40 px-6 py-10 text-center text-sm text-zinc-400">
          {isGuildParamInvalid
            ? "Ce lien de serveur n’est plus bon. Choisis un serveur dans le menu."
            : "Sélectionne un serveur valide dans le menu pour afficher cette page."}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-zinc-400">{description}</p>
        ) : null}
      </header>
      {wrapContent ? (
        <div className="rounded-xl border border-dashed border-vex-border/80 bg-vex-bg/40 px-6 py-10 text-center text-sm text-zinc-500">
          {children}
          <p className="mt-4 text-xs text-zinc-600">
            Serveur actif :{" "}
            <span className="text-zinc-400">{selectedGuild.name}</span>
          </p>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
