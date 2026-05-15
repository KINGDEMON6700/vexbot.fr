/**
 * Catalogue des commandes natives du bot, vu par l'API.
 *
 * IMPORTANT : ce fichier doit rester aligné avec ce que le bot enregistre via
 * `app/Vex/bot/src/deploy-commands.ts`. Si on ajoute une commande native côté bot,
 * il faut l'ajouter ici pour qu'elle apparaisse dans la page "Commandes" du panel.
 *
 * On ne décrit ici que les métadonnées utilisées par le panel (nom, description, etc.).
 * Les options Discord (sous-commandes, paramètres) restent définies côté bot.
 */

export type NativeCommandCatalogEntry = {
  /** Nom logique (= valeur de `commandName` en DB). */
  name: string;
  /** Libellé affiché dans le panel (commence par `/`). */
  displayName: string;
  /** Description courte affichée sur la card. */
  description: string;
  /** Icône Font Awesome (sans le préfixe `fa-`). */
  icon: string;
  /**
   * Lien interne du panel vers la page de config dédiée (le cas échéant).
   * Le panel y placera un bouton « Voir la config » dans la card.
   */
  configPanelPath: string | null;
};

export const NATIVE_COMMANDS_CATALOG: readonly NativeCommandCatalogEntry[] = [
  {
    name: "ping",
    displayName: "/ping",
    description: "Vérifie que le bot répond. Utile pour tester rapidement que tout va bien.",
    icon: "tower-broadcast",
    configPanelPath: null,
  },
  {
    name: "sendembed",
    displayName: "/sendembed",
    description:
      "Envoie un modèle d'embed (depuis la page « Embeds ») dans le salon où la commande est utilisée.",
    icon: "paper-plane",
    configPanelPath: "/embeds",
  },
  {
    name: "ticket",
    displayName: "/ticket (close, add, kick)",
    description:
      "Outils de gestion des tickets pour l'équipe : fermer le ticket courant, ajouter ou retirer un membre du salon de ticket.",
    icon: "ticket",
    configPanelPath: "/tickets",
  },
] as const;

const NATIVE_COMMAND_NAMES = new Set(NATIVE_COMMANDS_CATALOG.map((c) => c.name));

export function isKnownNativeCommand(name: string): boolean {
  return NATIVE_COMMAND_NAMES.has(name);
}

export function getNativeCommandEntry(name: string): NativeCommandCatalogEntry | null {
  return NATIVE_COMMANDS_CATALOG.find((c) => c.name === name) ?? null;
}
